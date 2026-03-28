/**
 * Account Manager class
 * Manages multiple iFlow accounts with selection strategies
 */

import { randomBytes } from 'node:crypto'
import type {
  ManagedAccount,
  AccountMetadata,
  AccountSelectionStrategy,
  IFlowAuthDetails
} from '../types.js'
import { loadAccounts, saveAccounts } from '../storage.js'
import { encodeRefreshToken, decodeRefreshToken } from './encoding.js'
import { readOpenCodeAuth } from './opencode-auth.js'
import { ACCOUNT_TOAST_DEBOUNCE_MS } from '../../constants/limits.js'

const DEBUG = process.env.IFLOW_AUTH_DEBUG === 'true'

function log(...args: any[]) {
  if (DEBUG) {
    console.error('[iflow-auth]', ...args)
  }
}

/**
 * Generate a unique account ID
 * @returns Hex string account ID
 */
export function generateAccountId(): string {
  return randomBytes(16).toString('hex')
}

/**
 * Account Manager class
 * Handles loading, saving, and selecting accounts
 */
export class AccountManager {
  private accounts: ManagedAccount[]
  private cursor: number
  private strategy: AccountSelectionStrategy
  private lastToastTime = 0

  constructor(accounts: ManagedAccount[], strategy: AccountSelectionStrategy = 'sticky') {
    this.accounts = accounts
    this.cursor = 0
    this.strategy = strategy
  }

  /**
   * Load accounts from disk
   * @param strategy - Account selection strategy
   * @returns AccountManager instance
   */
  static async loadFromDisk(strategy?: AccountSelectionStrategy): Promise<AccountManager> {
    log('loadFromDisk called')
    const s = await loadAccounts()
    log('Loaded accounts count:', s.accounts.length)

    if (s.accounts.length === 0) {
      log('No accounts, trying to read OpenCode auth')
      const openCodeAuth = await readOpenCodeAuth()
      log('OpenCode auth result:', openCodeAuth ? 'found' : 'not found')
      if (openCodeAuth) {
        const account: ManagedAccount = {
          id: generateAccountId(),
          email: 'iflow-user',
          authMethod: 'apikey',
          apiKey: openCodeAuth.key,
          rateLimitResetTime: 0,
          isHealthy: true,
        }
        s.accounts.push(account)
        log('Added account from OpenCode auth')
      }
    }

    log('Final accounts count:', s.accounts.length)
    return new AccountManager(s.accounts, strategy || 'sticky')
  }

  /**
   * Get the number of accounts
   * @returns Account count
   */
  getAccountCount(): number {
    return this.accounts.length
  }

  /**
   * Get all accounts
   * @returns Array of all accounts
   */
  getAccounts(): ManagedAccount[] {
    return [...this.accounts]
  }

  /**
   * Check if toast should be shown (with debounce)
   * @param debounce - Debounce time in milliseconds
   * @returns True if toast should be shown
   */
  shouldShowToast(debounce = ACCOUNT_TOAST_DEBOUNCE_MS): boolean {
    if (Date.now() - this.lastToastTime < debounce) return false
    this.lastToastTime = Date.now()
    return true
  }

  /**
   * Get minimum wait time until any account is available
   * @returns Wait time in milliseconds
   */
  getMinWaitTime(): number {
    const now = Date.now()
    const waits = this.accounts.map((a) => (a.rateLimitResetTime || 0) - now).filter((t) => t > 0)
    return waits.length > 0 ? Math.min(...waits) : 0
  }

  /**
   * Get current or next available account based on strategy
   * @returns Selected account or null if none available
   */
  getCurrentOrNext(): ManagedAccount | null {
    const now = Date.now()
    const available = this.accounts.filter((a) => {
      if (!a.isHealthy) {
        if (a.recoveryTime && now >= a.recoveryTime) {
          a.isHealthy = true
          delete a.unhealthyReason
          delete a.recoveryTime
          return true
        }
        return false
      }
      return !(a.rateLimitResetTime && now < a.rateLimitResetTime)
    })

    if (available.length === 0) return null

    let selected: ManagedAccount | undefined
    if (this.strategy === 'sticky') {
      selected = available.find((_, i) => i === this.cursor) || available[0]
    } else if (this.strategy === 'round-robin') {
      selected = available[this.cursor % available.length]
      this.cursor = (this.cursor + 1) % available.length
    }

    if (selected) {
      selected.lastUsed = now
      this.cursor = this.accounts.indexOf(selected)
      return selected
    }
    return null
  }

  /**
   * Add a new account
   * @param account - Account to add
   */
  addAccount(account: ManagedAccount): void {
    const i = this.accounts.findIndex((x) => x.id === account.id)
    if (i === -1) this.accounts.push(account)
    else this.accounts[i] = account
  }

  /**
   * Remove an account
   * @param account - Account to remove
   */
  removeAccount(account: ManagedAccount): void {
    const removedIndex = this.accounts.findIndex((x) => x.id === account.id)
    if (removedIndex === -1) return

    this.accounts = this.accounts.filter((x) => x.id !== account.id)

    if (this.accounts.length === 0) {
      this.cursor = 0
    } else if (this.cursor >= this.accounts.length) {
      this.cursor = this.accounts.length - 1
    } else if (removedIndex <= this.cursor && this.cursor > 0) {
      this.cursor--
    }
  }

  /**
   * Update account with new auth details
   * @param account - Account to update
   * @param auth - New auth details
   */
  updateFromAuth(account: ManagedAccount, auth: IFlowAuthDetails): void {
    const acc = this.accounts.find((x) => x.id === account.id)
    if (acc) {
      acc.apiKey = auth.apiKey
      if (auth.authMethod === 'oauth') {
        acc.accessToken = auth.access
        acc.expiresAt = auth.expires
        const p = decodeRefreshToken(auth.refresh)
        acc.refreshToken = p.refreshToken
      }
      acc.lastUsed = Date.now()
      if (auth.email) acc.email = auth.email
    }
  }

  /**
   * Mark account as rate limited
   * @param account - Account to mark
   * @param ms - Rate limit duration in milliseconds
   */
  markRateLimited(account: ManagedAccount, ms: number): void {
    const acc = this.accounts.find((x) => x.id === account.id)
    if (acc) acc.rateLimitResetTime = Date.now() + ms
  }

  /**
   * Mark account as unhealthy
   * @param account - Account to mark
   * @param reason - Reason for unhealthy state
   * @param recovery - Recovery time in milliseconds
   */
  markUnhealthy(account: ManagedAccount, reason: string, recovery?: number): void {
    const acc = this.accounts.find((x) => x.id === account.id)
    if (acc) {
      acc.isHealthy = false
      acc.unhealthyReason = reason
      acc.recoveryTime = recovery
    }
  }

  /**
   * Save accounts to disk
   */
  async saveToDisk(): Promise<void> {
    const metadata: AccountMetadata[] = this.accounts.map(({ lastUsed, ...rest }) => rest)
    await saveAccounts({ version: 1, accounts: metadata, activeIndex: this.cursor })
  }

  /**
   * Convert account to auth details format
   * @param account - Account to convert
   * @returns Auth details
   */
  toAuthDetails(account: ManagedAccount): IFlowAuthDetails {
    const p = {
      refreshToken: account.refreshToken,
      authMethod: account.authMethod
    }
    return {
      refresh: encodeRefreshToken(p),
      access: account.accessToken || '',
      expires: account.expiresAt || 0,
      authMethod: account.authMethod,
      apiKey: account.apiKey,
      email: account.email
    }
  }
}

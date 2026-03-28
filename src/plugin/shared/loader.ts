/**
 * Shared plugin loader utilities
 * Common logic for loading accounts and configuring providers
 */

import { AccountManager } from '../accounts.js'
import { registerIFlowModels, registerAllModels } from '../model-registry.js'
import type { IFlowConfig } from '../config/index.js'
import type { ModelCache } from '../../iflow/models.js'
import type { ManagedAccount } from '../types.js'

export interface LoaderResult {
  apiKey: string
  baseURL: string
}

export interface LoaderContext {
  config: IFlowConfig
  getAuth: () => Promise<any>
  provider: any
  modelCache?: ModelCache | null
  useProxy?: boolean
}

/**
 * Load account and return auth details for provider
 */
export async function loadAccountForProvider(
  context: LoaderContext
): Promise<LoaderResult | null> {
  const am = await AccountManager.loadFromDisk(context.config.account_selection_strategy)
  const accountCount = am.getAccountCount()

  // Register models first
  if (context.useProxy) {
    registerAllModels(context.provider, context.modelCache || null, true)
  } else {
    registerIFlowModels(context.provider)
  }

  // No accounts - return empty or CLI auth
  if (accountCount === 0) {
    return null
  }

  const account = am.getCurrentOrNext()
  if (!account) {
    return null
  }

  return {
    apiKey: account.apiKey,
    baseURL: context.useProxy
      ? 'http://127.0.0.1:19998/v1'
      : 'https://apis.iflow.cn/v1'
  }
}

/**
 * Get current account info for display/logging
 */
export function getAccountInfo(am: AccountManager): string | null {
  const account = am.getCurrentOrNext()
  if (!account) return null

  const keyPreview = account.apiKey.length > 10
    ? account.apiKey.substring(0, 10) + '...'
    : account.apiKey

  return `${account.email} (${keyPreview})`
}

import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomBytes } from 'node:crypto'
import lockfile from 'proper-lockfile'
import type { AccountStorage } from './types.js'
import * as logger from './logger.js'
import { getAccountsStoragePath } from '../constants/paths.js'
import { LOCKFILE_STALE_MS, LOCKFILE_RETRY_CONFIG } from '../constants/limits.js'

const LOCK_OPTIONS = {
  stale: LOCKFILE_STALE_MS,
  retries: LOCKFILE_RETRY_CONFIG
}

/**
 * Get the storage file path (re-exported for backward compatibility)
 * @returns Path to the accounts storage file
 */
export function getStoragePath(): string {
  return getAccountsStoragePath()
}

async function withLock<T>(path: string, fn: () => Promise<T>): Promise<T> {
  try {
    await fs.mkdir(dirname(path), { recursive: true })
  } catch (error) {
    logger.error(`Failed to create directory ${dirname(path)}`, error)
    throw error
  }

  try {
    await fs.access(path)
  } catch {
    try {
      await fs.writeFile(path, '{}')
    } catch (error) {
      logger.error(`Failed to initialize file ${path}`, error)
      throw error
    }
  }

  let release: (() => Promise<void>) | null = null
  try {
    release = await lockfile.lock(path, LOCK_OPTIONS)
    return await fn()
  } catch (error) {
    logger.error(`File lock failed for ${path}`, error)
    throw error
  } finally {
    if (release) {
      try {
        await release()
      } catch (error) {
        logger.warn(`Failed to release lock for ${path}`, error)
      }
    }
  }
}

export async function loadAccounts(): Promise<AccountStorage> {
  const path = getStoragePath()
  return withLock(path, async () => {
    try {
      const content = await fs.readFile(path, 'utf-8')
      const parsed = JSON.parse(content)
      if (!parsed || !Array.isArray(parsed.accounts)) {
        return { version: 1, accounts: [], activeIndex: -1 }
      }
      return parsed
    } catch {
      return { version: 1, accounts: [], activeIndex: -1 }
    }
  })
}

export async function saveAccounts(storage: AccountStorage): Promise<void> {
  const path = getStoragePath()
  try {
    await withLock(path, async () => {
      const tmp = `${path}.${randomBytes(6).toString('hex')}.tmp`
      await fs.writeFile(tmp, JSON.stringify(storage, null, 2))
      await fs.rename(tmp, path)
    })
  } catch (error) {
    logger.error(`Failed to save accounts to ${path}`, error)
    throw error
  }
}

/**
 * OpenCode auth file reading utilities
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DEBUG = process.env.IFLOW_AUTH_DEBUG === 'true'

function log(...args: any[]) {
  if (DEBUG) {
    console.error('[iflow-auth]', ...args)
  }
}

/**
 * Get the OpenCode data directory
 * @returns Path to the OpenCode data directory
 */
export function getOpenCodeDataDir(): string {
  const platform = process.platform
  if (platform === 'win32') {
    return join(homedir(), '.local', 'share')
  }
  return process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share')
}

/**
 * Get the OpenCode config directory
 * @returns Path to the OpenCode config directory
 */
function getOpenCodeConfigDir(): string {
  const platform = process.platform
  if (platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'opencode')
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(xdgConfig, 'opencode')
}

/**
 * Read OpenCode auth file to extract iFlow API key
 * @returns The API key if found, null otherwise
 */
export async function readOpenCodeAuth(): Promise<{ key: string } | null> {
  try {
    const dataDir = getOpenCodeConfigDir()
    const authPath = join(dataDir, 'opencode', 'auth.json')
    log('Reading auth from:', authPath)
    const content = await fs.readFile(authPath, 'utf-8')
    log('Auth content:', content.substring(0, 200))
    const auth = JSON.parse(content)
    log('Parsed auth keys:', Object.keys(auth))
    log('iflow entry:', auth.iflow)
    if (auth.iflow && auth.iflow.type === 'api' && auth.iflow.key) {
      log('Found iflow API key')
      return { key: auth.iflow.key }
    }
    log('No iflow API key found')
    return null
  } catch (e: any) {
    log('Error reading auth:', e.message)
    return null
  }
}

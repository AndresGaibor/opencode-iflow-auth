/**
 * File paths, directory paths, and URL endpoint constants
 */

import { homedir } from 'node:os'
import { join } from 'node:path'

import { PROXY_PORT, PROXY_HOST } from './ports.js'

// ============================================================================
// DIRECTORY PATHS
// ============================================================================

/**
 * Get the base configuration directory for OpenCode
 */
export function getConfigDir(): string {
  const platform = process.platform
  if (platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'opencode')
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(xdgConfig, 'opencode')
}

/**
 * Get the data directory for OpenCode
 */
export function getDataDir(): string {
  const platform = process.platform
  if (platform === 'win32') {
    return join(homedir(), '.local', 'share')
  }
  return process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share')
}

/**
 * Get the cache directory for OpenCode
 */
export function getCacheDir(): string {
  return getConfigDir()
}

// ============================================================================
// FILE PATHS
// ============================================================================

/**
 * Get the path to the iFlow accounts storage file
 */
export function getAccountsStoragePath(): string {
  return join(getConfigDir(), 'iflow-accounts.json')
}

/**
 * Get the path to the iFlow config file
 */
export function getConfigPath(): string {
  return join(getConfigDir(), 'iflow.json')
}

/**
 * Get the path to the iFlow models cache file
 */
export function getModelsCachePath(): string {
  return join(getCacheDir(), 'iflow-models-cache.json')
}

/**
 * Get the path to the iflow CLI OAuth credentials file
 */
export function getIFlowOAuthCredsPath(): string {
  const platform = process.platform
  if (platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'iflow', 'oauth_creds.json')
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(xdgConfig, 'iflow', 'oauth_creds.json')
}

/**
 * Get the path to the iflow CLI config file
 */
export function getIFlowConfigPath(): string {
  const platform = process.platform
  if (platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'iflow', 'config.json')
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(xdgConfig, 'iflow', 'config.json')
}

/**
 * Get the path to the OpenCode auth file
 */
export function getOpenCodeAuthPath(): string {
  return join(getDataDir(), 'opencode', 'auth.json')
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/** Base URL for iFlow API */
export const API_BASE_URL = 'https://apis.iflow.cn/v1'

/** OAuth token exchange endpoint */
export const OAUTH_TOKEN_URL = 'https://iflow.cn/oauth/token'

/** OAuth authorization endpoint */
export const OAUTH_AUTHORIZE_URL = 'https://iflow.cn/oauth'

/** User info endpoint for retrieving API key after OAuth */
export const USER_INFO_URL = 'https://iflow.cn/api/oauth/getUserInfo'

/** OAuth success redirect URL */
export const OAUTH_SUCCESS_REDIRECT = 'https://iflow.cn/oauth/success'

/** Models endpoint for API discovery */
export const API_MODELS_ENDPOINT = '/models'

/** Chat completions endpoint */
export const API_CHAT_ENDPOINT = '/chat/completions'

// ============================================================================
// URL BUILDERS
// ============================================================================

/**
 * Build OAuth callback URL
 * @param port - The port number for the callback server
 * @returns The full callback URL
 */
export function buildOAuthCallbackUrl(port: number): string {
  return `http://localhost:${port}/oauth2callback`
}

/**
 * Build proxy URL
 * @param port - The port number (default: PROXY_PORT)
 * @param host - The host (default: PROXY_HOST)
 * @returns The full proxy URL
 */
export function buildProxyUrl(port: number = PROXY_PORT, host: string = PROXY_HOST): string {
  return `http://${host}:${port}/v1`
}

/**
 * Build API URL with endpoint
 * @param endpoint - The API endpoint (e.g., '/models')
 * @returns The full API URL
 */
export function buildApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`
}

/**
 * Proxy server configuration constants
 */

import { PROXY_PORT as PORT, PROXY_HOST as HOST } from './ports.js'

/** Default proxy server port (re-exported for backward compatibility) */
export const PROXY_PORT = PORT

/** Default proxy server host (re-exported for backward compatibility) */
export const PROXY_HOST = HOST

/** Auto-start proxy on plugin load (default: true) */
export const DEFAULT_AUTO_START_PROXY = true

/** Auto-install iflow CLI if not found (default: true) */
export const DEFAULT_AUTO_INSTALL_CLI = true

/** Auto-trigger iflow login if not logged in (default: false) */
export const DEFAULT_AUTO_LOGIN = false

/** Use ACP protocol for CLI models (default: true) */
export const DEFAULT_USE_ACP = true

/** Proxy debug environment variable */
export const PROXY_DEBUG_ENV = 'IFLOW_PROXY_DEBUG'

/** Auto-install CLI environment variable */
export const AUTO_INSTALL_CLI_ENV = 'IFLOW_AUTO_INSTALL_CLI'

/** Auto-login environment variable */
export const AUTO_LOGIN_ENV = 'IFLOW_AUTO_LOGIN'

/** Use ACP environment variable */
export const USE_ACP_ENV = 'IFLOW_USE_ACP'

/**
 * Build proxy URL
 * @param port - The port number (default: PROXY_PORT)
 * @param host - The host (default: PROXY_HOST)
 * @returns The full proxy URL
 */
export function buildProxyUrl(port: number = PROXY_PORT, host: string = PROXY_HOST): string {
  return `http://${host}:${port}/v1`
}

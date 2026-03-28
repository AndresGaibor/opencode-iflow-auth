/**
 * Proxy server configuration constants
 */

/** Default proxy server port */
export const PROXY_PORT = 19998

/** Default proxy server host */
export const PROXY_HOST = '127.0.0.1'

/** Proxy server base URL template */
export function buildProxyUrl(port: number = PROXY_PORT, host: string = PROXY_HOST): string {
  return `http://${host}:${port}/v1`
}

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

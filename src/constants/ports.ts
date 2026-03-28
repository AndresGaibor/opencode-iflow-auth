/**
 * Port configuration constants for OAuth and Proxy servers
 */

/** Default starting port for OAuth callback server */
export const DEFAULT_OAUTH_PORT_START = 8087

/** Number of ports to try when starting OAuth callback server */
export const DEFAULT_OAUTH_PORT_RANGE = 10

/** Minimum valid port number */
export const MIN_PORT = 1024

/** Maximum valid port number */
export const MAX_PORT = 65535

/** Default proxy server port for CLI proxy */
export const PROXY_PORT = 19998

/** Default proxy server host */
export const PROXY_HOST = '127.0.0.1'

/** Minimum OAuth port range */
export const MIN_OAUTH_PORT_RANGE = 1

/** Maximum OAuth port range */
export const MAX_OAUTH_PORT_RANGE = 100

/**
 * Environment variable parsing utilities
 */

/**
 * Parse a boolean environment variable with fallback
 * @param value - The environment variable value
 * @param fallback - Default value if not set or invalid
 * @returns Parsed boolean value
 */
export function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback
  }
  if (value === '1' || value === 'true') {
    return true
  }
  if (value === '0' || value === 'false') {
    return false
  }
  return fallback
}

/**
 * Parse a number environment variable with fallback
 * @param value - The environment variable value
 * @param fallback - Default value if not set or invalid
 * @returns Parsed number value
 */
export function parseNumberEnv(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback
  }
  const parsed = Number(value)
  if (isNaN(parsed)) {
    return fallback
  }
  return parsed
}

/**
 * Parse a string environment variable with fallback
 * @param value - The environment variable value
 * @param fallback - Default value if not set
 * @returns The string value or fallback
 */
export function parseStringEnv(value: string | undefined, fallback: string): string {
  return value ?? fallback
}

// Environment variable names for configuration overrides
export const ENV_VARS = {
  // Auth method override
  DEFAULT_AUTH_METHOD: 'IFLOW_DEFAULT_AUTH_METHOD',
  
  // Account selection strategy override
  ACCOUNT_SELECTION_STRATEGY: 'IFLOW_ACCOUNT_SELECTION_STRATEGY',
  
  // OAuth server port configuration
  AUTH_SERVER_PORT_START: 'IFLOW_AUTH_SERVER_PORT_START',
  AUTH_SERVER_PORT_RANGE: 'IFLOW_AUTH_SERVER_PORT_RANGE',
  
  // Request limits
  MAX_REQUEST_ITERATIONS: 'IFLOW_MAX_REQUEST_ITERATIONS',
  REQUEST_TIMEOUT_MS: 'IFLOW_REQUEST_TIMEOUT_MS',
  
  // Logging
  ENABLE_LOG_API_REQUEST: 'IFLOW_ENABLE_LOG_API_REQUEST',
  AUTH_DEBUG: 'IFLOW_AUTH_DEBUG',
  PROXY_DEBUG: 'IFLOW_PROXY_DEBUG',
  
  // CLI behavior
  AUTO_INSTALL_CLI: 'IFLOW_AUTO_INSTALL_CLI',
  AUTO_LOGIN: 'IFLOW_AUTO_LOGIN',
  AUTO_START_PROXY: 'IFLOW_AUTO_START_PROXY',
  
  // Protocol
  USE_ACP: 'IFLOW_USE_ACP'
} as const

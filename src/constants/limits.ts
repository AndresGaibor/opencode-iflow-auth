/**
 * Request limits, timeouts, and retry configuration constants
 */

/** Default request timeout in milliseconds (5 minutes) */
export const DEFAULT_REQUEST_TIMEOUT_MS = 300000

/** Minimum request timeout in milliseconds (1 minute) */
export const MIN_REQUEST_TIMEOUT_MS = 60000

/** Maximum request timeout in milliseconds (10 minutes) */
export const MAX_REQUEST_TIMEOUT_MS = 600000

/** Maximum request iterations to prevent infinite loops */
export const DEFAULT_MAX_REQUEST_ITERATIONS = 50

/** Minimum request iterations */
export const MIN_REQUEST_ITERATIONS = 10

/** Maximum request iterations */
export const MAX_REQUEST_ITERATIONS = 1000

/** Axios timeout in milliseconds (2 minutes) */
export const AXIOS_TIMEOUT_MS = 120000

/** Model cache TTL in milliseconds (24 hours) */
export const MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** OAuth server timeout in milliseconds (10 minutes) */
export const OAUTH_SERVER_TIMEOUT_MS = 10 * 60 * 1000

/** Account manager toast debounce in milliseconds (30 seconds) */
export const ACCOUNT_TOAST_DEBOUNCE_MS = 30000

/** Access token refresh buffer in milliseconds (1 minute before expiry) */
export const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60000

/** Lock file stale timeout in milliseconds (10 seconds) */
export const LOCKFILE_STALE_MS = 10000

/** Lock file retry configuration */
export const LOCKFILE_RETRY_CONFIG = {
  retries: 5,
  minTimeout: 100,
  maxTimeout: 1000,
  factor: 2
} as const

/** Rate limit recovery time in milliseconds (5 minutes) */
export const RATE_LIMIT_RECOVERY_MS = 5 * 60 * 1000

/** Health check interval in milliseconds (1 minute) */
export const HEALTH_CHECK_INTERVAL_MS = 60 * 1000

/**
 * API configuration constants
 */

import {
  API_BASE_URL as BASE_URL,
  API_MODELS_ENDPOINT as MODELS_ENDPOINT,
  API_CHAT_ENDPOINT as CHAT_ENDPOINT,
  buildApiUrl
} from './paths.js'
import {
  DEFAULT_REQUEST_TIMEOUT_MS as TIMEOUT,
  DEFAULT_MAX_REQUEST_ITERATIONS as ITERATIONS,
  AXIOS_TIMEOUT_MS as AXIOS_TIMEOUT
} from './limits.js'

/** Base URL for iFlow API (re-exported for backward compatibility) */
export const API_BASE_URL = BASE_URL

/** Models endpoint for API discovery (re-exported for backward compatibility) */
export const API_MODELS_ENDPOINT = MODELS_ENDPOINT

/** Chat completions endpoint */
export const API_CHAT_ENDPOINT = CHAT_ENDPOINT

/** Default request timeout in milliseconds (re-exported for backward compatibility) */
export const DEFAULT_REQUEST_TIMEOUT_MS = TIMEOUT

/** Maximum request iterations to prevent hangs (re-exported for backward compatibility) */
export const DEFAULT_MAX_REQUEST_ITERATIONS = ITERATIONS

/** Axios timeout in milliseconds (re-exported for backward compatibility) */
export const AXIOS_TIMEOUT_MS = AXIOS_TIMEOUT

/** User agent string for API requests */
export const USER_AGENT = 'OpenCode-iFlow'

/** API key validation pattern */
export const API_KEY_PATTERN = /^sk-/

/**
 * Validate if a string looks like a valid API key
 * @param key - The string to validate
 * @returns true if the key matches the expected pattern
 */
export function isValidApiKeyFormat(key: string): boolean {
  return API_KEY_PATTERN.test(key)
}

/**
 * Build full API URL with endpoint
 * @param endpoint - The API endpoint (e.g., '/models')
 * @returns The full API URL
 */
export function buildApiUrlFn(endpoint: string): string {
  return buildApiUrl(endpoint)
}

/**
 * API configuration constants
 */

/** Base URL for iFlow API */
export const API_BASE_URL = 'https://apis.iflow.cn/v1'

/** Models endpoint for API discovery */
export const API_MODELS_ENDPOINT = '/models'

/** Chat completions endpoint */
export const API_CHAT_ENDPOINT = '/v1/chat/completions'

/** Default request timeout in milliseconds */
export const DEFAULT_REQUEST_TIMEOUT_MS = 300000

/** Maximum request iterations to prevent hangs */
export const DEFAULT_MAX_REQUEST_ITERATIONS = 50

/** Axios timeout in milliseconds */
export const AXIOS_TIMEOUT_MS = 120000

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

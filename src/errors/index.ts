/**
 * Error classes for iFlow auth plugin
 * Centralized error handling with specific error types
 */

/**
 * Base error class for iFlow authentication errors
 */
export class IFlowAuthError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message)
    this.name = 'IFlowAuthError'
  }
}

/**
 * Error thrown when OAuth token refresh fails
 */
export class IFlowTokenRefreshError extends IFlowAuthError {
  constructor(message: string) {
    super(message, 'TOKEN_REFRESH_FAILED')
  }
}

/**
 * Error thrown when API key is invalid
 */
export class IFlowApiKeyInvalidError extends IFlowAuthError {
  constructor(message: string) {
    super(message, 'API_KEY_INVALID')
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class IFlowRateLimitError extends IFlowAuthError {
  constructor(
    message: string,
    public retryAfter: number
  ) {
    super(message, 'RATE_LIMIT')
  }
}

/**
 * Error thrown when CLI is not available
 */
export class IFlowCLIUnavailableError extends IFlowAuthError {
  constructor(message: string = 'iflow CLI is not available') {
    super(message, 'CLI_UNAVAILABLE')
  }
}

/**
 * Error thrown when CLI is not logged in
 */
export class IFlowCLINotLoggedInError extends IFlowAuthError {
  constructor(message: string = 'iflow CLI is not logged in') {
    super(message, 'CLI_NOT_LOGGED_IN')
  }
}

/**
 * Error thrown when proxy fails to start
 */
export class IFlowProxyStartError extends IFlowAuthError {
  constructor(message: string) {
    super(message, 'PROXY_START_FAILED')
  }
}

/**
 * Error thrown when model discovery fails
 */
export class IFlowModelDiscoveryError extends IFlowAuthError {
  constructor(message: string) {
    super(message, 'MODEL_DISCOVERY_FAILED')
  }
}

/**
 * Type guard to check if error is an IFlowAuthError
 */
export function isIFlowAuthError(error: unknown): error is IFlowAuthError {
  return error instanceof IFlowAuthError
}

/**
 * Type guard to check if error is a rate limit error
 */
export function isIFlowRateLimitError(error: unknown): error is IFlowRateLimitError {
  return error instanceof IFlowRateLimitError
}

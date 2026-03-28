/**
 * HTML response builders for OAuth server
 */

/**
 * Build success HTML response
 * @param email - User email to display
 * @returns HTML string
 */
export function buildSuccessHtml(email: string): string {
  return `<html><body><h1>Authentication successful!</h1><p>Account: ${email}</p><p>You can close this window.</p></body></html>`
}

/**
 * Build error HTML response
 * @param message - Error message to display
 * @returns HTML string
 */
export function buildErrorHtml(message: string): string {
  return `<html><body><h1>Error: ${message}</h1></body></html>`
}

/**
 * Build authorization failed HTML response
 * @param error - Error description
 * @returns HTML string
 */
export function buildAuthFailedHtml(error: string): string {
  return `<html><body><h1>Authorization failed: ${error}</h1></body></html>`
}

/**
 * Build missing parameter HTML response
 * @param param - Missing parameter name
 * @returns HTML string
 */
export function buildMissingParamHtml(param: string): string {
  return `<html><body><h1>Error: Missing ${param}</h1></body></html>`
}

/**
 * Build state mismatch HTML response
 * @returns HTML string
 */
export function buildStateMismatchHtml(): string {
  return '<html><body><h1>Error: State mismatch</h1></body></html>'
}

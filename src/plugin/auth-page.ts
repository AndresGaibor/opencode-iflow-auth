/**
 * Auth Page - Backward Compatibility Wrapper
 * 
 * This file re-exports from modularized auth page modules for backward compatibility.
 * New code should import directly from specific modules:
 * - ./html-utils.js - HTML utilities and helpers
 * - ./auth-success.js - Success page
 * - ./auth-error.js - Error page
 * - ./auth-device.js - Device code auth page
 */

// Re-export HTML utilities
export {
  escapeHtml,
  buildHtmlHead,
  buildAutoCloseScript,
  COMMON_STYLES,
} from './html-utils.js'

// Re-export success page
export { buildSuccessHtml } from './auth-success.js'

// Re-export error pages
export {
  buildErrorHtml,
  buildAuthFailedHtml,
  buildMissingParamHtml,
  buildStateMismatchHtml,
} from './auth-error.js'

// Re-export device auth page
export { buildDeviceAuthHtml } from './auth-device.js'

// Legacy function name for backward compatibility
export function getIDCAuthHtml(
  verificationUrl: string,
  userCode: string,
  statusUrl: string
): string {
  const { buildDeviceAuthHtml } = require('./auth-device.js') as typeof import('./auth-device.js')
  return buildDeviceAuthHtml(verificationUrl, userCode, statusUrl)
}

export function getSuccessHtml(): string {
  const { buildSuccessHtml } = require('./auth-success.js') as typeof import('./auth-success.js')
  return buildSuccessHtml()
}

export function getErrorHtml(message: string): string {
  const { buildErrorHtml } = require('./auth-error.js') as typeof import('./auth-error.js')
  return buildErrorHtml(message)
}

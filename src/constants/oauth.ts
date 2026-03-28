/**
 * OAuth 2.0 configuration constants for iFlow authentication
 */

import {
  OAUTH_TOKEN_URL as TOKEN_URL,
  OAUTH_AUTHORIZE_URL as AUTHORIZE_URL,
  USER_INFO_URL as INFO_URL,
  OAUTH_SUCCESS_REDIRECT as SUCCESS_REDIRECT,
  buildOAuthCallbackUrl
} from './paths.js'
import {
  DEFAULT_OAUTH_PORT_START as PORT_START,
  DEFAULT_OAUTH_PORT_RANGE as PORT_RANGE
} from './ports.js'
import {
  OAUTH_SERVER_TIMEOUT_MS as TIMEOUT,
  ACCESS_TOKEN_REFRESH_BUFFER_MS as REFRESH_BUFFER,
  LOCKFILE_STALE_MS as LOCK_STALE,
  LOCKFILE_RETRY_CONFIG as LOCK_RETRY
} from './limits.js'

/** OAuth token exchange endpoint (re-exported for backward compatibility) */
export const OAUTH_TOKEN_URL = TOKEN_URL

/** OAuth authorization endpoint (re-exported for backward compatibility) */
export const OAUTH_AUTHORIZE_URL = AUTHORIZE_URL

/** User info endpoint for retrieving API key after OAuth (re-exported for backward compatibility) */
export const USER_INFO_URL = INFO_URL

/** OAuth success redirect URL (re-exported for backward compatibility) */
export const OAUTH_SUCCESS_REDIRECT = SUCCESS_REDIRECT

/** OAuth client ID for iFlow */
export const OAUTH_CLIENT_ID = '10009311001'

/** OAuth client secret for iFlow */
export const OAUTH_CLIENT_SECRET = '4Z3YjXycVsQQvyGF1etiNlIBB4RsqSDtW'

/** Default starting port for OAuth callback server (re-exported for backward compatibility) */
export const DEFAULT_OAUTH_PORT_START = PORT_START

/** Number of ports to try when starting OAuth callback server (re-exported for backward compatibility) */
export const DEFAULT_OAUTH_PORT_RANGE = PORT_RANGE

/** OAuth state parameter length in bytes */
export const OAUTH_STATE_BYTES = 16

/** OAuth token default expiry in seconds */
export const OAUTH_TOKEN_EXPIRY_SECONDS = 3600

/** OAuth server timeout (re-exported for backward compatibility) */
export const OAUTH_SERVER_TIMEOUT_MS = TIMEOUT

/** Access token refresh buffer (re-exported for backward compatibility) */
export const ACCESS_TOKEN_REFRESH_BUFFER_MS = REFRESH_BUFFER

/** Lock file stale timeout (re-exported for backward compatibility) */
export const LOCKFILE_STALE_MS = LOCK_STALE

/** Lock file retry configuration (re-exported for backward compatibility) */
export const LOCKFILE_RETRY_CONFIG = LOCK_RETRY

/**
 * Build OAuth callback URL (re-exported for backward compatibility)
 * @param port - The port number for the callback server
 * @returns The full callback URL
 */
export { buildOAuthCallbackUrl }

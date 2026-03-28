/**
 * OAuth 2.0 configuration constants for iFlow authentication
 */

/** OAuth token exchange endpoint */
export const OAUTH_TOKEN_URL = 'https://iflow.cn/oauth/token'

/** OAuth authorization endpoint */
export const OAUTH_AUTHORIZE_URL = 'https://iflow.cn/oauth'

/** User info endpoint for retrieving API key after OAuth */
export const USER_INFO_URL = 'https://iflow.cn/api/oauth/getUserInfo'

/** OAuth success redirect URL */
export const OAUTH_SUCCESS_REDIRECT = 'https://iflow.cn/oauth/success'

/** OAuth client ID for iFlow */
export const OAUTH_CLIENT_ID = '10009311001'

/** OAuth client secret for iFlow */
export const OAUTH_CLIENT_SECRET = '4Z3YjXycVsQQvyGF1etiNlIBB4RsqSDtW'

/** Default starting port for OAuth callback server */
export const DEFAULT_OAUTH_PORT_START = 8087

/** Number of ports to try when starting OAuth callback server */
export const DEFAULT_OAUTH_PORT_RANGE = 10

/** OAuth state parameter length in bytes */
export const OAUTH_STATE_BYTES = 16

/** OAuth token default expiry in seconds */
export const OAUTH_TOKEN_EXPIRY_SECONDS = 3600

/** OAuth callback URL template */
export function buildOAuthCallbackUrl(port: number): string {
  return `http://localhost:${port}/oauth2callback`
}

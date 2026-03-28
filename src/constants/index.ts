/**
 * Central export for all constants
 * Import from this file to access all constants
 */

// API constants
export {
  API_BASE_URL,
  API_MODELS_ENDPOINT,
  API_CHAT_ENDPOINT,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_MAX_REQUEST_ITERATIONS,
  AXIOS_TIMEOUT_MS,
  USER_AGENT,
  API_KEY_PATTERN,
  isValidApiKeyFormat
} from './api.js'

// OAuth constants
export {
  OAUTH_TOKEN_URL,
  OAUTH_AUTHORIZE_URL,
  USER_INFO_URL,
  OAUTH_SUCCESS_REDIRECT,
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  DEFAULT_OAUTH_PORT_START,
  DEFAULT_OAUTH_PORT_RANGE,
  OAUTH_STATE_BYTES,
  OAUTH_TOKEN_EXPIRY_SECONDS,
  buildOAuthCallbackUrl
} from './oauth.js'

// Proxy constants
export {
  PROXY_PORT,
  PROXY_HOST,
  buildProxyUrl,
  DEFAULT_AUTO_START_PROXY,
  DEFAULT_AUTO_INSTALL_CLI,
  DEFAULT_AUTO_LOGIN,
  DEFAULT_USE_ACP,
  PROXY_DEBUG_ENV,
  AUTO_INSTALL_CLI_ENV,
  AUTO_LOGIN_ENV,
  USE_ACP_ENV
} from './proxy.js'

// Model constants
export {
  CLI_EXCLUSIVE_MODELS,
  CLI_REQUIRED_PATTERNS,
  IFLOW_MODELS,
  requiresCLI,
  type IFlowModelConfig
} from './models.js'

// Thinking model constants
export {
  THINKING_MODEL_PATTERNS,
  isThinkingModel,
  applyThinkingConfig,
  THINKING_BUDGET_VARIANTS
} from './thinking.js'

// Environment variable utilities
export {
  parseBooleanEnv,
  parseNumberEnv,
  parseStringEnv,
  ENV_VARS
} from './env.js'

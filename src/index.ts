// Plugin exports
export { IFlowPlugin } from './plugin-iflow.js'
export { IFlowProxyPlugin } from './plugin-proxy.js'

// Auth helpers (direct access)
export { authorizeIFlowOAuth, exchangeOAuthCode } from './iflow/oauth.js'
export { validateApiKey } from './iflow/apikey.js'

// Type exports
export type { IFlowAuthDetails, IFlowAuthMethod, ManagedAccount } from './plugin/types.js'
export type { IFlowConfig } from './plugin/config/index.js'
export type { ModelCache, IFlowModelInfo } from './iflow/models.js'

/**
 * Central type exports for the iFlow auth plugin
 * Import types from this file for consistent type usage
 */

// Plugin types
export type {
  IFlowAuthMethod,
  IFlowAuthDetails,
  ManagedAccount,
  AccountMetadata,
  AccountStorage,
  AccountSelectionStrategy,
  IFlowPluginConfig,
  RefreshParts
} from '../plugin/types.js'

// Config types
export type {
  IFlowConfig
} from '../plugin/config/index.js'

// Model types
export type {
  IFlowModelInfo,
  MergedModelConfig
} from '../iflow/models/types.js'

export type {
  ModelCache
} from './cache.js'

// Model config types
export type {
  IFlowModelConfig
} from '../plugin/model-registry.js'

// OAuth types
export type {
  IFlowOAuthAuthorization,
  IFlowOAuthTokenResult
} from '../iflow/oauth.js'

// API Key types
export type {
  IFlowApiKeyResult
} from '../iflow/apikey.js'

// Proxy types
export type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  CLIStatus,
  SessionState,
  ConversationContext,
  NormalizedToolCall,
  ToolCallMessage,
  ACPProcessingResult
} from '../iflow/proxy/types.js'

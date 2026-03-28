/**
 * Model management - Central export
 * Re-exports all model-related functionality
 */

// Re-export types
export type { IFlowModelInfo, MergedModelConfig } from './types.js'
export type { ModelCache } from '../../types/cache.js'

// Re-export cache management
export {
  loadCacheFromFile,
  saveCacheToFile,
  getModels,
  refreshModelsCache,
  getAllAvailableModels
} from './cache.js'

// Re-export inference
export {
  inferFamily,
  inferModelName,
  inferContextLength,
  inferOutputLength,
  inferModelConfig
} from './inference.js'

// Re-export API operations
export {
  fetchModelsFromAPI
} from './api.js'

// Re-export constants for backward compatibility
export {
  CLI_EXCLUSIVE_MODELS,
  CLI_REQUIRED_PATTERNS
} from '../../constants/models.js'

// Re-export thinking model constants
export {
  THINKING_MODEL_PATTERNS,
  isThinkingModel
} from '../../constants/thinking.js'

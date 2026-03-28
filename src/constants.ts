/**
 * Backward compatibility re-exports
 * New code should import from src/constants/*.ts directly
 */

// Re-export from modular constants
export * from './constants/index.js'

// Re-export model registration functions (these still live here for now)
export {
  registerIFlowModels,
  registerDynamicModels,
  registerAllModels,
  type IFlowModelConfig
} from './plugin/model-registry.js'

// Re-export types for backward compatibility
export type { IFlowAuthMethod } from './plugin/types.js'

/**
 * @deprecated Use individual constants from src/constants/*.ts
 * This object is kept for backward compatibility only
 */
export { IFLOW_CONSTANTS } from './constants/backward-compat.js'

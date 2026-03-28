/**
 * Debug Logger - Backward Compatibility Wrapper
 * 
 * This file re-exports from modularized logger modules for backward compatibility.
 * New code should import directly from specific modules:
 * - ./logger-core.js - Core logging functions
 * - ./logger-types.js - Type definitions
 * - ./logger-request.js - Request logging
 * - ./logger-iflow.js - iFlow message logging
 * - ./logger-tools.js - Tool call logging
 * - ./logger-session.js - Session logging
 * - ./logger-error.js - Error logging and contract validation
 */

// Re-export core
export {
  LOG_DIR,
  LOG_FILES,
  ensureLogDir,
  logLine,
  logJson,
  logEvent,
  logProxy,
} from './logger-core.js'

// Re-export types
export type {
  LogEventMeta,
  ToolContract,
  ToolContractMap,
  ToolCallSource,
  LogOpenAIRequestParams,
  LogIFlowInboundParams,
  LogIFlowOutboundParams,
  LogToolCallEmittedParams,
  LogToolResultReceivedParams,
  LogSessionParams,
  LogProcessingResultParams,
  LogErrorParams,
  LogToolBlockCheckParams,
  LogToolBlockedParams,
  LogNativeToolPassthroughParams,
  LogOpenCodeToolEmittedParams,
  LogToolMappingParams,
} from './logger-types.js'

// Re-export request logging
export { logOpenAIRequest } from './logger-request.js'

// Re-export iFlow logging
export { logIFlowInbound, logIFlowOutbound } from './logger-iflow.js'

// Re-export tool logging
export {
  logToolCallEmitted,
  logToolResultReceived,
  logToolBlockCheck,
  logToolBlocked,
  logNativeToolPassthrough,
  logOpenCodeToolEmitted,
  logToolMapping,
} from './logger-tools.js'

// Re-export session logging
export { logSession, logProcessingResult } from './logger-session.js'

// Re-export error logging and utilities
export {
  logError,
  buildToolContractMap,
  validateToolCallContract,
  generateTurnId,
  sanitizeForLog,
} from './logger-error.js'

/**
 * ACP Handler - Backward Compatibility Wrapper
 * 
 * This file re-exports from modularized handlers for backward compatibility.
 * New code should import directly from:
 * - ./acp-handler.js - Main handler
 * - ./session-manager.js - Session management
 * - ./stream-emitters.js - Stream emission
 * - ./tool-blocking.js - Tool blocking policy
 */

// Re-export main handler
export { handleACPStreamRequest } from './acp-handler.js'

// Re-export session management
export {
  cleanupACPClients,
  cleanupExpiredSessions,
  getOrCreateSession,
  initializeSessionIfNeeded,
  IFLOW_INTERNAL_TOOLS,
  SESSION_TTL_MS,
} from './session-manager.js'

// Re-export stream emitters
export {
  emitReasoningChunk,
  emitContentChunk,
  emitToolCallChunk,
  emitFinalDoneChunk,
  emitErrorChunk,
} from './stream-emitters.js'

// Re-export tool blocking
export {
  shouldBlockTool,
  getStrictModeBlockedTools,
  STRICT_MODE_BLOCKED_TOOLS,
} from './tool-blocking.js'

// Re-export utilities from acp-utils for backward compatibility
export {
  hashString,
  makeSessionKey,
  hashToolSchema,
  extractTextContent,
  buildConversationContext,
  buildOpenCodeCompatPrompt,
  buildTurnPrompt,
  formatToolResultForIFlow,
  normalizeToolCall,
  extractNativeACPToolCall,
  extractToolCallFromText,
  extractReasoning,
  extractACPText,
  isACPDoneMessage,
  processACPMessage,
} from './acp-utils.js'

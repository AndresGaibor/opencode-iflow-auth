/**
 * ACP Utils - Backward Compatibility Wrapper
 * 
 * This file re-exports from modularized utility modules for backward compatibility.
 * New code should import directly from specific modules:
 * - ./hash-utils.js - Hash utilities
 * - ./conversation.js - Conversation context builders
 * - ./prompt-builders.js - System prompt builders
 * - ./tool-normalization.js - Tool name/args normalization
 * - ./tool-extraction.js - Tool call extraction from messages
 * - ./tool-blocking.js - Tool blocking policy
 */

// Re-export hash utilities
export { hashString, makeSessionKey, hashToolSchema } from './hash-utils.js'

// Re-export conversation utilities
export { extractTextContent, buildConversationContext } from './conversation.js'

// Re-export prompt builders
export { buildOpenCodeCompatPrompt, buildTurnPrompt, formatToolResultForIFlow } from './prompt-builders.js'

// Re-export tool normalization
export { normalizeToolCall } from './tool-normalization.js'

// Re-export tool extraction
export {
  extractNativeACPToolCall,
  extractToolCallFromText,
  extractReasoning,
  extractACPText,
  isACPDoneMessage,
  processACPMessage,
} from './tool-extraction.js'

// Re-export tool blocking
export { shouldBlockTool, getStrictModeBlockedTools } from './tool-blocking.js'

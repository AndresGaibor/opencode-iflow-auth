/**
 * Type definitions for debug-logger module
 */

// ============================================================================
// BASE TYPES
// ============================================================================

/**
 * Log event metadata
 */
export interface LogEventMeta {
  ts?: string
  sessionKey?: string
  turnId?: string
  model?: string
  chatId?: string
  [key: string]: any
}

/**
 * Tool contract definition
 */
export interface ToolContract {
  required: string[]
  properties: string[]
}

/**
 * Map of tool contracts
 */
export type ToolContractMap = Map<string, ToolContract>

/**
 * Source classification for tool calls
 */
export type ToolCallSource = 'native_iflow' | 'mapped_opencode' | 'fallback_text' | 'unknown'

// ============================================================================
// LOG PARAMETER TYPES
// ============================================================================

/**
 * Parameters for logging OpenCode requests
 */
export interface LogOpenAIRequestParams {
  sessionKey: string
  turnId: string
  model: string
  request: {
    model: string
    stream?: boolean
    messages: Array<{ role: string; content?: any }>
    tools?: Array<{ function?: { name: string; parameters?: any } }>
  }
  cwd?: string
  workspaceRoot?: string
}

/**
 * Parameters for logging iFlow inbound messages
 */
export interface LogIFlowInboundParams {
  sessionKey: string
  turnId: string
  model: string
  message: any
  rawType: string
}

/**
 * Parameters for logging iFlow outbound messages
 */
export interface LogIFlowOutboundParams {
  sessionKey: string
  turnId: string
  model: string
  prompt: string
  hasAppendSystemPrompt: boolean
  context?: {
    systemMessagesCount?: number
    hasLatestToolResult?: boolean
    hasLatestUserMessage?: boolean
  }
}

/**
 * Parameters for logging tool calls emitted
 */
export interface LogToolCallEmittedParams {
  sessionKey: string
  turnId: string
  model: string
  chatId: string
  originalToolCall?: { name: string; args: any }
  normalizedToolCall: { name: string; args: any }
  source: ToolCallSource
  finishReason: string
}

/**
 * Parameters for logging tool results received
 */
export interface LogToolResultReceivedParams {
  sessionKey: string
  turnId: string
  model: string
  toolName: string
  toolCallId?: string
  output: string
  isError?: boolean
  outputLength: number
  formattedPrompt?: string
}

/**
 * Parameters for logging session events
 */
export interface LogSessionParams {
  sessionKey: string
  model: string
  action: 'created' | 'reused' | 'expired' | 'cleaned'
  turnId?: string
  toolSchemaHash?: string
}

/**
 * Parameters for logging processing results
 */
export interface LogProcessingResultParams {
  sessionKey: string
  turnId: string
  model: string
  resultType: 'tool_call' | 'content' | 'done' | 'noop' | 'tool_blocked'
  source?: 'native_acp' | 'textual_fallback' | 'native_iflow' | 'fallback_text'
  toolName?: string
  contentLength?: number
  hasReasoning?: boolean
}

/**
 * Parameters for logging errors
 */
export interface LogErrorParams {
  sessionKey?: string
  turnId?: string
  model?: string
  errorType: 'exception' | 'contract_mismatch' | 'permission_blocked' | 'validation_error' | 'tool_blocked' | 'other'
  message: string
  details?: Record<string, any>
}

/**
 * Parameters for logging tool block checks
 */
export interface LogToolBlockCheckParams {
  sessionKey: string
  turnId: string
  model: string
  toolNameOriginal: string
  argsOriginal?: Record<string, any>
  blockedByPolicy: boolean
  reason?: string
}

/**
 * Parameters for logging tool blocked events
 */
export interface LogToolBlockedParams {
  sessionKey: string
  turnId: string
  model: string
  toolNameOriginal: string
  argsOriginal: Record<string, any>
  reason: string
}

/**
 * Parameters for logging native tool passthrough
 */
export interface LogNativeToolPassthroughParams {
  sessionKey: string
  turnId: string
  model: string
  toolName: string
  args: Record<string, any>
}

/**
 * Parameters for logging OpenCode tool emitted
 */
export interface LogOpenCodeToolEmittedParams {
  sessionKey: string
  turnId: string
  model: string
  toolName: string
  args: Record<string, any>
  source: ToolCallSource
}

/**
 * Parameters for logging tool mapping
 */
export interface LogToolMappingParams {
  sessionKey: string
  turnId: string
  model: string
  source: ToolCallSource
  toolNameOriginal: string
  toolNameEmitted: string
  argsOriginal: Record<string, any>
  argsEmitted: Record<string, any>
  blockedByPolicy: boolean
}

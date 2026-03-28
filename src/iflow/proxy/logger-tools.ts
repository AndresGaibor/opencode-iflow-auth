/**
 * Tool call logging for ACP/iFlow
 * Logs tool calls emitted and results received
 */

import { logJson, LOG_FILES } from './logger-core.js'
import type {
  LogToolCallEmittedParams,
  LogToolResultReceivedParams,
  LogToolBlockCheckParams,
  LogToolBlockedParams,
  LogNativeToolPassthroughParams,
  LogOpenCodeToolEmittedParams,
  LogToolMappingParams,
} from './logger-types.js'
import { logError } from './logger-error.js'

// ============================================================================
// TOOL CALL LOGGERS
// ============================================================================

/**
 * Log tool call emitted towards OpenCode
 * Includes complete mapping for contract audit
 *
 * @param params - Tool call logging parameters
 */
export function logToolCallEmitted(params: LogToolCallEmittedParams): void {
  const { sessionKey, turnId, model, chatId, originalToolCall, normalizedToolCall, source, finishReason } = params

  // Determine the actual source classification
  const actualSource = source === 'native_iflow' ? 'native_iflow' : 'fallback_text'

  // Log the complete mapping
  logToolMapping({
    sessionKey,
    turnId,
    model,
    source: actualSource,
    toolNameOriginal: originalToolCall?.name || normalizedToolCall.name,
    toolNameEmitted: normalizedToolCall.name,
    argsOriginal: originalToolCall?.args || {},
    argsEmitted: normalizedToolCall.args,
    blockedByPolicy: false,
  })

  logJson(LOG_FILES.OPENAI_TOOL_CALLS, {
    ts: new Date().toISOString(),
    event: 'opencode_tool_call_emitted',
    sessionKey,
    turnId,
    model,
    chatId,
    // New required fields
    source: actualSource,
    tool_name_original: originalToolCall?.name,
    tool_name_emitted: normalizedToolCall.name,
    args_original: originalToolCall?.args,
    args_emitted: normalizedToolCall.args,
    blocked_by_policy: false,
    // Legacy fields for backward compatibility
    toolName: normalizedToolCall.name,
    args: normalizedToolCall.args,
    argsJson: JSON.stringify(normalizedToolCall.args),
    finishReason,
    originalName: originalToolCall?.name,
    originalArgs: originalToolCall?.args,
  })
}

/**
 * Log tool result received from OpenCode
 *
 * @param params - Tool result logging parameters
 */
export function logToolResultReceived(params: LogToolResultReceivedParams): void {
  const { sessionKey, turnId, model, toolName, toolCallId, output, isError, outputLength, formattedPrompt } = params

  logJson(LOG_FILES.OPENAI_TOOL_RESULTS, {
    ts: new Date().toISOString(),
    event: 'opencode_tool_result_received',
    sessionKey,
    turnId,
    model,
    toolName,
    toolCallId,
    outputLength,
    isError,
    outputPreview: output.substring(0, 500),
    formattedPromptPreview: formattedPrompt?.substring(0, 500),
    // Full output for debugging (may be large)
    _fullOutput: output.length > 10000 ? output.substring(0, 10000) + '...[truncated]' : output,
  })
}

// ============================================================================
// TOOL POLICY LOGGERS
// ============================================================================

/**
 * Log when a tool blocking check is performed
 *
 * @param params - Tool block check parameters
 */
export function logToolBlockCheck(params: LogToolBlockCheckParams): void {
  const { sessionKey, turnId, model, toolNameOriginal, argsOriginal, blockedByPolicy, reason } = params

  logJson(LOG_FILES.TOOL_POLICY, {
    ts: new Date().toISOString(),
    event: 'iflow_tool_block_check',
    sessionKey,
    turnId,
    model,
    toolNameOriginal,
    argsOriginal,
    blockedByPolicy,
    reason,
  })
}

/**
 * Log when a tool is actually blocked by policy
 *
 * @param params - Tool blocked parameters
 */
export function logToolBlocked(params: LogToolBlockedParams): void {
  const { sessionKey, turnId, model, toolNameOriginal, argsOriginal, reason } = params

  logJson(LOG_FILES.TOOL_POLICY, {
    ts: new Date().toISOString(),
    event: 'iflow_tool_block_failed',
    sessionKey,
    turnId,
    model,
    toolNameOriginal,
    argsOriginal,
    blockedByPolicy: true,
    reason,
  })

  // Also log to errors for visibility
  logError({
    sessionKey,
    turnId,
    model,
    errorType: 'tool_blocked',
    message: `Tool '${toolNameOriginal}' blocked by policy: ${reason}`,
    details: { toolNameOriginal, argsOriginal, reason },
  })
}

/**
 * Log when a native iFlow tool is allowed to pass through
 *
 * @param params - Native tool passthrough parameters
 */
export function logNativeToolPassthrough(params: LogNativeToolPassthroughParams): void {
  const { sessionKey, turnId, model, toolName, args } = params

  logJson(LOG_FILES.TOOL_POLICY, {
    ts: new Date().toISOString(),
    event: 'iflow_native_tool_passthrough',
    sessionKey,
    turnId,
    model,
    toolName,
    args,
    blockedByPolicy: false,
  })
}

/**
 * Log when an OpenCode tool is emitted
 *
 * @param params - OpenCode tool emitted parameters
 */
export function logOpenCodeToolEmitted(params: LogOpenCodeToolEmittedParams): void {
  const { sessionKey, turnId, model, toolName, args, source } = params

  logJson(LOG_FILES.TOOL_POLICY, {
    ts: new Date().toISOString(),
    event: 'opencode_tool_emitted',
    sessionKey,
    turnId,
    model,
    toolName,
    args,
    source,
    blockedByPolicy: false,
  })
}

/**
 * Log the complete tool mapping transformation
 *
 * @param params - Tool mapping parameters
 */
export function logToolMapping(params: LogToolMappingParams): void {
  const { sessionKey, turnId, model, source, toolNameOriginal, toolNameEmitted, argsOriginal, argsEmitted, blockedByPolicy } = params

  logJson(LOG_FILES.TOOL_MAPPING, {
    ts: new Date().toISOString(),
    event: 'tool_mapping_applied',
    sessionKey,
    turnId,
    model,
    source,
    toolNameOriginal,
    toolNameEmitted,
    argsOriginal,
    argsEmitted,
    blockedByPolicy,
  })
}

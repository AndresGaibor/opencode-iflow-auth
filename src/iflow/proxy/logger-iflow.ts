/**
 * iFlow message logging
 * Logs messages sent to and received from iFlow
 */

import { logJson, LOG_FILES } from './logger-core.js'
import type { LogIFlowInboundParams, LogIFlowOutboundParams } from './logger-types.js'

// ============================================================================
// IFLOW MESSAGE LOGGERS
// ============================================================================

/**
 * Log raw iFlow inbound message (before processing)
 *
 * @param params - Inbound message logging parameters
 */
export function logIFlowInbound(params: LogIFlowInboundParams): void {
  const { sessionKey, turnId, model, message, rawType } = params

  logJson(LOG_FILES.IFLOW_INBOUND, {
    ts: new Date().toISOString(),
    event: 'iflow_message_received_raw',
    sessionKey,
    turnId,
    model,
    rawType,
    hasToolName: !!message?.toolName,
    hasToolCall: !!message?.toolCall,
    hasChunkText: !!message?.chunk?.text,
    hasChunkThought: !!message?.chunk?.thought,
    messageType: message?.type || message?.messageType,
    // Full message for debugging
    _raw: message,
  })
}

/**
 * Log prompt/message sent to iFlow
 *
 * @param params - Outbound message logging parameters
 */
export function logIFlowOutbound(params: LogIFlowOutboundParams): void {
  const { sessionKey, turnId, model, prompt, hasAppendSystemPrompt, context } = params

  logJson(LOG_FILES.IFLOW_OUTBOUND, {
    ts: new Date().toISOString(),
    event: 'iflow_message_sent',
    sessionKey,
    turnId,
    model,
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 500),
    hasAppendSystemPrompt,
    context,
    // Full prompt for debugging
    _fullPrompt: prompt,
  })
}

/**
 * Session logging for ACP/iFlow
 * Logs session lifecycle events
 */

import { logJson, LOG_FILES } from './logger-core.js'
import type { LogSessionParams, LogProcessingResultParams } from './logger-types.js'

// ============================================================================
// SESSION LOGGERS
// ============================================================================

/**
 * Log session creation/update/cleanup
 *
 * @param params - Session logging parameters
 */
export function logSession(params: LogSessionParams): void {
  const { sessionKey, model, action, turnId, toolSchemaHash } = params

  logJson(LOG_FILES.SESSION_MAP, {
    ts: new Date().toISOString(),
    event: `session_${action}`,
    sessionKey,
    turnId,
    model,
    toolSchemaHash,
  })
}

/**
 * Log message processing result
 *
 * @param params - Processing result parameters
 */
export function logProcessingResult(params: LogProcessingResultParams): void {
  logJson(LOG_FILES.PROXY.replace('.log', '-processing.ndjson'), {
    ts: new Date().toISOString(),
    event: 'iflow_message_processed',
    ...params,
  })
}

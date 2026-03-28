/**
 * Request logging for ACP/iFlow
 * Logs OpenCode requests received
 */

import { logJson, LOG_FILES } from './logger-core.js'
import type { LogOpenAIRequestParams } from './logger-types.js'

// ============================================================================
// REQUEST LOGGERS
// ============================================================================

/**
 * Log OpenCode request received
 * Includes full request with tools schema for contract audit
 *
 * @param params - Request logging parameters
 */
export function logOpenAIRequest(params: LogOpenAIRequestParams): void {
  const { sessionKey, turnId, model, request, cwd, workspaceRoot } = params

  // Extract tool schemas for contract audit
  const toolSchemas: Record<string, { required: string[]; properties: string[] }> = {}
  if (request.tools) {
    for (const tool of request.tools) {
      if (tool.function?.name && tool.function.parameters) {
        toolSchemas[tool.function.name] = {
          required: tool.function.parameters.required || [],
          properties: Object.keys(tool.function.parameters.properties || {}),
        }
      }
    }
  }

  logJson(LOG_FILES.OPENAI_REQUESTS, {
    ts: new Date().toISOString(),
    event: 'openai_request_received',
    sessionKey,
    turnId,
    model,
    request: {
      model: request.model,
      stream: request.stream,
      messageCount: request.messages.length,
      messageRoles: request.messages.map((m) => m.role),
      toolCount: request.tools?.length || 0,
      toolSchemas,
    },
    cwd,
    workspaceRoot,
    // Full request for debugging (can be large)
    _fullRequest: request,
  })
}

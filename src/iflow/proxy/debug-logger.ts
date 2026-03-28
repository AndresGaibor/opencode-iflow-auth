/**
 * debug-logger.ts - Structured NDJSON logging for ACP/iFlow observability
 * 
 * Logs to ~/.config/opencode/iflow-logs/
 * 
 * Files:
 * - acp-proxy.log          : Human-readable summary log (legacy)
 * - openai-requests.ndjson : Full requests from OpenCode (includes tools schema)
 * - iflow-inbound.ndjson   : Raw messages received from iFlow (before processing)
 * - iflow-outbound.ndjson  : Prompts/messages sent to iFlow
 * - openai-tool-calls.ndjson : Tool calls emitted towards OpenCode
 * - openai-tool-results.ndjson : Tool results received from OpenCode
 * - session-map.ndjson     : Session metadata (sessionKey, turnId, model, timestamps)
 * - errors.ndjson          : Errors and contract mismatches
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'

// ============================================================================
// CONFIGURATION
// ============================================================================

export const LOG_DIR = path.join(os.homedir(), '.config', 'opencode', 'iflow-logs')

export const LOG_FILES = {
  PROXY: 'acp-proxy.log',
  OPENAI_REQUESTS: 'openai-requests.ndjson',
  IFLOW_INBOUND: 'iflow-inbound.ndjson',
  IFLOW_OUTBOUND: 'iflow-outbound.ndjson',
  OPENAI_TOOL_CALLS: 'openai-tool-calls.ndjson',
  OPENAI_TOOL_RESULTS: 'openai-tool-results.ndjson',
  SESSION_MAP: 'session-map.ndjson',
  ERRORS: 'errors.ndjson',
} as const

// Ensure log directory exists
export function ensureLogDir(): string {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
  return LOG_DIR
}

// ============================================================================
// TYPES
// ============================================================================

export interface LogEventMeta {
  ts?: string
  sessionKey?: string
  turnId?: string
  model?: string
  chatId?: string
  [key: string]: any
}

export interface ToolContract {
  required: string[]
  properties: string[]
}

export type ToolContractMap = Map<string, ToolContract>

// ============================================================================
// CORE LOGGING FUNCTIONS
// ============================================================================

/**
 * Append a line to a log file (creates file if doesn't exist)
 */
export function logLine(filename: string, text: string): void {
  ensureLogDir()
  const filePath = path.join(LOG_DIR, filename)
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${text}\n`
  try {
    fs.appendFileSync(filePath, line)
  } catch (e) {
    console.error(`[debug-logger] Failed to write to ${filename}`, e)
  }
}

/**
 * Append a JSON object as NDJSON line
 */
export function logJson(filename: string, payload: unknown): void {
  ensureLogDir()
  const filePath = path.join(LOG_DIR, filename)
  try {
    const line = JSON.stringify(payload) + '\n'
    fs.appendFileSync(filePath, line)
  } catch (e) {
    console.error(`[debug-logger] Failed to write JSON to ${filename}`, e)
  }
}

/**
 * Log a structured event with standard metadata
 */
export function logEvent(
  event: string,
  meta: LogEventMeta,
  payload?: unknown
): void {
  const entry = {
    ts: meta.ts || new Date().toISOString(),
    event,
    sessionKey: meta.sessionKey,
    turnId: meta.turnId,
    model: meta.model,
    chatId: meta.chatId,
    ...(payload !== undefined ? { payload } : {}),
    ...Object.fromEntries(
      Object.entries(meta).filter(
        ([k]) => !['ts', 'event', 'sessionKey', 'turnId', 'model', 'chatId'].includes(k)
      )
    ),
  }
  logJson(LOG_FILES.PROXY.replace('.log', `-${event}.ndjson`), entry)
}

/**
 * Log to the main proxy log (human-readable, backward compatible)
 */
export function logProxy(text: string): void {
  logLine(LOG_FILES.PROXY, text)
}

// ============================================================================
// SPECIALIZED LOGGERS
// ============================================================================

/**
 * Log OpenCode request received
 */
export function logOpenAIRequest(params: {
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
}): void {
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
      messageRoles: request.messages.map(m => m.role),
      toolCount: request.tools?.length || 0,
      toolSchemas,
    },
    cwd,
    workspaceRoot,
    // Full request for debugging (can be large)
    _fullRequest: request,
  })
}

/**
 * Log raw iFlow inbound message (before processing)
 */
export function logIFlowInbound(params: {
  sessionKey: string
  turnId: string
  model: string
  message: any
  rawType: string
}): void {
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
 */
export function logIFlowOutbound(params: {
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
}): void {
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

/**
 * Log tool call emitted towards OpenCode
 */
export function logToolCallEmitted(params: {
  sessionKey: string
  turnId: string
  model: string
  chatId: string
  originalToolCall?: { name: string; args: any }
  normalizedToolCall: { name: string; args: any }
  source: 'native_acp' | 'textual_fallback' | 'unknown'
  finishReason: string
}): void {
  const { sessionKey, turnId, model, chatId, originalToolCall, normalizedToolCall, source, finishReason } = params
  
  logJson(LOG_FILES.OPENAI_TOOL_CALLS, {
    ts: new Date().toISOString(),
    event: 'opencode_tool_call_emitted',
    sessionKey,
    turnId,
    model,
    chatId,
    toolName: normalizedToolCall.name,
    args: normalizedToolCall.args,
    argsJson: JSON.stringify(normalizedToolCall.args),
    source,
    finishReason,
    originalName: originalToolCall?.name,
    originalArgs: originalToolCall?.args,
  })
}

/**
 * Log tool result received from OpenCode
 */
export function logToolResultReceived(params: {
  sessionKey: string
  turnId: string
  model: string
  toolName: string
  toolCallId?: string
  output: string
  isError?: boolean
  outputLength: number
  formattedPrompt?: string
}): void {
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

/**
 * Log session creation/update
 */
export function logSession(params: {
  sessionKey: string
  model: string
  action: 'created' | 'reused' | 'expired' | 'cleaned'
  turnId?: string
  toolSchemaHash?: string
}): void {
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
 */
export function logProcessingResult(params: {
  sessionKey: string
  turnId: string
  model: string
  resultType: 'tool_call' | 'content' | 'done' | 'noop'
  source?: 'native_acp' | 'textual_fallback'
  toolName?: string
  contentLength?: number
  hasReasoning?: boolean
}): void {
  logJson(LOG_FILES.PROXY.replace('.log', '-processing.ndjson'), {
    ts: new Date().toISOString(),
    event: 'iflow_message_processed',
    ...params,
  })
}

/**
 * Log error or contract mismatch
 */
export function logError(params: {
  sessionKey?: string
  turnId?: string
  model?: string
  errorType: 'exception' | 'contract_mismatch' | 'permission_blocked' | 'validation_error' | 'other'
  message: string
  details?: Record<string, any>
}): void {
  const { sessionKey, turnId, model, errorType, message, details } = params
  
  logJson(LOG_FILES.ERRORS, {
    ts: new Date().toISOString(),
    event: 'error',
    errorType,
    sessionKey,
    turnId,
    model,
    message,
    details,
  })
}

// ============================================================================
// CONTRACT AUDIT UTILITIES
// ============================================================================

/**
 * Extract tool contracts from OpenCode tools array
 */
export function buildToolContractMap(tools: Array<{ function?: { name: string; parameters?: any } }>): ToolContractMap {
  const map: ToolContractMap = new Map()
  
  if (!tools) return map
  
  for (const tool of tools) {
    if (tool.function?.name && tool.function.parameters) {
      map.set(tool.function.name, {
        required: tool.function.parameters.required || [],
        properties: Object.keys(tool.function.parameters.properties || {}),
      })
    }
  }
  
  return map
}

/**
 * Validate tool call against contract and log mismatches
 */
export function validateToolCallContract(params: {
  toolName: string
  args: Record<string, any>
  contractMap: ToolContractMap
  sessionKey?: string
  turnId?: string
  model?: string
}): { valid: boolean; issues: string[] } {
  const { toolName, args, contractMap, sessionKey, turnId, model } = params
  const issues: string[] = []
  
  const contract = contractMap.get(toolName)
  
  if (!contract) {
    // Unknown tool - can't validate
    return { valid: true, issues: [] }
  }
  
  // Check required fields
  for (const requiredField of contract.required) {
    if (args[requiredField] === undefined || args[requiredField] === '') {
      issues.push(`Missing required field: ${requiredField}`)
    }
  }
  
  // Check for common field name mismatches
  const commonMismatches: Record<string, string[]> = {
    // If schema expects filePath but we have path
    filePath: ['path', 'file', 'filename'],
    // If schema expects path but we have filePath
    path: ['filePath', 'file', 'filename'],
    // If schema expects command but we have script
    command: ['script', 'cmd'],
  }
  
  for (const [expectedField, aliases] of Object.entries(commonMismatches)) {
    if (contract.required.includes(expectedField) && !args[expectedField]) {
      for (const alias of aliases) {
        if (args[alias] !== undefined) {
          issues.push(`Field mismatch: schema expects '${expectedField}' but got '${alias}'`)
          break
        }
      }
    }
  }
  
  if (issues.length > 0) {
    logError({
      sessionKey,
      turnId,
      model,
      errorType: 'contract_mismatch',
      message: `Tool '${toolName}' has contract issues`,
      details: {
        toolName,
        expectedRequired: contract.required,
        actualArgs: args,
        issues,
      },
    })
  }
  
  return { valid: issues.length === 0, issues }
}

// ============================================================================
// TURN ID GENERATION
// ============================================================================

/**
 * Generate a unique turn ID for request correlation
 */
export function generateTurnId(): string {
  return `turn_${Date.now()}_${randomUUID().substring(0, 8)}`
}

// ============================================================================
// SANITIZATION
// ============================================================================

/**
 * Sanitize a value for logging (remove sensitive data)
 */
export function sanitizeForLog(value: unknown, maxDepth: number = 5): unknown {
  if (maxDepth <= 0) return '[max depth reached]'
  
  if (value === null || value === undefined) {
    return value
  }
  
  if (typeof value === 'string') {
    // Redact potential secrets
    if (value.match(/^(sk-|api[_-]?key|token|password|secret|bearer)/i)) {
      return '[REDACTED]'
    }
    // Truncate very long strings
    if (value.length > 10000) {
      return value.substring(0, 10000) + '...[truncated]'
    }
    return value
  }
  
  if (typeof value !== 'object') {
    return value
  }
  
  if (Array.isArray(value)) {
    return value.map(v => sanitizeForLog(v, maxDepth - 1))
  }
  
  const sanitized: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    // Redact sensitive keys
    if (key.match(/^(api[_-]?key|token|password|secret|authorization|bearer)/i)) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = sanitizeForLog(val, maxDepth - 1)
    }
  }
  return sanitized
}

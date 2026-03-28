/**
 * Core logging functions for ACP/iFlow observability
 * Base logging utilities used by all other logger modules
 */

import fs from 'fs'
import path from 'path'
import os from 'os'

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
  TOOL_POLICY: 'tool-policy.ndjson',
  TOOL_MAPPING: 'tool-mapping.ndjson',
} as const

// ============================================================================
// TYPES
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

export interface ToolContract {
  required: string[]
  properties: string[]
}

export type ToolContractMap = Map<string, ToolContract>

// ============================================================================
// CORE LOGGING FUNCTIONS
// ============================================================================

/**
 * Ensure log directory exists
 * @returns Log directory path
 */
export function ensureLogDir(): string {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
  return LOG_DIR
}

/**
 * Append a line to a log file (creates file if doesn't exist)
 *
 * @param filename - Log file name
 * @param text - Text line to write
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
 *
 * @param filename - Log file name
 * @param payload - JSON payload to write
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
 *
 * @param event - Event name
 * @param meta - Event metadata
 * @param payload - Optional payload
 */
export function logEvent(event: string, meta: LogEventMeta, payload?: unknown): void {
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
 *
 * @param text - Text to log
 */
export function logProxy(text: string): void {
  logLine(LOG_FILES.PROXY, text)
}

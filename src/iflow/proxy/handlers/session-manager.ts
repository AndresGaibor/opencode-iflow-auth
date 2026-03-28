/**
 * Session Manager for ACP/iFlow connections
 * Handles session creation, reuse, and cleanup
 */

import { IFlowClient, PermissionMode } from '@iflow-ai/iflow-cli-sdk'
import { log } from '../utils.js'
import type { SessionState } from '../types.js'
import { hashToolSchema } from './hash-utils.js'
import { buildConversationContext } from './conversation.js'
import { buildOpenCodeCompatPrompt } from './prompt-builders.js'

// ============================================================================
// CONSTANTS
// ============================================================================

export const SESSION_TTL_MS = 1000 * 60 * 30 // 30 minutes

// ============================================================================
// INTERNAL TOOLS LIST
// ============================================================================

// Tools internas de iflow que deben ser desactivadas para usar las de OpenCode
// CRITICAL: This list must match the blocking policy in blocking-policy.ts shouldBlockTool()
export const IFLOW_INTERNAL_TOOLS = [
  // File operations - map to OpenCode tools
  'read_text_file',
  'read_file',
  'read_multiple_files',
  'write_to_file',
  'write_file',
  'list_directory',
  'list_directory_with_sizes',
  'directory_tree',
  // Execution
  'execute_command',
  'run_command',
  'run_shell_command',
  // File system operations
  'create_directory',
  'move_file',
  'delete_file',
  // Search
  'search_files',
  'file_search',
  // Dangerous - should always be blocked
  'computer_use',
  'bash',
  'sh',
  'python',
  'edit',
  'sed',
  'grep',
  // CRITICAL: Subagents cause invisible work inside iFlow
  'task',
  // Task management - should map to OpenCode todowrite
  'todo_write',
  'todo_read',
]

// ============================================================================
// SESSION STORE
// ============================================================================

const acpSessions = new Map<string, SessionState>()

// ============================================================================
// SESSION CLEANUP
// ============================================================================

/**
 * Cleanup expired sessions from the store
 * Disconnects clients and removes expired sessions
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now()
  for (const [key, session] of acpSessions.entries()) {
    if (now - session.lastActivityAt > SESSION_TTL_MS) {
      try {
        session.client?.disconnect?.()
      } catch {
        // Ignore disconnect errors
      }
      acpSessions.delete(key)
      logSession({
        sessionKey: key,
        model: session.model,
        action: 'expired',
      })
      logProxy(`[SESSION CLEANUP] Removed expired session: ${key.substring(0, 8)}...`)
    }
  }
}

/**
 * Clean up all sessions (on process exit)
 */
export async function cleanupACPClients(): Promise<void> {
  logProxy(`[CLEANUP] Cleaning up ${acpSessions.size} sessions`)
  for (const [key, session] of acpSessions) {
    logSession({
      sessionKey: key,
      model: session.model,
      action: 'cleaned',
    })
    try {
      await session.client.disconnect()
    } catch {
      // Ignore disconnect errors
    }
  }
  acpSessions.clear()
}

// Register cleanup handlers
process.on('SIGINT', cleanupACPClients)
process.on('SIGTERM', cleanupACPClients)

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Get existing session or create a new one
 * @param params - Session creation parameters
 * @returns SessionState instance
 */
export async function getOrCreateSession({
  sessionKey,
  model,
  tools,
  conversation,
  turnId,
}: {
  sessionKey: string
  model: string
  tools: any[]
  conversation: ReturnType<typeof buildConversationContext>
  turnId: string
}): Promise<SessionState> {
  const existing = acpSessions.get(sessionKey)
  if (existing && existing.client?.isConnected?.()) {
    existing.lastActivityAt = Date.now()
    logSession({
      sessionKey,
      model,
      action: 'reused',
      turnId,
      toolSchemaHash: existing.toolSchemaHash,
    })
    logProxy(`[SESSION] Reusing session: ${sessionKey.substring(0, 8)}... model=${model}`)
    return existing
  }

  logSession({
    sessionKey,
    model,
    action: 'created',
    turnId,
  })
  logProxy(`[SESSION] Creating new session: ${sessionKey.substring(0, 8)}... model=${model}`)

  const compatPrompt = buildOpenCodeCompatPrompt(tools)

  const client = new IFlowClient({
    permissionMode: PermissionMode.MANUAL,
    autoStartProcess: true,
    logLevel: 'ERROR',
    sessionSettings: {
      disallowed_tools: IFLOW_INTERNAL_TOOLS,
      append_system_prompt: compatPrompt,
    },
  })

  await client.connect()

  try {
    await client.config.set('model', model)
  } catch (err) {
    logError({
      sessionKey,
      turnId,
      model,
      errorType: 'other',
      message: `Could not set model: ${err}`,
    })
    logProxy(`[SESSION] Warning: Could not set model: ${err}`)
  }

  const session: SessionState = {
    sessionKey,
    model,
    client,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    initialized: false,
    toolSchemaHash: hashToolSchema(tools),
  }

  acpSessions.set(sessionKey, session)
  logProxy(`[SESSION] Session created and stored: ${sessionKey.substring(0, 8)}...`)

  return session
}

/**
 * Initialize session if not already initialized
 * Injects system context on first turn
 */
export async function initializeSessionIfNeeded({
  session,
  conversation,
}: {
  session: SessionState
  conversation: ReturnType<typeof buildConversationContext>
}): Promise<void> {
  if (session.initialized) return

  // Inject system context on first turn
  const systemBlock = conversation.systemMessages.join('\n\n')

  if (systemBlock.trim()) {
    logProxy(`[SESSION INIT] Injecting system context (${systemBlock.length} chars)`)
    // System messages are already included via append_system_prompt in session settings
  }

  session.initialized = true
  logProxy(`[SESSION INIT] Session initialized: ${session.sessionKey.substring(0, 8)}...`)
}

// ============================================================================
// LOGGING HELPERS
// ============================================================================

function logProxy(text: string): void {
  log(`[ACP Session] ${text}`)
}

function logSession(params: {
  sessionKey: string
  model: string
  action: 'created' | 'reused' | 'expired' | 'cleaned'
  turnId?: string
  toolSchemaHash?: string
}): void {
  // Import dynamically to avoid circular dependency
  import('../debug-logger.js').then(({ logSession: logSessionFn }) => {
    logSessionFn(params)
  })
}

function logError(params: {
  sessionKey?: string
  turnId?: string
  model?: string
  errorType: 'exception' | 'other' | 'contract_mismatch' | 'permission_blocked' | 'validation_error' | 'tool_blocked'
  message: string
  details?: Record<string, any>
}): void {
  // Import dynamically to avoid circular dependency
  import('../debug-logger.js').then(({ logError: logErrorFn }) => {
    logErrorFn(params)
  })
}

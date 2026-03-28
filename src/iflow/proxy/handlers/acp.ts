import { ServerResponse } from 'http'
import { randomUUID } from 'crypto'
import { IFlowClient, PermissionMode, MessageType } from '@iflow-ai/iflow-cli-sdk'
import * as logger from '../../../plugin/logger.js'
import { log } from '../utils.js'
import type { 
  ChatCompletionRequest, 
  StreamChunk, 
  SessionState, 
  NormalizedToolCall,
} from '../types.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Import pure functions from acp-utils.ts
import {
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
  SESSION_TTL_MS,
} from './acp-utils.js'

// Re-export for testing
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
  SESSION_TTL_MS,
}

// User requested debug logs in ~/.config/opencode/iflow-logs
const LOG_DIR = path.join(os.homedir(), '.config', 'opencode', 'iflow-logs')
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}
const ACP_LOG_FILE = path.join(LOG_DIR, 'acp-proxy.log')

function fileLog(message: string) {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${message}\n`
  try {
    fs.appendFileSync(ACP_LOG_FILE, line)
  } catch (e) {
    console.error('Failed to write to acp-proxy.log', e)
  }
}

// ============================================================================
// SESSION STORE
// ============================================================================

const acpSessions = new Map<string, SessionState>()

function cleanupExpiredSessions(): void {
  const now = Date.now()
  for (const [key, session] of acpSessions.entries()) {
    if (now - session.lastActivityAt > SESSION_TTL_MS) {
      try {
        session.client?.disconnect?.()
      } catch {}
      acpSessions.delete(key)
      fileLog(`[SESSION CLEANUP] Removed expired session: ${key.substring(0, 8)}...`)
    }
  }
}

// Tools internas de iflow que deben ser desactivadas para usar las de OpenCode
const IFLOW_INTERNAL_TOOLS = [
  'read_text_file',
  'read_multiple_files',
  'write_to_file',
  'list_directory',
  'list_directory_with_sizes',
  'directory_tree',
  'execute_command',
  'run_command',
  'run_shell_command',
  'create_directory',
  'move_file',
  'delete_file',
  'search_files',
  'file_search',
  'computer_use',
  'bash',
  'sh',
  'python',
  'edit',
  'sed',
  'grep'
]

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

async function getOrCreateSession({
  sessionKey,
  model,
  tools,
  conversation,
}: {
  sessionKey: string
  model: string
  tools: any[]
  conversation: ReturnType<typeof buildConversationContext>
}): Promise<SessionState> {
  const existing = acpSessions.get(sessionKey)
  if (existing && existing.client?.isConnected?.()) {
    existing.lastActivityAt = Date.now()
    fileLog(`[SESSION] Reusing session: ${sessionKey.substring(0, 8)}... model=${model}`)
    return existing
  }

  fileLog(`[SESSION] Creating new session: ${sessionKey.substring(0, 8)}... model=${model}`)
  
  const compatPrompt = buildOpenCodeCompatPrompt(tools)
  
  const client = new IFlowClient({
    permissionMode: PermissionMode.MANUAL,
    autoStartProcess: true,
    logLevel: 'ERROR',
    sessionSettings: {
      disallowed_tools: IFLOW_INTERNAL_TOOLS,
      append_system_prompt: compatPrompt,
    }
  })
  
  await client.connect()
  
  try {
    await client.config.set('model', model)
  } catch (err) {
    fileLog(`[SESSION] Warning: Could not set model: ${err}`)
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
  fileLog(`[SESSION] Session created and stored: ${sessionKey.substring(0, 8)}...`)
  
  return session
}

async function initializeSessionIfNeeded({
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
    fileLog(`[SESSION INIT] Injecting system context (${systemBlock.length} chars)`)
    // System messages are already included via append_system_prompt in session settings
  }

  session.initialized = true
  fileLog(`[SESSION INIT] Session initialized: ${session.sessionKey.substring(0, 8)}...`)
}

// ============================================================================
// STREAM EMITTERS
// ============================================================================

function emitReasoningChunk(res: ServerResponse, chatId: string, created: number, model: string, reasoning: string) {
  if (!reasoning) return
  const chunk: StreamChunk = {
    id: chatId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{
      index: 0,
      delta: { role: 'assistant', reasoning_content: reasoning, thought: reasoning } as any,
      finish_reason: null
    }]
  }
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
}

function emitContentChunk(res: ServerResponse, chatId: string, created: number, model: string, content: string) {
  if (!content) return
  const chunk: StreamChunk = {
    id: chatId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{
      index: 0,
      delta: { content },
      finish_reason: null
    }]
  }
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
}

function emitToolCallChunk(res: ServerResponse, chatId: string, created: number, model: string, toolCall: NormalizedToolCall) {
  const openAIToolCall = {
    index: 0,
    id: `call_${randomUUID()}`,
    type: 'function' as const,
    function: {
      name: toolCall.name,
      arguments: JSON.stringify(toolCall.args)
    }
  }
  
  const chunk: StreamChunk = {
    id: chatId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{
      index: 0,
      delta: { role: 'assistant', tool_calls: [openAIToolCall] } as any,
      finish_reason: 'tool_calls'
    }]
  }
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
}

function emitFinalDoneChunk(res: ServerResponse, chatId: string, created: number, model: string, reason: string = 'stop') {
  const chunk: StreamChunk = {
    id: chatId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{
      index: 0,
      delta: {},
      finish_reason: reason === 'max_tokens' ? 'length' : 'stop'
    }]
  }
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function handleACPStreamRequest(
  request: ChatCompletionRequest,
  res: ServerResponse,
  enableLog: boolean
): Promise<void> {
  // Cleanup expired sessions first
  cleanupExpiredSessions()

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  const chatId = `iflow-${randomUUID()}`
  const created = Math.floor(Date.now() / 1000)
  const model = request.model
  const tools = request.tools || []

  // Build session key from conversation context
  const sessionKey = makeSessionKey(request)
  const conversation = buildConversationContext(request)

  fileLog(`[REQ] sessionKey=${sessionKey.substring(0, 8)}... model=${model} msgCount=${request.messages.length}`)

  // Get or create session
  let session: SessionState
  try {
    session = await getOrCreateSession({
      sessionKey,
      model,
      tools,
      conversation,
    })
  } catch (error: any) {
    fileLog(`[ERROR] Failed to create session: ${error.message}`)
    emitFinalDoneChunk(res, chatId, created, model)
    return
  }

  // Update session activity
  session.lastActivityAt = Date.now()

  // Initialize session if needed
  await initializeSessionIfNeeded({ session, conversation })

  // Build turn prompt
  const turnPrompt = buildTurnPrompt({ conversation, requestBody: request })
  
  fileLog(`[TURN] Sending: ${turnPrompt.substring(0, 150)}...`)
  if (enableLog) logger.log(`[IFlowACP] Sending: ${turnPrompt.substring(0, 100)}...`)

  // State for streaming
  const state = {
    reasoningBuffer: '',
    contentBuffer: '',
    emittedToolCall: false,
    finished: false,
  }

  try {
    await session.client.sendMessage(turnPrompt)

    for await (const message of session.client.receiveMessages()) {
      if (state.finished) break

      const result = processACPMessage(message)

      // Emit reasoning if present
      if (result.reasoning) {
        state.reasoningBuffer += result.reasoning
        emitReasoningChunk(res, chatId, created, model, result.reasoning)
      }

      switch (result.type) {
        case 'tool_call':
          fileLog(`[TOOL CALL] ${result.toolCall.name} -> ${JSON.stringify(result.toolCall.args)}`)
          emitToolCallChunk(res, chatId, created, model, result.toolCall)
          state.emittedToolCall = true
          state.finished = true
          return // Stop processing - OpenCode will execute the tool

        case 'content':
          state.contentBuffer += result.content
          // Check for inline tool call markers in content
          if (result.content.includes('<<USA_TOOL>>')) {
            // Don't emit content that contains tool markers - will be extracted
          } else {
            emitContentChunk(res, chatId, created, model, result.content)
          }
          break

        case 'done':
          state.finished = true
          break

        case 'noop':
          // Handle other message types
          if (message.type === MessageType.ASK_USER_QUESTIONS) {
            const askMsg = message as any
            if (askMsg.questions && askMsg.questions.length > 0) {
              const answers: Record<string, string> = {}
              for (const q of askMsg.questions) {
                if (q.options && q.options.length > 0) {
                  answers[q.header] = q.options[0].label
                }
              }
              session.client.respondToAskUserQuestions(answers).catch(() => {})
            }
          } else if (message.type === MessageType.EXIT_PLAN_MODE) {
            session.client.respondToExitPlanMode(true).catch(() => {})
          } else if (message.type === MessageType.PERMISSION_REQUEST) {
            // Block internal tool execution - delegate to OpenCode
            const permMsg = message as any
            fileLog(`[PERMISSION] Blocking: ${JSON.stringify(permMsg)}`)
            
            if (permMsg.options && permMsg.options.length > 0) {
              const denyOption = permMsg.options.find(
                (o: any) => o.type === 'deny' || o.label?.toLowerCase().includes('deny')
              )
              if (denyOption) {
                session.client.respondToToolConfirmation(permMsg.requestId, denyOption.optionId).catch(() => {})
              }
            }
          } else if (message.type === MessageType.ERROR) {
            const errorMsg = message as any
            fileLog(`[ERROR] ACP Error: ${errorMsg.message}`)
          }
          break
      }
    }

    // Natural finish
    if (!state.emittedToolCall) {
      fileLog(`[STREAM END] Natural finish, content length: ${state.contentBuffer.length}`)
      emitFinalDoneChunk(res, chatId, created, model)
    }

  } catch (error: any) {
    fileLog(`[EXCEPTION] ${error.message}`)
    
    if (!state.emittedToolCall) {
      const errorChunk: StreamChunk = {
        id: chatId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: { content: `Error: ${error.message}` },
          finish_reason: 'stop'
        }]
      }
      res.write(`data: ${JSON.stringify(errorChunk)}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
}

// ============================================================================
// CLEANUP
// ============================================================================

export async function cleanupACPClients(): Promise<void> {
  fileLog(`[CLEANUP] Cleaning up ${acpSessions.size} sessions`)
  for (const [key, session] of acpSessions) {
    try {
      await session.client.disconnect()
    } catch (err) {}
  }
  acpSessions.clear()
}

process.on('SIGINT', cleanupACPClients)
process.on('SIGTERM', cleanupACPClients)
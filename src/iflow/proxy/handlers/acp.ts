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

// Import structured debug logger
import {
  LOG_DIR,
  LOG_FILES,
  ensureLogDir,
  logProxy,
  logOpenAIRequest,
  logIFlowInbound,
  logIFlowOutbound,
  logToolCallEmitted,
  logToolResultReceived,
  logSession,
  logProcessingResult,
  logError,
  buildToolContractMap,
  validateToolCallContract,
  generateTurnId,
  type ToolContractMap,
} from '../debug-logger.js'

// Import OpenCode tools for hardcoded schemas
import { getEffectiveTools, buildToolSchemaMap } from '../opencode-tools.js'

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

// Ensure log directory exists on module load
ensureLogDir()

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
      logSession({
        sessionKey: key,
        model: session.model,
        action: 'expired',
      })
      logProxy(`[SESSION CLEANUP] Removed expired session: ${key.substring(0, 8)}...`)
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
    }
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
    logProxy(`[SESSION INIT] Injecting system context (${systemBlock.length} chars)`)
    // System messages are already included via append_system_prompt in session settings
  }

  session.initialized = true
  logProxy(`[SESSION INIT] Session initialized: ${session.sessionKey.substring(0, 8)}...`)
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

function emitToolCallChunk(
  res: ServerResponse, 
  chatId: string, 
  created: number, 
  model: string, 
  toolCall: NormalizedToolCall,
  // Logging context
  logContext: {
    sessionKey: string
    turnId: string
    originalToolCall?: { name: string; args: any }
    source: 'native_acp' | 'textual_fallback' | 'unknown'
    contractMap?: ToolContractMap
  }
) {
  const { sessionKey, turnId, originalToolCall, source, contractMap } = logContext
  
  // Validate against contract before emitting
  if (contractMap) {
    const validation = validateToolCallContract({
      toolName: toolCall.name,
      args: toolCall.args,
      contractMap,
      sessionKey,
      turnId,
      model,
    })
    if (!validation.valid) {
      logError({
        sessionKey,
        turnId,
        model,
        errorType: 'contract_mismatch',
        message: `Tool '${toolCall.name}' contract validation failed`,
        details: {
          issues: validation.issues,
          normalizedArgs: toolCall.args,
        },
      })
    }
  }
  
  // Log tool call emission
  logToolCallEmitted({
    sessionKey,
    turnId,
    model,
    chatId,
    originalToolCall,
    normalizedToolCall: toolCall,
    source,
    finishReason: 'tool_calls',
  })
  
  logProxy(`[TOOL CALL] ${toolCall.name} -> ${JSON.stringify(toolCall.args)}`)
  
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

  // Generate unique IDs for this turn
  const chatId = `iflow-${randomUUID()}`
  const turnId = generateTurnId()
  const created = Math.floor(Date.now() / 1000)
  const model = request.model
  const requestTools = request.tools || []

  // Build session key from conversation context
  const sessionKey = makeSessionKey(request)
  const conversation = buildConversationContext(request)
  
  // Use effective tools (hardcoded if request doesn't include them)
  const effectiveTools = getEffectiveTools(requestTools)
  
  // Build contract map from effective tools for validation
  const contractMap = buildToolSchemaMap(effectiveTools)

  // Log OpenCode request received (full request with tools schema)
  logOpenAIRequest({
    sessionKey,
    turnId,
    model,
    request: {
      model: request.model,
      stream: request.stream,
      messages: request.messages,
      tools: request.tools,
    },
  })
  
  logProxy(`[REQ] sessionKey=${sessionKey.substring(0, 8)}... turnId=${turnId} model=${model} msgCount=${request.messages.length} toolCount=${requestTools.length} effectiveToolCount=${effectiveTools.length}`)

  // Get or create session
  let session: SessionState
  try {
    session = await getOrCreateSession({
      sessionKey,
      model,
      tools: effectiveTools,
      conversation,
      turnId,
    })
  } catch (error: any) {
    logError({
      sessionKey,
      turnId,
      model,
      errorType: 'exception',
      message: `Failed to create session: ${error.message}`,
      details: { stack: error.stack },
    })
    logProxy(`[ERROR] Failed to create session: ${error.message}`)
    emitFinalDoneChunk(res, chatId, created, model)
    return
  }

  // Update session activity
  session.lastActivityAt = Date.now()

  // Initialize session if needed
  await initializeSessionIfNeeded({ session, conversation })

  // Build turn prompt
  const turnPrompt = buildTurnPrompt({ conversation, requestBody: request })
  
  // Log tool result if present
  if (conversation.latestToolResult) {
    logToolResultReceived({
      sessionKey,
      turnId,
      model,
      toolName: conversation.latestToolResult.name,
      output: conversation.latestToolResult.content,
      outputLength: conversation.latestToolResult.content?.length || 0,
      formattedPrompt: formatToolResultForIFlow({
        toolName: conversation.latestToolResult.name,
        args: conversation.latestToolResult.args || {},
        output: conversation.latestToolResult.content,
      }),
    })
  }
  
  // Log prompt sent to iFlow
  logIFlowOutbound({
    sessionKey,
    turnId,
    model,
    prompt: turnPrompt,
    hasAppendSystemPrompt: true,
    context: {
      systemMessagesCount: conversation.systemMessages.length,
      hasLatestToolResult: !!conversation.latestToolResult,
      hasLatestUserMessage: !!conversation.latestUserMessage,
    },
  })
  
  logProxy(`[TURN] Sending: ${turnPrompt.substring(0, 150)}...`)
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

    for await (const rawMessage of session.client.receiveMessages()) {
      if (state.finished) break
      
      // Cast to any to handle various message structures from iFlow SDK
      const message = rawMessage as any

      // Log raw iFlow message BEFORE processing
      logIFlowInbound({
        sessionKey,
        turnId,
        model,
        message,
        rawType: message?.type || message?.messageType || typeof message,
      })

      const result = processACPMessage(message)
      
      // Determine source of tool call
      let toolCallSource: 'native_acp' | 'textual_fallback' | 'unknown' = 'unknown'
      if (result.type === 'tool_call') {
        toolCallSource = extractNativeACPToolCall(message) ? 'native_acp' : 'textual_fallback'
      }
      
      // Log processing result
      logProcessingResult({
        sessionKey,
        turnId,
        model,
        resultType: result.type,
        source: toolCallSource !== 'unknown' ? toolCallSource : undefined,
        toolName: result.type === 'tool_call' ? result.toolCall.name : undefined,
        contentLength: result.type === 'content' ? result.content.length : undefined,
        hasReasoning: !!result.reasoning,
      })

      // Emit reasoning if present
      if (result.reasoning) {
        state.reasoningBuffer += result.reasoning
        emitReasoningChunk(res, chatId, created, model, result.reasoning)
      }

      switch (result.type) {
        case 'tool_call':
          emitToolCallChunk(res, chatId, created, model, result.toolCall, {
            sessionKey,
            turnId,
            originalToolCall: extractNativeACPToolCall(message) || extractToolCallFromText(extractACPText(message)) || undefined,
            source: toolCallSource,
            contractMap,
          })
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
            logError({
              sessionKey,
              turnId,
              model,
              errorType: 'permission_blocked',
              message: `Blocking internal tool: ${JSON.stringify(permMsg.toolName || permMsg)}`,
              details: { permissionRequest: permMsg },
            })
            logProxy(`[PERMISSION] Blocking: ${JSON.stringify(permMsg)}`)
            
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
            logError({
              sessionKey,
              turnId,
              model,
              errorType: 'other',
              message: `ACP Error: ${errorMsg.message}`,
              details: { error: errorMsg },
            })
            logProxy(`[ERROR] ACP Error: ${errorMsg.message}`)
          }
          break
      }
    }

    // Natural finish
    if (!state.emittedToolCall) {
      logProxy(`[STREAM END] Natural finish, content length: ${state.contentBuffer.length}`)
      emitFinalDoneChunk(res, chatId, created, model)
    }

  } catch (error: any) {
    logError({
      sessionKey,
      turnId,
      model,
      errorType: 'exception',
      message: error.message,
      details: { stack: error.stack },
    })
    logProxy(`[EXCEPTION] ${error.message}`)
    
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
  logProxy(`[CLEANUP] Cleaning up ${acpSessions.size} sessions`)
  for (const [key, session] of acpSessions) {
    logSession({
      sessionKey: key,
      model: session.model,
      action: 'cleaned',
    })
    try {
      await session.client.disconnect()
    } catch (err) {}
  }
  acpSessions.clear()
}

process.on('SIGINT', cleanupACPClients)
process.on('SIGTERM', cleanupACPClients)

/**
 * ACP Stream Handler for iFlow CLI
 * Main handler that orchestrates session management, streaming, and tool calls
 */

import { ServerResponse } from 'http'
import { randomUUID } from 'crypto'
import { MessageType } from '@iflow-ai/iflow-cli-sdk'
import * as logger from '../../../plugin/logger.js'
import { log } from '../utils.js'
import type { ChatCompletionRequest, StreamChunk, SessionState } from '../types.js'

// Import session management
import {
  cleanupExpiredSessions,
  getOrCreateSession,
  initializeSessionIfNeeded,
  IFLOW_INTERNAL_TOOLS,
} from './session-manager.js'

// Import stream emitters
import {
  emitReasoningChunk,
  emitContentChunk,
  emitToolCallChunk,
  emitFinalDoneChunk,
  emitErrorChunk,
} from './stream-emitters.js'

// Import tool blocking policy
import { shouldBlockTool } from './tool-blocking.js'
import { extractNativeACPToolCall, extractToolCallFromText, extractReasoning, extractACPText } from './tool-extraction.js'
import type { ToolCallSource } from '../debug-logger.js'

// Import utilities from conversation and prompt-builders
import { makeSessionKey } from './hash-utils.js'
import { buildConversationContext } from './conversation.js'
import { buildTurnPrompt, formatToolResultForIFlow } from './prompt-builders.js'
import { processACPMessage } from './tool-extraction.js'

// Import OpenCode tools for hardcoded schemas
import { getEffectiveTools } from '../opencode-tools.js'

// Import structured debug logger
import {
  ensureLogDir,
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
  logToolBlockCheck,
  logToolBlocked,
  type ToolContractMap,
} from '../debug-logger.js'

// Ensure log directory exists on module load
ensureLogDir()

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle ACP stream request from OpenCode
 * Routes messages between OpenCode and iFlow CLI via ACP protocol
 *
 * @param request - Chat completion request from OpenCode
 * @param res - HTTP server response
 * @param enableLog - Enable logging flag
 * @param strictMode - Enable strict OpenCode tool policy (default: true)
 */
export async function handleACPStreamRequest(
  request: ChatCompletionRequest,
  res: ServerResponse,
  enableLog: boolean,
  strictMode: boolean = true
): Promise<void> {
  // Cleanup expired sessions first
  cleanupExpiredSessions()

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
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
  const contractMap = buildToolContractMap(effectiveTools)

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

  logProxy(
    `[REQ] sessionKey=${sessionKey.substring(0, 8)}... turnId=${turnId} model=${model} msgCount=${request.messages.length} toolCount=${requestTools.length} effectiveToolCount=${effectiveTools.length}`
  )

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

      const result = processACPMessage(message, { strictMode })

      // Determine source of tool call
      let toolCallSource: ToolCallSource = 'unknown'
      if (result.type === 'tool_call') {
        toolCallSource = extractNativeACPToolCall(message)
          ? 'native_iflow'
          : 'fallback_text'
      }

      // Log processing result
      logProcessingResult({
        sessionKey,
        turnId,
        model,
        resultType: result.type,
        source: toolCallSource !== 'unknown' ? toolCallSource : undefined,
        toolName: result.type === 'tool_call' && result.toolCall ? result.toolCall.name : undefined,
        contentLength: result.type === 'content' && result.content ? result.content.length : undefined,
        hasReasoning: !!result.reasoning,
      })

      // Emit reasoning if present
      if (result.reasoning) {
        state.reasoningBuffer += result.reasoning
        emitReasoningChunk(res, chatId, created, model, result.reasoning)
      }

      switch (result.type) {
        case 'tool_call':
          if (result.toolCall) {
            emitToolCallChunk(res, chatId, created, model, result.toolCall, {
              sessionKey,
              turnId,
              originalToolCall:
                extractNativeACPToolCall(message) ||
                extractToolCallFromText(extractACPText(message)) ||
                undefined,
              source: toolCallSource,
              contractMap,
            })
            state.emittedToolCall = true
            state.finished = true
            return // Stop processing - OpenCode will execute the tool
          }
          break

        case 'tool_blocked':
          // Tool was blocked by strict mode policy
          if (result.originalName && result.reason) {
            logToolBlocked({
              sessionKey,
              turnId,
              model,
              toolNameOriginal: result.originalName,
              argsOriginal: result.originalArgs || {},
              reason: result.reason,
            })
            logProxy(`[TOOL BLOCKED] ${result.originalName} blocked: ${result.reason}`)
          }
          // Don't finish - let the model continue and try another approach
          break

        case 'content':
          if (result.content) {
            state.contentBuffer += result.content
            // Check for inline tool call markers in content
            if (result.content.includes('<<USA_TOOL>>')) {
              // Don't emit content that contains tool markers - will be extracted
            } else {
              emitContentChunk(res, chatId, created, model, result.content)
            }
          }
          break

        case 'done':
          state.finished = true
          break

        case 'noop':
          // Handle other message types
          handleNoopMessage(message, session, sessionKey, turnId, model)
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
      emitErrorChunk(res, chatId, created, model, error.message)
    }
  }
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

/**
 * Handle noop message types (asks, plan mode, permissions, errors)
 */
function handleNoopMessage(
  message: any,
  session: SessionState,
  sessionKey: string,
  turnId: string,
  model: string
): void {
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
        session.client
          .respondToToolConfirmation(permMsg.requestId, denyOption.optionId)
          .catch(() => {})
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
}

// ============================================================================
// LOGGING HELPER
// ============================================================================

function logProxy(text: string): void {
  log(`[ACP Handler] ${text}`)
}

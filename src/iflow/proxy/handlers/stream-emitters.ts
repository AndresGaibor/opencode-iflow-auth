/**
 * Stream Emitters for ACP/iFlow responses
 * Handles emitting chunks to OpenCode in SSE format
 */

import { ServerResponse } from 'http'
import { randomUUID } from 'crypto'
import type { NormalizedToolCall, StreamChunk } from '../types.js'
import type { ToolContractMap, ToolCallSource } from '../debug-logger.js'
import { validateToolCallContract } from '../debug-logger.js'

// ============================================================================
// REASONING CHUNKS
// ============================================================================

/**
 * Emit a reasoning/thinking chunk to the response stream
 */
export function emitReasoningChunk(
  res: ServerResponse,
  chatId: string,
  created: number,
  model: string,
  reasoning: string
): void {
  if (!reasoning) return

  const chunk: StreamChunk = {
    id: chatId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          reasoning_content: reasoning,
          thought: reasoning,
        } as any,
        finish_reason: null,
      },
    ],
  }
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
}

// ============================================================================
// CONTENT CHUNKS
// ============================================================================

/**
 * Emit a content chunk to the response stream
 */
export function emitContentChunk(
  res: ServerResponse,
  chatId: string,
  created: number,
  model: string,
  content: string
): void {
  if (!content) return

  const chunk: StreamChunk = {
    id: chatId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: null,
      },
    ],
  }
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
}

// ============================================================================
// TOOL CALL CHUNKS
// ============================================================================

/**
 * Emit a tool call chunk to the response stream
 * Includes contract validation and logging
 */
export function emitToolCallChunk(
  res: ServerResponse,
  chatId: string,
  created: number,
  model: string,
  toolCall: NormalizedToolCall,
  logContext: {
    sessionKey: string
    turnId: string
    originalToolCall?: { name: string; args: any }
    source: ToolCallSource
    contractMap?: ToolContractMap
  }
): void {
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
      arguments: JSON.stringify(toolCall.args),
    },
  }

  const chunk: StreamChunk = {
    id: chatId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [
      {
        index: 0,
        delta: { role: 'assistant', tool_calls: [openAIToolCall] } as any,
        finish_reason: 'tool_calls',
      },
    ],
  }
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
}

// ============================================================================
// FINAL CHUNKS
// ============================================================================

/**
 * Emit the final done chunk to end the stream
 */
export function emitFinalDoneChunk(
  res: ServerResponse,
  chatId: string,
  created: number,
  model: string,
  reason: string = 'stop'
): void {
  const chunk: StreamChunk = {
    id: chatId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: reason === 'max_tokens' ? 'length' : 'stop',
      },
    ],
  }
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
}

/**
 * Emit an error chunk to the response stream
 */
export function emitErrorChunk(
  res: ServerResponse,
  chatId: string,
  created: number,
  model: string,
  errorMessage: string
): void {
  const chunk: StreamChunk = {
    id: chatId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [
      {
        index: 0,
        delta: { content: `Error: ${errorMessage}` },
        finish_reason: 'stop',
      },
    ],
  }
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
}

// ============================================================================
// LOGGING HELPERS
// ============================================================================

function logProxy(text: string): void {
  import('../debug-logger.js').then(({ logProxy: logProxyFn }) => {
    logProxyFn(text)
  })
}

function logToolCallEmitted(params: {
  sessionKey: string
  turnId: string
  model: string
  chatId: string
  originalToolCall?: { name: string; args: any }
  normalizedToolCall: { name: string; args: any }
  source: ToolCallSource
  finishReason: string
}): void {
  import('../debug-logger.js').then(({ logToolCallEmitted: logFn }) => {
    logFn(params)
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
  import('../debug-logger.js').then(({ logError: logErrorFn }) => {
    logErrorFn(params)
  })
}

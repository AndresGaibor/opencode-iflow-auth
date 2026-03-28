/**
 * Proxy request router
 * Routes requests to either CLI handler or direct API based on model
 */

import { requiresCLI } from '../../constants/models.js'
import { handleDirectAPIRequest } from './handlers/api.js'
import { handleACPStreamRequest } from './handlers/acp.js'
import { callIFlowCLI, callIFlowCLIStream } from './handlers/cli.js'
import { ServerResponse } from 'http'
import type { ChatCompletionRequest } from './types.js'

// Use ACP protocol (WebSocket) for CLI models - enables tool calls
const USE_ACP_PROTOCOL = process.env.IFLOW_USE_ACP !== 'false'

/**
 * Check if request requires CLI proxy
 */
export function needsCLIProxy(request: ChatCompletionRequest): boolean {
  return requiresCLI(request.model)
}

/**
 * Route chat completions request to appropriate handler
 */
export async function routeChatCompletions(
  request: ChatCompletionRequest,
  res: ServerResponse,
  apiKey: string,
  enableLog: boolean,
  cliAvailable: boolean,
  cliLoggedIn: boolean
): Promise<void> {
  const isStream = request.stream === true

  if (needsCLIProxy(request)) {
    // CLI-required model
    if (!cliAvailable || !cliLoggedIn) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'iflow CLI not ready' }))
      return
    }

    if (isStream) {
      await handleCLIStreamRequest(request, res, enableLog)
    } else {
      await handleCLINonStreamRequest(request, res)
    }
  } else {
    // Direct API model
    await handleDirectAPIRequest(request, res, isStream, apiKey, enableLog)
  }
}

/**
 * Handle non-streaming CLI request
 */
async function handleCLINonStreamRequest(
  request: ChatCompletionRequest,
  res: ServerResponse
): Promise<void> {
  try {
    const { randomUUID } = await import('crypto')
    const result = await callIFlowCLI(request)
    
    const response = {
      id: `iflow-${randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: result.content },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: result.promptTokens || 0,
        completion_tokens: result.completionTokens || 1,
        total_tokens: (result.promptTokens || 1) + (result.completionTokens || 1)
      }
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(response))
  } catch (error: any) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: error.message || 'Internal server error' }))
  }
}

/**
 * Handle streaming CLI request
 */
async function handleCLIStreamRequest(
  request: ChatCompletionRequest,
  res: ServerResponse,
  enableLog: boolean
): Promise<void> {
  // Use ACP protocol for tool calls support
  if (USE_ACP_PROTOCOL) {
    try {
      await handleACPStreamRequest(request, res, enableLog)
      return
    } catch (error: any) {
      console.error('ACP handler failed, falling back to stdin:', error.message)
      // Fall through to stdin-based handler
    }
  }

  // Fallback: stdin-based streaming (no tool calls)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  const { randomUUID } = await import('crypto')
  const chatId = `iflow-${randomUUID()}`
  const created = Math.floor(Date.now() / 1000)

  try {
    await callIFlowCLIStream(request, (content, done, isReasoning, toolCall) => {
      const delta: any = {}
      if (done) {
        // Final chunk
      } else if (toolCall) {
        delta.tool_calls = [toolCall]
      } else if (isReasoning) {
        delta.reasoning_content = content
        if (enableLog) console.error(`[IFlowProxy] [CLI Chunk] [Reasoning] ${content}`)
      } else {
        delta.content = content
        if (enableLog) console.error(`[IFlowProxy] [CLI Chunk] [Content] ${content}`)
      }

      const chunk = {
        id: chatId,
        object: 'chat.completion.chunk',
        created,
        model: request.model,
        choices: [{ index: 0, delta, finish_reason: done ? 'stop' : null }]
      }

      res.write(`data: ${JSON.stringify(chunk)}\n\n`)
      if (done) {
        res.write('data: [DONE]\n\n')
        res.end()
      }
    })
  } catch (error: any) {
    res.end()
  }
}

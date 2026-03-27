import { createServer, Server, IncomingMessage, ServerResponse } from 'http'
import { randomUUID } from 'crypto'
import { log, IFLOW_PROXY_PORT, IFLOW_PROXY_HOST, AUTO_INSTALL_CLI, AUTO_LOGIN } from './utils.js'
import { checkIFlowCLI, checkIFlowLogin, installIFlowCLI, triggerIFlowLogin } from './cli-manager.js'
import { handleDirectAPIRequest } from './handlers/api.js'
import { callIFlowCLI, callIFlowCLIStream } from './handlers/cli.js'
import { handleACPStreamRequest, cleanupACPClients } from './handlers/acp.js'
import { requiresCLI } from '../models.js'
import * as logger from '../../plugin/logger.js'
import type { ChatCompletionRequest, ChatCompletionResponse, StreamChunk } from './types.js'

// Use ACP protocol (WebSocket) for CLI models - enables tool calls
const USE_ACP_PROTOCOL = process.env.IFLOW_USE_ACP !== 'false'

export class IFlowCLIProxy {
  private server: Server | null = null
  private port: number
  private host: string
  private cliAvailable: boolean = false
  private cliLoggedIn: boolean = false
  private cliChecked: boolean = false
  private enableLog: boolean = false

  constructor(port: number = IFLOW_PROXY_PORT, host: string = IFLOW_PROXY_HOST) {
    this.port = port
    this.host = host
  }

  setEnableLog(enabled: boolean): void {
    this.enableLog = enabled
  }

  async start(): Promise<void> {
    if (this.server) return

    if (!this.cliChecked) {
      let cliCheck = checkIFlowCLI()
      if (!cliCheck.installed && AUTO_INSTALL_CLI) {
        const installResult = await installIFlowCLI()
        if (installResult.success) cliCheck = checkIFlowCLI()
      }
      this.cliAvailable = cliCheck.installed
      this.cliChecked = true
      
      if (cliCheck.installed) {
        const loginCheck = checkIFlowLogin()
        this.cliLoggedIn = loginCheck.loggedIn
        if (!loginCheck.loggedIn && AUTO_LOGIN) {
          const loginResult = await triggerIFlowLogin()
          if (loginResult.success) this.cliLoggedIn = true
        }
      }
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res))
      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') resolve()
        else reject(err)
      })
      this.server.listen(this.port, this.host, () => {
        log(`Smart proxy started on http://${this.host}:${this.port}`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    // Cleanup ACP clients
    await cleanupACPClients()
    
    if (!this.server) return
    return new Promise((resolve) => {
      this.server!.close(() => {
        this.server = null
        log('Server stopped')
        resolve()
      })
    })
  }

  getBaseUrl(): string {
    return `http://${this.host}:${this.port}`
  }

  isCLIAvailable(): boolean {
    return this.cliAvailable
  }

  isCLILoggedIn(): boolean {
    return this.cliLoggedIn
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Method not allowed' }))
      return
    }

    const url = req.url || ''
    if (url === '/v1/chat/completions') {
      await this.handleChatCompletions(req, res)
    } else if (url === '/v1/models') {
      this.handleModels(res)
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    }
  }

  private async handleChatCompletions(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || ''
    const authStr = Array.isArray(authHeader) ? (authHeader[0] || '') : authHeader
    const apiKey = authStr.replace('Bearer ', '')
    
    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', async () => {
      try {
        const request: ChatCompletionRequest = JSON.parse(body)
        const isStream = request.stream === true

        if (this.enableLog) {
          logger.log(`[IFlowProxy] [Request] model=${request.model} stream=${isStream}`)
          logger.logApiRequest(request, logger.getTimestamp())
        }

        if (requiresCLI(request.model)) {
          if (!this.cliAvailable || !this.cliLoggedIn) {
            res.writeHead(503, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'iflow CLI not ready' }))
            return
          }
          
          if (isStream) await this.handleCLIStreamRequest(request, res)
          else await this.handleCLINonStreamRequest(request, res)
        } else {
          await handleDirectAPIRequest(request, res, isStream, apiKey, this.enableLog)
        }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid request body' }))
      }
    })
  }

  private async handleCLINonStreamRequest(request: ChatCompletionRequest, res: ServerResponse): Promise<void> {
    try {
      const result = await callIFlowCLI(request)
      const response: ChatCompletionResponse = {
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

  private async handleCLIStreamRequest(request: ChatCompletionRequest, res: ServerResponse): Promise<void> {
    // Si el request tiene tools, usar la API directa de iflow (OpenAI-compatible)
    // ACP inyecta las tools internas de iflow, impidiendo que glm-5 vea las tools de OpenCode.
    // La API directa pasa tools/messages completos al modelo → glm-5 genera tool_calls correctas.
    if (request.tools && request.tools.length > 0) {
      const authStr = '' // La API key se extrae en handleChatCompletions, la pasamos vacía
      // Necesitamos el apiKey — lo guardamos temporalmente en el request
      const apiKey = (request as any)._apiKey || ''
      if (enableLog) {
        logger.log(`[IFlowProxy] [CLI+Tools] Routing to direct API (tools present: ${request.tools.length})`)
      }
      await handleDirectAPIRequest(request, res, true, apiKey, this.enableLog)
      return
    }

    // Use ACP protocol for non-tool streaming (reasoning, text generation)
    if (USE_ACP_PROTOCOL) {
      try {
        await handleACPStreamRequest(request, res, this.enableLog)
        return
      } catch (error: any) {
        log('ACP handler failed, falling back to stdin:', error.message)
        // Fall through to stdin-based handler
      }
    }


    // Fallback: stdin-based streaming (no tool calls)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    })

    const chatId = `iflow-${randomUUID()}`
    const created = Math.floor(Date.now() / 1000)

    try {
      await callIFlowCLIStream(request, (content, done, isReasoning, toolCall) => {
        const delta: any = {}
        if (done) {} 
        else if (toolCall) delta.tool_calls = [toolCall]
        else if (isReasoning) {
          delta.reasoning_content = content
          if (this.enableLog) logger.log(`[IFlowProxy] [CLI Chunk] [Reasoning] ${content}`)
        } else {
          delta.content = content
          if (this.enableLog) logger.log(`[IFlowProxy] [CLI Chunk] [Content] ${content}`)
        }

        const chunk: StreamChunk = {
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

  private handleModels(res: ServerResponse): void {
    const models = [
      { id: 'glm-5', object: 'model', created: 1700000000, owned_by: 'iflow' },
      { id: 'glm-4.6', object: 'model', created: 1700000000, owned_by: 'iflow' },
      { id: 'deepseek-v3.2', object: 'model', created: 1700000000, owned_by: 'iflow' },
      { id: 'kimi-k2', object: 'model', created: 1700000000, owned_by: 'iflow' },
    ]
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ object: 'list', data: models }))
  }
}

import { createServer, Server, IncomingMessage, ServerResponse } from 'http'
import { log, IFLOW_PROXY_PORT, IFLOW_PROXY_HOST, AUTO_INSTALL_CLI, AUTO_LOGIN } from './utils.js'
import { checkIFlowCLI, checkIFlowLogin, installIFlowCLI, triggerIFlowLogin } from './cli-manager.js'
import { cleanupACPClients } from './handlers/acp.js'
import { routeChatCompletions } from './router.js'
import * as logger from '../../plugin/logger.js'
import type { ChatCompletionRequest } from './types.js'

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
    const url = req.url || ''

    // Handle GET /v1/models
    if (url === '/v1/models') {
      if (req.method === 'GET') {
        this.handleModels(res)
      } else {
        res.writeHead(405, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Method not allowed. Use GET for /v1/models' }))
      }
      return
    }

    // All other endpoints require POST
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Method not allowed' }))
      return
    }

    if (url === '/v1/chat/completions') {
      await this.handleChatCompletions(req, res)
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

        if (this.enableLog) {
          logger.log(`[IFlowProxy] [Request] model=${request.model} stream=${request.stream}`)
          logger.logApiRequest(request, logger.getTimestamp())
        }

        await routeChatCompletions(
          request,
          res,
          apiKey,
          this.enableLog,
          this.cliAvailable,
          this.cliLoggedIn
        )
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid request body' }))
      }
    })
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

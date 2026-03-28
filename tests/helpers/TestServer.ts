/**
 * TestServer - Spawns a real HTTP proxy server on a random port for integration tests.
 */

import { IFlowCLIProxy } from '../../src/iflow/proxy/server.js'

export class TestServer {
  private proxy: IFlowCLIProxy | null = null
  private port: number = 0
  private baseUrl: string = ''

  async start(): Promise<{ port: number; baseUrl: string }> {
    // Find a random available port
    const http = await import('http')
    const tempServer = http.createServer()
    
    await new Promise<void>((resolve) => {
      tempServer.listen(0, () => {
        this.port = (tempServer.address() as any).port
        tempServer.close(() => resolve())
      })
    })

    // Create proxy with the found port
    this.proxy = new IFlowCLIProxy(this.port, '127.0.0.1')
    await this.proxy.start()
    
    this.baseUrl = this.proxy.getBaseUrl()
    return { port: this.port, baseUrl: this.baseUrl }
  }

  async stop(): Promise<void> {
    if (this.proxy) {
      await this.proxy.stop()
      this.proxy = null
    }
  }

  getBaseUrl(): string {
    return this.baseUrl
  }

  getPort(): number {
    return this.port
  }

  isCLIAvailable(): boolean {
    return this.proxy?.isCLIAvailable() ?? false
  }

  isCLILoggedIn(): boolean {
    return this.proxy?.isCLILoggedIn() ?? false
  }
}

/**
 * Helper to make HTTP requests to the test server.
 */
export async function makeHttpRequest(
  baseUrl: string,
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>
): Promise<{ status: number; body: any; headers: Record<string, string> }> {
  const url = new URL(path, baseUrl)
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const responseHeaders: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value
  })

  let responseBody: any
  const contentType = response.headers.get('content-type') || ''
  
  if (contentType.includes('application/json')) {
    responseBody = await response.json()
  } else if (contentType.includes('text/event-stream')) {
    responseBody = await response.text()
  } else {
    responseBody = await response.text()
  }

  return {
    status: response.status,
    body: responseBody,
    headers: responseHeaders,
  }
}

/**
 * Helper to collect SSE chunks from a streaming response.
 */
export async function collectSSEChunks(
  baseUrl: string,
  path: string,
  body: any,
  headers?: Record<string, string>
): Promise<SSEEvent[]> {
  const url = new URL(path, baseUrl)
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })

  const events: SSEEvent[] = []
  const reader = response.body?.getReader()
  
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    
    // Parse SSE events
    const lines = buffer.split('\n')
    buffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') {
          events.push({ type: 'done' })
        } else {
          try {
            const parsed = JSON.parse(data)
            events.push({ type: 'chunk', data: parsed })
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }

  return events
}

export interface SSEEvent {
  type: 'chunk' | 'done'
  data?: any
}
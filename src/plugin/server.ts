/**
 * OAuth server implementation
 * Handles OAuth 2.0 callback server for iFlow authentication
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import type { IFlowOAuthTokenResult } from '../iflow/oauth.js'
import { exchangeOAuthCode } from '../iflow/oauth.js'
import { isHeadlessEnvironment, promptOAuthCallback } from './headless.js'
import {
  buildErrorHtml,
  buildAuthFailedHtml,
  buildMissingParamHtml,
  buildStateMismatchHtml,
} from './auth-error.js'
import { buildSuccessHtml } from './auth-success.js'
import { parseCallbackInput } from './callback-parser.js'
import { OAUTH_SERVER_TIMEOUT_MS } from '../constants/limits.js'

export interface OAuthServerResult {
  url: string
  redirectUri: string
  waitForAuth: () => Promise<IFlowOAuthTokenResult>
}

/**
 * Start OAuth callback server
 * @param authUrl - OAuth authorization URL
 * @param state - OAuth state parameter
 * @param redirectUri - Redirect URI
 * @param portStart - Starting port to try
 * @param portRange - Number of ports to try
 * @returns OAuth server result with wait promise
 */
export async function startOAuthServer(
  authUrl: string,
  state: string,
  redirectUri: string,
  portStart: number,
  portRange: number
): Promise<OAuthServerResult> {
  let resolveAuth: (result: IFlowOAuthTokenResult) => void = () => {}
  let rejectAuth: (error: Error) => void = () => {}

  const authPromise = new Promise<IFlowOAuthTokenResult>((resolve, reject) => {
    resolveAuth = resolve
    rejectAuth = reject
  })

  const headless = isHeadlessEnvironment()

  if (headless) {
    return createHeadlessResult(authUrl, redirectUri, state)
  }

  // Start server with port retry logic
  const { server, actualPort } = await startServerWithPortRetry(portStart, portRange)

  const timeoutHandle = createTimeoutHandler(server, rejectAuth, actualPort)

  // Set up request handler
  server.on('request', (req, res) => handleRequest(
    req, res, actualPort, state, redirectUri, timeoutHandle, resolveAuth, rejectAuth, server
  ))

  return {
    url: authUrl,
    redirectUri,
    waitForAuth: () => authPromise
  }
}

/**
 * Handle HTTP request
 */
function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  port: number,
  state: string,
  redirectUri: string,
  timeoutHandle: NodeJS.Timeout,
  resolveAuth: (result: IFlowOAuthTokenResult) => void,
  rejectAuth: (error: Error) => void,
  server: ReturnType<typeof createServer>
): void {
  const url = new URL(req.url || '', `http://localhost:${port}`)

  if (url.pathname !== '/oauth2callback') {
    res.writeHead(204)
    res.end()
    return
  }

  handleCallback(url, state, redirectUri, res, timeoutHandle, resolveAuth, rejectAuth, server)
}

/**
 * Handle OAuth callback request
 */
function handleCallback(
  url: URL,
  state: string,
  redirectUri: string,
  res: ServerResponse,
  timeoutHandle: NodeJS.Timeout,
  resolveAuth: (result: IFlowOAuthTokenResult) => void,
  rejectAuth: (error: Error) => void,
  server: ReturnType<typeof createServer>
): void {
  const code = url.searchParams.get('code')
  const returnedState = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(buildAuthFailedHtml(error))
    clearTimeout(timeoutHandle)
    rejectAuth(new Error(`Authorization failed: ${error}`))
    setTimeout(() => server.close(), 1000)
    return
  }

  if (!code || !returnedState) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(buildMissingParamHtml('code or state'))
    clearTimeout(timeoutHandle)
    rejectAuth(new Error('Missing code or state in callback'))
    setTimeout(() => server.close(), 1000)
    return
  }

  if (returnedState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(buildStateMismatchHtml())
    clearTimeout(timeoutHandle)
    rejectAuth(new Error('State mismatch'))
    setTimeout(() => server.close(), 1000)
    return
  }

  exchangeOAuthCode(code, redirectUri)
    .then((result) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(buildSuccessHtml(result.email))

      clearTimeout(timeoutHandle)
      setTimeout(() => {
        resolveAuth(result)
        setTimeout(() => server.close(), 1000)
      }, 100)
    })
    .catch((error: any) => {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(buildErrorHtml(error.message))
      clearTimeout(timeoutHandle)
      rejectAuth(error)
      setTimeout(() => server.close(), 1000)
    })
}

/**
 * Create headless OAuth result for non-GUI environments
 */
function createHeadlessResult(
  authUrl: string,
  redirectUri: string,
  state: string
): OAuthServerResult {
  const manualAuth = async () => {
    const input = await promptOAuthCallback()
    const parsed = parseCallbackInput(input)

    if (!parsed || !parsed.code) {
      throw new Error('Invalid callback input. Please paste the full callback URL or authorization code.')
    }

    if (parsed.state && parsed.state !== state) {
      throw new Error('State mismatch. Please try again.')
    }

    return exchangeOAuthCode(parsed.code, redirectUri)
  }

  return {
    url: authUrl,
    redirectUri,
    waitForAuth: manualAuth
  }
}

/**
 * Start server with port retry logic
 */
async function startServerWithPortRetry(
  portStart: number,
  portRange: number
): Promise<{ server: ReturnType<typeof createServer>; actualPort: number }> {
  let server: ReturnType<typeof createServer> | null = null
  let actualPort = portStart

  for (let port = portStart; port < portStart + portRange; port++) {
    try {
      server = createServer(() => {})
      await new Promise<void>((resolve, reject) => {
        server!.listen(port, '0.0.0.0', () => {
          actualPort = port
          resolve()
        })
        server!.on('error', reject)
      })
      break
    } catch (error: any) {
      if (error.code !== 'EADDRINUSE' || port === portStart + portRange - 1) {
        throw error
      }
    }
  }

  if (!server) {
    throw new Error('Failed to start OAuth callback server')
  }

  return { server, actualPort }
}

/**
 * Create timeout handler
 */
function createTimeoutHandler(
  server: ReturnType<typeof createServer>,
  rejectAuth: (error: Error) => void,
  port: number
): NodeJS.Timeout {
  return setTimeout(
    () => {
      if (server.listening) {
        rejectAuth(new Error(`OAuth timeout: No response after ${OAUTH_SERVER_TIMEOUT_MS / 1000 / 60} minutes`))
        server.close()
      }
    },
    OAUTH_SERVER_TIMEOUT_MS
  )
}

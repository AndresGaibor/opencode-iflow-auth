import { homedir } from 'os'
import { join } from 'path'
import * as logger from '../../plugin/logger.js'
import type { ChatMessage } from './types.js'

export const IFLOW_PROXY_PORT = 19998
export const IFLOW_PROXY_HOST = '127.0.0.1'
export const IFLOW_API_BASE = 'https://apis.iflow.cn'

export const DEBUG = process.env.IFLOW_PROXY_DEBUG === 'true'
export const AUTO_INSTALL_CLI = process.env.IFLOW_AUTO_INSTALL_CLI !== 'false'
export const AUTO_LOGIN = false

export function log(...args: any[]) {
  if (DEBUG) {
    logger.log('[iflow-proxy]', ...args)
  }
}

export function getIFlowConfigPath(): string {
  return join(homedir(), '.iflow')
}

export function getIFlowOAuthCredsPath(): string {
  return join(getIFlowConfigPath(), 'oauth_creds.json')
}

export function buildPrompt(messages: ChatMessage[]): string {
  const parts: string[] = []
  
  for (const msg of messages) {
    if (msg.role === 'system') {
      parts.push(`System: ${msg.content}`)
    } else if (msg.role === 'user') {
      parts.push(msg.content)
    } else if (msg.role === 'assistant') {
      parts.push(`Assistant: ${msg.content}`)
    }
  }

  return parts.join('\n\n')
}

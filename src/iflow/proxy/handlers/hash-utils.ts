/**
 * Hash utilities for ACP session management
 * Pure functions with no side effects
 */

import { createHash } from 'crypto'
import type { ChatCompletionRequest } from '../types.js'

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Creates a SHA256 hash truncated to 16 characters
 *
 * @param input - String to hash
 * @returns 16-character hex hash
 */
export function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex').substring(0, 16)
}

/**
 * Creates a stable session key from a request body
 * Uses model + first 6 messages to create a deterministic key
 *
 * @param requestBody - Chat completion request
 * @returns Stable session key hash
 */
export function makeSessionKey(requestBody: ChatCompletionRequest): string {
  const model = requestBody?.model || 'unknown'
  const msgs = Array.isArray(requestBody?.messages) ? requestBody.messages : []

  const seed = JSON.stringify({
    model,
    firstMessages: msgs.slice(0, 6).map((m: any) => ({
      role: m.role,
      content: typeof m.content === 'string'
        ? m.content.substring(0, 200)
        : JSON.stringify(m.content).substring(0, 200),
    })),
  })

  return hashString(seed)
}

/**
 * Creates a hash of tool schemas for comparison
 *
 * @param tools - Array of tool definitions
 * @returns Hash of tool schema or 'none' if empty
 */
export function hashToolSchema(tools: any[]): string {
  if (!tools || tools.length === 0) return 'none'
  const schema = tools
    .map((t) => {
      const fn = t.function || t
      return `${fn.name}:${Object.keys(fn.parameters?.properties || {}).join(',')}`
    })
    .join('|')
  return hashString(schema)
}

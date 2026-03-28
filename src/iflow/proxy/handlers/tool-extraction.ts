/**
 * Tool call extraction from ACP messages
 * Pure functions for extracting tool calls from various message formats
 */

import type { NormalizedToolCall } from '../types.js'
import { normalizeToolCall } from './tool-normalization.js'

// ============================================================================
// ACP TOOL CALL EXTRACTION
// ============================================================================

/**
 * Extracts a native tool call from an ACP message
 *
 * @param msg - ACP message object
 * @returns Tool call object or null if not found
 */
export function extractNativeACPToolCall(msg: any): { name: string; args: any } | null {
  if (!msg) return null

  // Try different message structures
  if (msg.type === 'tool_call' && msg.payload?.toolName) {
    return {
      name: msg.payload.toolName,
      args: msg.payload.arguments || {},
    }
  }

  if (msg.messageType === 'TOOL_CALL' && msg.toolCall) {
    return {
      name: msg.toolCall.name,
      args: msg.toolCall.arguments || {},
    }
  }

  // Direct toolName field (from iFlow SDK)
  if (msg.toolName) {
    return {
      name: msg.toolName,
      args: msg.args || msg.arguments || {},
    }
  }

  return null
}

/**
 * Extracts a tool call from text using the <<USA_TOOL>> marker format
 *
 * @param text - Text content to extract tool call from
 * @returns Tool call object or null if not found
 */
export function extractToolCallFromText(text: string): { name: string; args: any } | null {
  if (!text || !text.includes('<<USA_TOOL>>')) return null

  const match = text.match(
    /<<USA_TOOL>>\s*([\w.-]+)\s*(\{[\s\S]*?\})?\s*(?:<<\/USA_TOOL>>|$)/
  )
  if (!match) return null

  const toolName = match[1]
  const rawArgs = match[2]

  if (!toolName) return null

  try {
    return {
      name: toolName,
      args: rawArgs ? JSON.parse(rawArgs) : {},
    }
  } catch {
    return null
  }
}

/**
 * Extracts reasoning from an ACP message
 *
 * @param msg - ACP message object
 * @returns Reasoning text or empty string
 */
export function extractReasoning(msg: any): string {
  if (msg?.chunk?.thought) return msg.chunk.thought
  if (msg?.reasoning) return msg.reasoning
  return ''
}

/**
 * Extracts text content from an ACP message
 *
 * @param msg - ACP message object
 * @returns Text content or empty string
 */
export function extractACPText(msg: any): string {
  if (msg?.chunk?.text) return msg.chunk.text
  if (msg?.content) return msg.content
  if (typeof msg === 'string') return msg
  return ''
}

/**
 * Checks if a message indicates task completion
 *
 * @param msg - ACP message object
 * @returns True if message indicates completion
 */
export function isACPDoneMessage(msg: any): boolean {
  return (
    msg?.type === 'TASK_FINISH' ||
    msg?.messageType === 'TASK_FINISH' ||
    msg?.stopReason !== undefined
  )
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

/**
 * Processes an ACP message and returns a structured result
 * Priority: native tool call > fallback textual tool call > content > done
 *
 * In strict mode, verifies tool blocking BEFORE normalizing.
 *
 * @param msg - ACP message to process
 * @param options - Processing options (strictMode)
 * @returns Processing result
 */
export function processACPMessage(
  msg: any,
  options?: { strictMode?: boolean }
): {
  type: 'tool_call' | 'content' | 'done' | 'noop' | 'tool_blocked'
  toolCall?: NormalizedToolCall
  content?: string
  reasoning?: string
  originalName?: string
  originalArgs?: any
  reason?: string
} {
  if (!msg) return { type: 'noop' }

  // Import blocking policy
  const { shouldBlockTool } = require('./tool-blocking.js') as {
    shouldBlockTool: (name: string, opts?: { strictMode?: boolean }) => { blocked: boolean; reason?: string }
  }

  // Priority 1: Native tool call from ACP
  const nativeToolCall = extractNativeACPToolCall(msg)
  if (nativeToolCall) {
    // CHECK BLOCKING POLICY BEFORE NORMALIZING
    const blockCheck = shouldBlockTool(nativeToolCall.name, {
      strictMode: options?.strictMode ?? true, // Default to strict mode
    })

    if (blockCheck.blocked) {
      return {
        type: 'tool_blocked',
        originalName: nativeToolCall.name,
        originalArgs: nativeToolCall.args,
        reason: blockCheck.reason || 'blocked_by_policy',
        reasoning: extractReasoning(msg),
      }
    }

    return {
      type: 'tool_call',
      toolCall: normalizeToolCall(nativeToolCall.name, nativeToolCall.args),
      reasoning: extractReasoning(msg),
    }
  }

  const text = extractACPText(msg)
  if (text) {
    // Priority 2: Fallback textual tool call
    const fallbackToolCall = extractToolCallFromText(text)
    if (fallbackToolCall) {
      // CHECK BLOCKING POLICY BEFORE NORMALIZING
      const blockCheck = shouldBlockTool(fallbackToolCall.name, {
        strictMode: options?.strictMode ?? true,
      })

      if (blockCheck.blocked) {
        return {
          type: 'tool_blocked',
          originalName: fallbackToolCall.name,
          originalArgs: fallbackToolCall.args,
          reason: blockCheck.reason || 'blocked_by_policy',
          reasoning: extractReasoning(msg),
        }
      }

      return {
        type: 'tool_call',
        toolCall: normalizeToolCall(fallbackToolCall.name, fallbackToolCall.args),
        reasoning: extractReasoning(msg),
      }
    }

    // Priority 3: Normal content
    return {
      type: 'content',
      content: text,
      reasoning: extractReasoning(msg),
    }
  }

  // Check for done
  if (isACPDoneMessage(msg)) {
    return {
      type: 'done',
      reasoning: extractReasoning(msg),
    }
  }

  return { type: 'noop', reasoning: extractReasoning(msg) }
}

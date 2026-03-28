/**
 * Conversation context builders for ACP/iFlow
 * Pure functions for extracting and formatting conversation data
 */

import type { ChatCompletionRequest, ConversationContext } from '../types.js'

// ============================================================================
// CONTENT EXTRACTION
// ============================================================================

/**
 * Extracts text content from a message, handling various content formats
 *
 * @param message - Message object to extract content from
 * @returns Extracted text content
 */
export function extractTextContent(message: any): string {
  if (!message) return ''
  if (typeof message.content === 'string') return message.content

  if (Array.isArray(message.content)) {
    return message.content
      .map((part: any) => {
        if (typeof part === 'string') return part
        if (part?.type === 'text') return part.text || ''
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }

  return ''
}

// ============================================================================
// CONVERSATION CONTEXT BUILDERS
// ============================================================================

/**
 * Builds a structured conversation context from a request body
 *
 * @param requestBody - Chat completion request
 * @returns Structured conversation context
 */
export function buildConversationContext(
  requestBody: ChatCompletionRequest
): ConversationContext {
  const messages = Array.isArray(requestBody?.messages) ? requestBody.messages : []

  const systemMessages: string[] = []
  const userMessages: string[] = []
  const assistantMessages: string[] = []
  const toolMessages: Array<{
    name?: string
    content: string
    args?: Record<string, any>
  }> = []

  for (const msg of messages) {
    const content = extractTextContent(msg)

    if (msg.role === 'system') {
      systemMessages.push(content)
    } else if (msg.role === 'user') {
      userMessages.push(content)
    } else if (msg.role === 'assistant') {
      assistantMessages.push(content)
    } else if (msg.role === 'tool') {
      const toolMsg = msg as any
      toolMessages.push({
        name: toolMsg.name,
        content,
        args: toolMsg.arguments,
      })
    }
  }

  const lastToolMsg = toolMessages[toolMessages.length - 1]
  const latestToolResult = lastToolMsg
    ? {
        name: lastToolMsg.name || 'tool',
        content: lastToolMsg.content,
        args: lastToolMsg.args,
      }
    : undefined

  return {
    systemMessages,
    userMessages,
    assistantMessages,
    toolMessages,
    latestUserMessage: userMessages[userMessages.length - 1] || '',
    latestToolResult,
  }
}

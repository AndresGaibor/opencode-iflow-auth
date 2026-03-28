/**
 * System prompt builders for ACP/iFlow
 * Pure functions for constructing prompts
 */

import type { ChatCompletionRequest, ConversationContext } from '../types.js'
import { getEffectiveTools } from '../opencode-tools.js'

// ============================================================================
// SYSTEM PROMPT BUILDER
// ============================================================================

/**
 * Builds the OpenCode compatibility system prompt
 * Uses hardcoded tool definitions when request doesn't include tools
 *
 * @param tools - Array of tool definitions
 * @param ctx - Optional context (cwd, workspaceRoot)
 * @returns System prompt string
 */
export function buildOpenCodeCompatPrompt(
  tools: any[],
  ctx?: { cwd?: string; workspaceRoot?: string }
): string {
  // Use hardcoded tools if request doesn't include them
  const effectiveTools = getEffectiveTools(tools)

  const toolDefs = effectiveTools
    .map((t: any) => {
      const fn = t.function || t
      const params = fn.parameters?.properties || {}
      const required = fn.parameters?.required || []

      const paramsList = Object.entries(params)
        .map(([name, schema]: [string, any]) => {
          const req = required.includes(name) ? ' (required)' : ' (optional)'
          return `    - ${name}${req}: ${schema.description || schema.type || 'value'}`
        })
        .join('\n')

      return `  - ${fn.name}${paramsList ? '\n' + paramsList : ''}`
    })
    .join('\n\n')

  return `
You are operating inside OpenCode as a coding assistant.
Behave like a native OpenCode model.

Environment:
- Current working directory: ${ctx?.cwd || 'unknown'}
- Workspace root: ${ctx?.workspaceRoot || 'unknown'}

You have access to OpenCode's native tools.
Prefer OpenCode tools over any internal tool behavior.

When a user asks about a project or repository:
1. INSPECT the repository first using exploration tools
2. Prefer tools in this order: list, glob, grep, read
3. Only summarize AFTER exploration

Tool behavior rules:
- Use 'list' for directory contents
- Use 'glob' to discover files by pattern
- Use 'grep' to search text or symbol usage
- Use 'read' to inspect file contents
- Use 'edit' for precise string replacements (requires oldString, newString, filePath)
- Use 'write' for whole-file writes only when necessary
- Use 'bash' only if no native tool is suitable

Do NOT respond with generic acknowledgment like "I understand" when inspection is needed.
Do NOT stop at "I'm ready to help".
Inspect the codebase first, then provide your response.

Available OpenCode tools:
${toolDefs}
`.trim()
}

/**
 * Builds the turn prompt for a specific request
 *
 * @param params - Parameters including conversation and request body
 * @returns Turn prompt string
 */
export function buildTurnPrompt({
  conversation,
  requestBody,
}: {
  conversation: ConversationContext
  requestBody: ChatCompletionRequest
}): string {
  const lastMsg = Array.isArray(requestBody?.messages)
    ? requestBody.messages[requestBody.messages.length - 1]
    : null

  // If the last message is a tool result, format it properly
  if (lastMsg?.role === 'tool' && conversation.latestToolResult) {
    return formatToolResultForIFlow({
      toolName: conversation.latestToolResult.name,
      args: conversation.latestToolResult.args || {},
      output: conversation.latestToolResult.content,
      isError: false,
    })
  }

  // If there's a tool result followed by a user message
  if (conversation.latestToolResult && conversation.latestUserMessage) {
    const toolResultText = formatToolResultForIFlow({
      toolName: conversation.latestToolResult.name,
      args: conversation.latestToolResult.args || {},
      output: conversation.latestToolResult.content,
      isError: false,
    })
    return `${toolResultText}\n\nUser: ${conversation.latestUserMessage}`
  }

  // Normal user turn
  return conversation.latestUserMessage || 'Continue.'
}

/**
 * Formats a tool result for iFlow
 *
 * @param input - Tool result input (name, args, output)
 * @returns Formatted tool result string
 */
export function formatToolResultForIFlow(input: {
  toolName: string
  args: any
  output: string
  isError?: boolean
}): string {
  return [
    '=== Tool Result from OpenCode ===',
    `Tool: ${input.toolName}`,
    `Arguments: ${JSON.stringify(input.args || {})}`,
    `Status: ${input.isError ? 'error' : 'success'}`,
    'Output:',
    input.output || '(no output)',
    '=== End Tool Result ===',
  ].join('\n')
}

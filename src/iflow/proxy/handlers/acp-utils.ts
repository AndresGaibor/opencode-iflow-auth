/**
 * Pure utility functions for ACP handler.
 * Extracted for testability - these have no side effects and can be unit tested independently.
 */

import { createHash } from 'crypto'
import type { 
  ChatCompletionRequest, 
  ConversationContext, 
  NormalizedToolCall,
  ACPProcessingResult 
} from '../types.js'

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Creates a SHA256 hash truncated to 16 characters.
 */
export function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex').substring(0, 16)
}

/**
 * Creates a stable session key from a request body.
 * Uses model + first 6 messages to create a deterministic key.
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
 * Creates a hash of tool schemas for comparison.
 */
export function hashToolSchema(tools: any[]): string {
  if (!tools || tools.length === 0) return 'none'
  const schema = tools.map(t => {
    const fn = t.function || t
    return `${fn.name}:${Object.keys(fn.parameters?.properties || {}).join(',')}`
  }).join('|')
  return hashString(schema)
}

// ============================================================================
// CONTENT EXTRACTION
// ============================================================================

/**
 * Extracts text content from a message, handling various content formats.
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
 * Builds a structured conversation context from a request body.
 */
export function buildConversationContext(requestBody: ChatCompletionRequest): ConversationContext {
  const messages = Array.isArray(requestBody?.messages) ? requestBody.messages : []

  const systemMessages: string[] = []
  const userMessages: string[] = []
  const assistantMessages: string[] = []
  const toolMessages: Array<{ name?: string; content: string; args?: Record<string, any> }> = []

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
    ? { name: lastToolMsg.name || 'tool', content: lastToolMsg.content, args: lastToolMsg.args }
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

// ============================================================================
// SYSTEM PROMPT BUILDER
// ============================================================================

/**
 * Builds the OpenCode compatibility system prompt.
 */
export function buildOpenCodeCompatPrompt(
  tools: any[],
  ctx?: { cwd?: string; workspaceRoot?: string }
): string {
  const toolDefs = tools
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
 * Builds the turn prompt for a specific request.
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
 * Formats a tool result for iFlow.
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

// ============================================================================
// TOOL NORMALIZATION (OpenCode Schemas)
// ============================================================================

/**
 * Normalizes tool names and arguments to OpenCode-compatible format.
 * This is the critical function for ensuring tool compatibility.
 */
export function normalizeToolCall(name: string, args: any): NormalizedToolCall {
  let mappedName = name.trim()
  let mappedArgs = args || {}

  // Tool name redirection
  if (['run_shell_command', 'execute_command', 'run_command', 'shell', 'terminal', 'bash_execute'].includes(mappedName)) {
    mappedName = 'bash'
  } else if (['read_text_file', 'read_file', 'cat', 'getFile'].includes(mappedName)) {
    mappedName = 'read'
  } else if (['write_to_file', 'write_file', 'save_file', 'createFile'].includes(mappedName)) {
    mappedName = 'write'
  } else if (['edit_file', 'replace_in_file', 'modify_file', 'patch_file'].includes(mappedName)) {
    mappedName = 'edit'
  } else if (['search_web', 'fetch_url', 'curl'].includes(mappedName)) {
    mappedName = 'webfetch'
  } else if (['list_directory_with_sizes', 'list_directory', 'ls', 'list_dir', 'directory_tree'].includes(mappedName)) {
    // IMPORTANT: list_directory maps to 'list', NOT 'bash ls'
    mappedName = 'list'
  } else if (['find_files', 'glob_search', 'file_glob'].includes(mappedName)) {
    mappedName = 'glob'
  } else if (['search_files', 'file_search', 'find_in_files'].includes(mappedName)) {
    mappedName = 'grep'
  }

  // Schema-specific argument normalization
  let cleanedArgs: any = {}
  
  switch (mappedName) {
    case 'read':
      // OpenCode read: { path, offset?, limit? }
      cleanedArgs.path = mappedArgs.path || mappedArgs.filePath || mappedArgs.file || mappedArgs.filename || ''
      if (mappedArgs.offset !== undefined) cleanedArgs.offset = mappedArgs.offset
      if (mappedArgs.limit !== undefined) cleanedArgs.limit = mappedArgs.limit
      break
      
    case 'write':
      // OpenCode write: { filePath, content }
      cleanedArgs.filePath = mappedArgs.filePath || mappedArgs.path || mappedArgs.file || ''
      cleanedArgs.content = mappedArgs.content || mappedArgs.text || ''
      break
      
    case 'edit':
      // OpenCode edit: { filePath, oldString, newString, replaceAll? }
      cleanedArgs.filePath = mappedArgs.filePath || mappedArgs.path || mappedArgs.file || ''
      cleanedArgs.oldString = mappedArgs.oldString || mappedArgs.old_text || mappedArgs.search || mappedArgs.text || ''
      cleanedArgs.newString = mappedArgs.newString || mappedArgs.new_text || mappedArgs.replace || ''
      if (mappedArgs.replaceAll !== undefined) cleanedArgs.replaceAll = !!mappedArgs.replaceAll
      break
      
    case 'list':
      // OpenCode list: { path }
      cleanedArgs.path = mappedArgs.path || mappedArgs.filePath || mappedArgs.directory || '.'
      break
      
    case 'glob':
      // OpenCode glob: { pattern, path? }
      cleanedArgs.pattern = mappedArgs.pattern || mappedArgs.glob || '*'
      if (mappedArgs.path) cleanedArgs.path = mappedArgs.path
      break
      
    case 'grep':
      // OpenCode grep: { pattern, path?, include?, context_lines? }
      cleanedArgs.pattern = mappedArgs.pattern || mappedArgs.query || mappedArgs.search || ''
      if (mappedArgs.path) cleanedArgs.path = mappedArgs.path
      if (mappedArgs.include) cleanedArgs.include = mappedArgs.include
      if (mappedArgs.context_lines !== undefined) cleanedArgs.context_lines = mappedArgs.context_lines
      break
      
    case 'bash':
      // OpenCode bash: { command, timeout? }
      cleanedArgs.command = mappedArgs.command || mappedArgs.script || ''
      if (mappedArgs.timeout !== undefined) cleanedArgs.timeout = mappedArgs.timeout
      break
      
    case 'skill':
      // OpenCode skill: { skill, args? }
      cleanedArgs.skill = mappedArgs.skill || mappedArgs.name || ''
      if (mappedArgs.args) cleanedArgs.args = mappedArgs.args
      break
      
    case 'todowrite':
    case 'todo_write':
      mappedName = 'todowrite'
      // OpenCode todowrite: { todos }
      cleanedArgs.todos = Array.isArray(mappedArgs.todos) ? mappedArgs.todos : []
      break
      
    case 'todo_read':
      // OpenCode todo_read: no args
      break
      
    case 'task':
      // OpenCode task (subagent): { description, prompt, subagent_type, useContext? }
      cleanedArgs.description = mappedArgs.description || ''
      cleanedArgs.prompt = mappedArgs.prompt || mappedArgs.task || ''
      cleanedArgs.subagent_type = mappedArgs.subagent_type || mappedArgs.type || 'general-purpose'
      if (mappedArgs.useContext !== undefined) cleanedArgs.useContext = !!mappedArgs.useContext
      if (mappedArgs.constraints) cleanedArgs.constraints = mappedArgs.constraints
      break
      
    default:
      // MCP tools: pass through unchanged (mcp__ prefix)
      // Unknown tools: pass through
      cleanedArgs = mappedArgs
  }

  return { name: mappedName, args: cleanedArgs }
}

// ============================================================================
// ACP TOOL CALL EXTRACTION
// ============================================================================

/**
 * Extracts a native tool call from an ACP message.
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
 * Extracts a tool call from text using the <<USA_TOOL>> marker format.
 */
export function extractToolCallFromText(text: string): { name: string; args: any } | null {
  if (!text || !text.includes('<<USA_TOOL>>')) return null

  const match = text.match(/<<USA_TOOL>>\s*([\w.-]+)\s*(\{[\s\S]*?\})?\s*(?:<<\/USA_TOOL>>|$)/)
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
 * Extracts reasoning from an ACP message.
 */
export function extractReasoning(msg: any): string {
  if (msg?.chunk?.thought) return msg.chunk.thought
  if (msg?.reasoning) return msg.reasoning
  return ''
}

/**
 * Extracts text content from an ACP message.
 */
export function extractACPText(msg: any): string {
  if (msg?.chunk?.text) return msg.chunk.text
  if (msg?.content) return msg.content
  if (typeof msg === 'string') return msg
  return ''
}

/**
 * Checks if a message indicates task completion.
 */
export function isACPDoneMessage(msg: any): boolean {
  return msg?.type === 'TASK_FINISH' || 
         msg?.messageType === 'TASK_FINISH' ||
         msg?.stopReason !== undefined
}

// ============================================================================
// ACP MESSAGE PROCESSING
// ============================================================================

/**
 * Processes an ACP message and returns a structured result.
 * Priority: native tool call > fallback textual tool call > content > done
 */
export function processACPMessage(msg: any): ACPProcessingResult {
  if (!msg) return { type: 'noop' }

  // Priority 1: Native tool call from ACP
  const nativeToolCall = extractNativeACPToolCall(msg)
  if (nativeToolCall) {
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

// ============================================================================
// SESSION TTL CONSTANTS
// ============================================================================

export const SESSION_TTL_MS = 1000 * 60 * 30 // 30 minutes

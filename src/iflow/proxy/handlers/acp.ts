import { ServerResponse } from 'http'
import { randomUUID, createHash } from 'crypto'
import { IFlowClient, PermissionMode, MessageType, ToolCallStatus } from '@iflow-ai/iflow-cli-sdk'
import * as logger from '../../../plugin/logger.js'
import { log } from '../utils.js'
import type { 
  ChatCompletionRequest, 
  StreamChunk, 
  SessionState, 
  ConversationContext,
  NormalizedToolCall,
  ACPProcessingResult 
} from '../types.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

// User requested debug logs in ~/.config/opencode/iflow-logs
const LOG_DIR = path.join(os.homedir(), '.config', 'opencode', 'iflow-logs')
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}
const ACP_LOG_FILE = path.join(LOG_DIR, 'acp-proxy.log')

function fileLog(message: string) {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${message}\n`
  try {
    fs.appendFileSync(ACP_LOG_FILE, line)
  } catch (e) {
    console.error('Failed to write to acp-proxy.log', e)
  }
}

// ============================================================================
// SESSION STORE
// ============================================================================

const acpSessions = new Map<string, SessionState>()
const SESSION_TTL_MS = 1000 * 60 * 30 // 30 minutes

function cleanupExpiredSessions(): void {
  const now = Date.now()
  for (const [key, session] of acpSessions.entries()) {
    if (now - session.lastActivityAt > SESSION_TTL_MS) {
      try {
        session.client?.disconnect?.()
      } catch {}
      acpSessions.delete(key)
      fileLog(`[SESSION CLEANUP] Removed expired session: ${key.substring(0, 8)}...`)
    }
  }
}

function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex').substring(0, 16)
}

function makeSessionKey(requestBody: ChatCompletionRequest): string {
  const model = requestBody?.model || 'unknown'
  const msgs = Array.isArray(requestBody?.messages) ? requestBody.messages : []
  
  // Create stable key from first few messages + model
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

function hashToolSchema(tools: any[]): string {
  if (!tools || tools.length === 0) return 'none'
  const schema = tools.map(t => {
    const fn = t.function || t
    return `${fn.name}:${Object.keys(fn.parameters?.properties || {}).join(',')}`
  }).join('|')
  return hashString(schema)
}

// Tools internas de iflow que deben ser desactivadas para usar las de OpenCode
const IFLOW_INTERNAL_TOOLS = [
  'read_text_file',
  'read_multiple_files',
  'write_to_file',
  'list_directory',
  'list_directory_with_sizes',
  'directory_tree',
  'execute_command',
  'run_command',
  'run_shell_command',
  'todo_write',
  'todo_read',
  'create_directory',
  'move_file',
  'delete_file',
  'search_files',
  'file_search',
  'computer_use',
  'bash',
  'sh',
  'python',
  'edit',
  'sed',
  'grep'
]

// ============================================================================
// CONVERSATION CONTEXT BUILDERS
// ============================================================================

function extractTextContent(message: any): string {
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

function buildConversationContext(requestBody: ChatCompletionRequest): ConversationContext {
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

function buildOpenCodeCompatPrompt(
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

function buildTurnPrompt({
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

function formatToolResultForIFlow(input: {
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

function normalizeToolCall(name: string, args: any): NormalizedToolCall {
  const originalName = name
  const originalArgs = JSON.stringify(args)
  
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

  if (mappedName !== originalName) {
    fileLog(`[TOOL NORMALIZATION] Mapped tool name: ${originalName} -> ${mappedName}`)
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
      
    default:
      // Unknown tool - pass through
      cleanedArgs = mappedArgs
  }

  const finalArgs = JSON.stringify(cleanedArgs)
  if (originalArgs !== finalArgs) {
    fileLog(`[TOOL NORMALIZATION] Args corrected: ${originalArgs} -> ${finalArgs}`)
  }

  return { name: mappedName, args: cleanedArgs }
}

// ============================================================================
// ACP TOOL CALL EXTRACTION
// ============================================================================

function extractNativeACPToolCall(msg: any): { name: string; args: any } | null {
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

function extractToolCallFromText(text: string): { name: string; args: any } | null {
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
    fileLog(`[TOOL TEXT PARSE ERROR] Failed to parse: ${rawArgs}`)
    return null
  }
}

function extractReasoning(msg: any): string {
  if (msg?.chunk?.thought) return msg.chunk.thought
  if (msg?.reasoning) return msg.reasoning
  return ''
}

function extractACPText(msg: any): string {
  if (msg?.chunk?.text) return msg.chunk.text
  if (msg?.content) return msg.content
  if (typeof msg === 'string') return msg
  return ''
}

function isACPDoneMessage(msg: any): boolean {
  return msg?.type === MessageType.TASK_FINISH || 
         msg?.messageType === 'TASK_FINISH' ||
         msg?.stopReason !== undefined
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

async function getOrCreateSession({
  sessionKey,
  model,
  tools,
  conversation,
}: {
  sessionKey: string
  model: string
  tools: any[]
  conversation: ConversationContext
}): Promise<SessionState> {
  const existing = acpSessions.get(sessionKey)
  if (existing && existing.client?.isConnected?.()) {
    existing.lastActivityAt = Date.now()
    fileLog(`[SESSION] Reusing session: ${sessionKey.substring(0, 8)}... model=${model}`)
    return existing
  }

  fileLog(`[SESSION] Creating new session: ${sessionKey.substring(0, 8)}... model=${model}`)
  
  const compatPrompt = buildOpenCodeCompatPrompt(tools)
  
  const client = new IFlowClient({
    permissionMode: PermissionMode.MANUAL,
    autoStartProcess: true,
    logLevel: 'ERROR',
    sessionSettings: {
      disallowed_tools: IFLOW_INTERNAL_TOOLS,
      append_system_prompt: compatPrompt,
    }
  })
  
  await client.connect()
  
  try {
    await client.config.set('model', model)
  } catch (err) {
    fileLog(`[SESSION] Warning: Could not set model: ${err}`)
  }

  const session: SessionState = {
    sessionKey,
    model,
    client,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    initialized: false,
    toolSchemaHash: hashToolSchema(tools),
  }

  acpSessions.set(sessionKey, session)
  fileLog(`[SESSION] Session created and stored: ${sessionKey.substring(0, 8)}...`)
  
  return session
}

async function initializeSessionIfNeeded({
  session,
  conversation,
}: {
  session: SessionState
  conversation: ConversationContext
}): Promise<void> {
  if (session.initialized) return

  // Inject system context on first turn
  const systemBlock = conversation.systemMessages.join('\n\n')
  
  if (systemBlock.trim()) {
    fileLog(`[SESSION INIT] Injecting system context (${systemBlock.length} chars)`)
    // System messages are already included via append_system_prompt in session settings
  }

  session.initialized = true
  fileLog(`[SESSION INIT] Session initialized: ${session.sessionKey.substring(0, 8)}...`)
}

// ============================================================================
// STREAM EMITTERS
// ============================================================================

function emitReasoningChunk(res: ServerResponse, chatId: string, created: number, model: string, reasoning: string) {
  if (!reasoning) return
  const chunk: StreamChunk = {
    id: chatId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{
      index: 0,
      delta: { role: 'assistant', reasoning_content: reasoning, thought: reasoning } as any,
      finish_reason: null
    }]
  }
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
}

function emitContentChunk(res: ServerResponse, chatId: string, created: number, model: string, content: string) {
  if (!content) return
  const chunk: StreamChunk = {
    id: chatId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{
      index: 0,
      delta: { content },
      finish_reason: null
    }]
  }
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
}

function emitToolCallChunk(res: ServerResponse, chatId: string, created: number, model: string, toolCall: NormalizedToolCall) {
  const openAIToolCall = {
    index: 0,
    id: `call_${randomUUID()}`,
    type: 'function' as const,
    function: {
      name: toolCall.name,
      arguments: JSON.stringify(toolCall.args)
    }
  }
  
  const chunk: StreamChunk = {
    id: chatId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{
      index: 0,
      delta: { role: 'assistant', tool_calls: [openAIToolCall] } as any,
      finish_reason: 'tool_calls'
    }]
  }
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
}

function emitFinalDoneChunk(res: ServerResponse, chatId: string, created: number, model: string, reason: string = 'stop') {
  const chunk: StreamChunk = {
    id: chatId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{
      index: 0,
      delta: {},
      finish_reason: reason === 'max_tokens' ? 'length' : 'stop'
    }]
  }
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
}

// ============================================================================
// ACP MESSAGE PROCESSING
// ============================================================================

function processACPMessage(msg: any): ACPProcessingResult {
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
// MAIN HANDLER
// ============================================================================

export async function handleACPStreamRequest(
  request: ChatCompletionRequest,
  res: ServerResponse,
  enableLog: boolean
): Promise<void> {
  // Cleanup expired sessions first
  cleanupExpiredSessions()

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  const chatId = `iflow-${randomUUID()}`
  const created = Math.floor(Date.now() / 1000)
  const model = request.model
  const tools = request.tools || []

  // Build session key from conversation context
  const sessionKey = makeSessionKey(request)
  const conversation = buildConversationContext(request)

  fileLog(`[REQ] sessionKey=${sessionKey.substring(0, 8)}... model=${model} msgCount=${request.messages.length}`)

  // Get or create session
  let session: SessionState
  try {
    session = await getOrCreateSession({
      sessionKey,
      model,
      tools,
      conversation,
    })
  } catch (error: any) {
    fileLog(`[ERROR] Failed to create session: ${error.message}`)
    emitFinalDoneChunk(res, chatId, created, model)
    return
  }

  // Update session activity
  session.lastActivityAt = Date.now()

  // Initialize session if needed
  await initializeSessionIfNeeded({ session, conversation })

  // Build turn prompt
  const turnPrompt = buildTurnPrompt({ conversation, requestBody: request })
  
  fileLog(`[TURN] Sending: ${turnPrompt.substring(0, 150)}...`)
  if (enableLog) logger.log(`[IFlowACP] Sending: ${turnPrompt.substring(0, 100)}...`)

  // State for streaming
  const state = {
    reasoningBuffer: '',
    contentBuffer: '',
    emittedToolCall: false,
    finished: false,
  }

  try {
    await session.client.sendMessage(turnPrompt)

    for await (const message of session.client.receiveMessages()) {
      if (state.finished) break

      const result = processACPMessage(message)

      // Emit reasoning if present
      if (result.reasoning) {
        state.reasoningBuffer += result.reasoning
        emitReasoningChunk(res, chatId, created, model, result.reasoning)
      }

      switch (result.type) {
        case 'tool_call':
          fileLog(`[TOOL CALL] ${result.toolCall.name} -> ${JSON.stringify(result.toolCall.args)}`)
          emitToolCallChunk(res, chatId, created, model, result.toolCall)
          state.emittedToolCall = true
          state.finished = true
          return // Stop processing - OpenCode will execute the tool

        case 'content':
          state.contentBuffer += result.content
          // Check for inline tool call markers in content
          if (result.content.includes('<<USA_TOOL>>')) {
            // Don't emit content that contains tool markers - will be extracted
          } else {
            emitContentChunk(res, chatId, created, model, result.content)
          }
          break

        case 'done':
          state.finished = true
          break

        case 'noop':
          // Handle other message types
          if (message.type === MessageType.ASK_USER_QUESTIONS) {
            const askMsg = message as any
            if (askMsg.questions && askMsg.questions.length > 0) {
              const answers: Record<string, string> = {}
              for (const q of askMsg.questions) {
                if (q.options && q.options.length > 0) {
                  answers[q.header] = q.options[0].label
                }
              }
              session.client.respondToAskUserQuestions(answers).catch(() => {})
            }
          } else if (message.type === MessageType.EXIT_PLAN_MODE) {
            session.client.respondToExitPlanMode(true).catch(() => {})
          } else if (message.type === MessageType.PERMISSION_REQUEST) {
            // Block internal tool execution - delegate to OpenCode
            const permMsg = message as any
            fileLog(`[PERMISSION] Blocking: ${JSON.stringify(permMsg)}`)
            
            if (permMsg.options && permMsg.options.length > 0) {
              const denyOption = permMsg.options.find(
                (o: any) => o.type === 'deny' || o.label?.toLowerCase().includes('deny')
              )
              if (denyOption) {
                session.client.respondToToolConfirmation(permMsg.requestId, denyOption.optionId).catch(() => {})
              }
            }
          } else if (message.type === MessageType.ERROR) {
            const errorMsg = message as any
            fileLog(`[ERROR] ACP Error: ${errorMsg.message}`)
          }
          break
      }
    }

    // Natural finish
    if (!state.emittedToolCall) {
      fileLog(`[STREAM END] Natural finish, content length: ${state.contentBuffer.length}`)
      emitFinalDoneChunk(res, chatId, created, model)
    }

  } catch (error: any) {
    fileLog(`[EXCEPTION] ${error.message}`)
    
    if (!state.emittedToolCall) {
      const errorChunk: StreamChunk = {
        id: chatId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: { content: `Error: ${error.message}` },
          finish_reason: 'stop'
        }]
      }
      res.write(`data: ${JSON.stringify(errorChunk)}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
}

// ============================================================================
// CLEANUP
// ============================================================================

export async function cleanupACPClients(): Promise<void> {
  fileLog(`[CLEANUP] Cleaning up ${acpSessions.size} sessions`)
  for (const [key, session] of acpSessions) {
    try {
      await session.client.disconnect()
    } catch (err) {}
  }
  acpSessions.clear()
}

process.on('SIGINT', cleanupACPClients)
process.on('SIGTERM', cleanupACPClients)

import { ServerResponse } from 'http'
import { randomUUID } from 'crypto'
import { IFlowClient, PermissionMode, MessageType, ToolCallStatus } from '@iflow-ai/iflow-cli-sdk'
import * as logger from '../../../plugin/logger.js'
import { log } from '../utils.js'
import type { ChatCompletionRequest, StreamChunk } from '../types.js'
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

// Tools internas de iflow que deben ser desactivadas para usar las de OpenCode
const IFLOW_INTERNAL_TOOLS = [
  'read_text_file',
  'read_multiple_files',
  'write_to_file',
  'list_directory',
  'directory_tree',
  'execute_command',
  'run_command',
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

// Store active ACP clients by model
const acpClients = new Map<string, IFlowClient>()

function buildToolsSystemPrompt(tools: any[]): string {
  if (!tools || tools.length === 0) return ''
  
  const toolDefs = tools.map((t: any) => {
    const fn = t.function || t
    const params = fn.parameters?.properties || {}
    const required = fn.parameters?.required || []
    
    const paramsList = Object.entries(params).map(([name, schema]: [string, any]) => {
      const req = required.includes(name) ? ' (required)' : ' (optional)'
      return `  - "${name}": ${schema.type || 'string'}${req} — ${schema.description || ''}`
    }).join('\n')
    
    return `### ${fn.name}\n${fn.description || ''}\nParameters JSON Map:\n${paramsList || '  (none)'}`
  }).join('\n\n')

  return `\n\n## IMPORTANT: External Tool Usage
You have access to external tools executed by OpenCode (the editor). DO NOT USE ANY INTERNAL TOOLS like read_text_file or execute_command.
Available Tools:
${toolDefs}

To execute an external tool, you MUST use the native tool calling capability or output exact text in the following format and then STOP immediately:
<<USA_TOOL>>{"name": "TOOL_NAME", "arguments": {"param1": "value1"}}<</USA_TOOL>>

Example:
<<USA_TOOL>>{"name": "read", "arguments": {"path": "src/index.ts"}}<</USA_TOOL>>
`
}

/**
 * Get or create an ACP client for a specific model
 */
async function getACPClient(model: string, tools: any[], isNewChat: boolean): Promise<IFlowClient> {
  let client = acpClients.get(model)
  
  // Restart if requested (e.g., new chat session in OpenCode)
  if (isNewChat && client) {
    fileLog(`Restarting ACP client for model ${model} due to new chat session`)
    try { await client.disconnect() } catch {}
    client = undefined
  }

  if (client && client.isConnected()) {
    return client
  }
  
  fileLog(`Creating new ACP client for model: ${model}`)
  
  const appendPrompt = buildToolsSystemPrompt(tools)

  client = new IFlowClient({
    permissionMode: PermissionMode.MANUAL,
    autoStartProcess: true,
    logLevel: 'ERROR',
    sessionSettings: {
      disallowed_tools: IFLOW_INTERNAL_TOOLS,
      ...(appendPrompt ? { append_system_prompt: appendPrompt } : {})
    }
  })
  
  await client.connect()
  
  try {
    await client.config.set('model', model)
  } catch (err) {}
  
  acpClients.set(model, client)
  return client
}

export async function handleACPStreamRequest(
  request: ChatCompletionRequest,
  res: ServerResponse,
  enableLog: boolean
): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  const chatId = `iflow-${randomUUID()}`
  const created = Math.floor(Date.now() / 1000)
  
  const tools = request.tools || []
  
  // Determine if this is a new chat (only system and max 1 user msg)
  const isNewChat = request.messages.length <= 2 
  const client = await getACPClient(request.model, tools, isNewChat)
  
  // Figure out what text to send to the iFlow CLI stateful session
  const lastMessage = request.messages.length > 0 ? request.messages[request.messages.length - 1] : null
  const prevMessage = request.messages.length > 1 ? request.messages[request.messages.length - 2] : null

  let sendText = ''
  
  if (lastMessage && lastMessage.role === 'tool') {
    // This is a tool execution result from OpenCode!
    const toolCallName = (lastMessage as any).name || 'tool'
    sendText = `[Tool Execution Result for ${toolCallName}]\n${lastMessage.content}`
  } else if (lastMessage && lastMessage.role === 'user') {
    sendText = typeof lastMessage.content === 'string' ? lastMessage.content : ''
    
    // Safety check: if there is a tool result but user appended a new message right after
    if (prevMessage && prevMessage.role === 'tool') {
      const toolCallName = (prevMessage as any).name || 'tool'
      sendText = `[Tool Execution Result for ${toolCallName}]\n${prevMessage.content}\n\nUser: ${sendText}`
    }
  }

  if (!sendText) sendText = "Continue."

  try {
    fileLog(`[REQ] model=${request.model} msgLen=${request.messages.length} sendText=${sendText.substring(0, 100)}`)
    if (enableLog) logger.log(`[IFlowACP] Sending text to CLI: ${sendText.substring(0, 100)}...`)
    await client.sendMessage(sendText)

    // Buffers for parsing
    let contentBuffer = ''
    let isExtractingTool = false
    let toolString = ''

    for await (const message of client.receiveMessages()) {
      switch (message.type) {
        case MessageType.ASSISTANT:
          const assistantMsg = message as any
          if (assistantMsg.chunk?.thought) {
            // Reasoning content in stream
            const chunk: StreamChunk = {
              id: chatId, object: 'chat.completion.chunk', created, model: request.model,
              choices: [{ index: 0, delta: { reasoning_content: assistantMsg.chunk.thought }, finish_reason: null }]
            }
            res.write(`data: ${JSON.stringify(chunk)}\n\n`)
          } else if (assistantMsg.chunk?.text) {
            const text = assistantMsg.chunk.text
            contentBuffer += text
            
            // Text Parsing Engine for tools
            if (!isExtractingTool) {
              const startIdx = contentBuffer.indexOf('<<USA_TOOL>>')
              if (startIdx !== -1) {
                // Found start of tool call - flush EVERYTHING before the tag
                const normalText = contentBuffer.substring(0, startIdx)
                if (normalText) {
                  const chunk: StreamChunk = {
                    id: chatId, object: 'chat.completion.chunk', created, model: request.model,
                    choices: [{ index: 0, delta: { content: normalText }, finish_reason: null }]
                  }
                  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
                }
                
                isExtractingTool = true
                // Start filling toolString with the rest of the buffer after the tag
                toolString = contentBuffer.substring(startIdx + 12)
                contentBuffer = ''
              } else {
                // We haven't seen the full tag yet, but we might have a partial one at the end
                // Find potential start of tag '<'
                const lastLt = contentBuffer.lastIndexOf('<')
                
                if (lastLt === -1) {
                  // No tag start suspected, flush everything
                  const chunk: StreamChunk = {
                    id: chatId, object: 'chat.completion.chunk', created, model: request.model,
                    choices: [{ index: 0, delta: { content: contentBuffer }, finish_reason: null }]
                  }
                  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
                  contentBuffer = ''
                } else if (contentBuffer.length - lastLt > 12) {
                  // Buffer has something starting with '<' but it's longer than the actual tag length 
                  // and didn't match '<<USA_TOOL>>' (checked above), so it's probably just normal text
                  const chunk: StreamChunk = {
                    id: chatId, object: 'chat.completion.chunk', created, model: request.model,
                    choices: [{ index: 0, delta: { content: contentBuffer }, finish_reason: null }]
                  }
                  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
                  contentBuffer = ''
                } else {
                  // Suspect a tag might be starting at the end - flush everything BEFORE the '<'
                  const flushText = contentBuffer.substring(0, lastLt)
                  if (flushText) {
                    const chunk: StreamChunk = {
                      id: chatId, object: 'chat.completion.chunk', created, model: request.model,
                      choices: [{ index: 0, delta: { content: flushText }, finish_reason: null }]
                    }
                    res.write(`data: ${JSON.stringify(chunk)}\n\n`)
                  }
                  contentBuffer = contentBuffer.substring(lastLt)
                }
              }
            } else {
              // We ARE extracting a tool call
              toolString += text
              contentBuffer = '' // Clear it just in case
            }

            // Check if tool call has finished
            if (isExtractingTool && toolString.includes('<</USA_TOOL>>')) {
              const toolContent = (toolString.split('<</USA_TOOL>>')[0] || '').trim()
              fileLog(`[TOOL PARSED] Payload: ${toolContent}`)
              if (enableLog) logger.log(`[IFlowACP] Extracted Tool JSON: ${toolContent}`)
              
              // Parse JSON and emit tool_calls to OpenCode and FORCE CLOSE stream
              try {
                const toolJson = JSON.parse(toolContent)
                
                // --- Robust Tool Name Mapping ---
                // GLM-5 might hallucinate internal or generic tool names. Map them to OpenCode's required names.
                let mappedName = toolJson.name
                if (['run_shell_command', 'execute_command', 'run_command', 'shell'].includes(mappedName)) {
                  mappedName = 'bash'
                } else if (['read_text_file', 'read_file', 'cat'].includes(mappedName)) {
                  mappedName = 'read'
                } else if (['write_to_file', 'write_file', 'save_file'].includes(mappedName)) {
                  mappedName = 'write'
                } else if (['edit_file', 'replace_in_file', 'modify_file'].includes(mappedName)) {
                  mappedName = 'edit'
                } else if (['search_web', 'fetch_url', 'curl'].includes(mappedName)) {
                  mappedName = 'webfetch'
                }
                
                // If it's bash, it needs 'description' field too! If missing, hallucinate one
                if (mappedName === 'bash' && (!toolJson.arguments || !toolJson.arguments.description)) {
                  toolJson.arguments = toolJson.arguments || {}
                  toolJson.arguments.description = "Auto-generated bash description"
                }

                const openAIToolCall = {
                  index: 0,
                  id: `call_${randomUUID()}`,
                  type: 'function' as const,
                  function: {
                    name: mappedName,
                    arguments: JSON.stringify(toolJson.arguments || {})
                  }
                }
                
                const chunk: StreamChunk = {
                  id: chatId, object: 'chat.completion.chunk', created, model: request.model,
                  choices: [{ index: 0, delta: { tool_calls: [openAIToolCall] }, finish_reason: 'tool_calls' }]
                }
                res.write(`data: ${JSON.stringify(chunk)}\n\n`)
                res.write('data: [DONE]\n\n')
                res.end()
                fileLog(`[TOOL EXECUTED] Mapped ${toolJson.name} -> ${mappedName}. Sent tool_calls delta to OpenCode and forcefully closed stream.`)
                return // We forcefully exit the stream block
              } catch (e) {
                fileLog(`[TOOL ERROR] Failed to parse JSON: ${toolContent}`)
              }
            }
          }
          break

        case MessageType.TOOL_CALL:
          const toolCallMsg = message as any
          fileLog(`[NATIVE TOOL CALL] Intercepted: ${JSON.stringify(toolCallMsg)}`)
          
          // We want to catch the tool call as early as possible (status: pending)
          // to prevent internal execution and forward to OpenCode.
          if (toolCallMsg.toolName) {
            const toolName = toolCallMsg.toolName
            const args = toolCallMsg.args || {}
            
            // Map tool names to OpenCode equivalents
            let mappedName = toolName
            if (['run_shell_command', 'execute_command', 'run_command', 'shell', 'terminal', 'bash_execute'].includes(mappedName)) {
              mappedName = 'bash'
            } else if (['read_text_file', 'read_file', 'cat', 'getFile'].includes(mappedName)) {
              mappedName = 'read'
            } else if (['write_to_file', 'write_file', 'save_file', 'createFile'].includes(mappedName)) {
              mappedName = 'write'
            } else if (['edit_file', 'replace_in_file', 'modify_file', 'patch_file'].includes(mappedName)) {
              mappedName = 'edit'
            }
            
            const openAIToolCall = {
              index: 0,
              id: `call_${randomUUID()}`,
              type: 'function' as const,
              function: {
                name: mappedName,
                arguments: JSON.stringify(args)
              }
            }
            
            const chunk: StreamChunk = {
              id: chatId, object: 'chat.completion.chunk', created, model: request.model,
              choices: [{ index: 0, delta: { tool_calls: [openAIToolCall] }, finish_reason: 'tool_calls' }]
            }
            res.write(`data: ${JSON.stringify(chunk)}\n\n`)
            res.write('data: [DONE]\n\n')
            res.end()
            fileLog(`[TOOL INTERCEPTED] Forwarded ${toolName} -> ${mappedName} to OpenCode. Ending stream.`)
            return // Stop processing current iFlow stream
          }
          break

        case MessageType.TASK_FINISH:
          // If we reach natural finish without tools
          const finishMsg = message as any
          const finishChunk: StreamChunk = {
            id: chatId, object: 'chat.completion.chunk', created, model: request.model,
            choices: [{ index: 0, delta: {}, finish_reason: finishMsg.stopReason === 'max_tokens' ? 'length' : 'stop' }]
          }
          res.write(`data: ${JSON.stringify(finishChunk)}\n\n`)
          res.write('data: [DONE]\n\n')
          res.end()
          fileLog(`[STREAM END] Natural finish: ${finishMsg.stopReason}`)
          return

        case MessageType.ERROR:
          const errorMsg = message as any
          fileLog(`[ERROR] ACP Message Error: ${errorMsg.message}`)
          break
          
        case MessageType.ASK_USER_QUESTIONS:
          const askMsg = message as any
          if (askMsg.questions && askMsg.questions.length > 0) {
            const answers: Record<string, string> = {}
            for (const q of askMsg.questions) {
              if (q.options && q.options.length > 0) answers[q.header] = q.options[0].label
            }
            client.respondToAskUserQuestions(answers).catch(() => {})
          }
          continue

        case MessageType.EXIT_PLAN_MODE:
          client.respondToExitPlanMode(true).catch(() => {})
          continue

        case MessageType.PERMISSION_REQUEST:
          const permMsg = message as any
          fileLog(`[PERMISSION REQUEST] ${JSON.stringify(permMsg)}`)
          
          // DO NOT auto-approve tool execution permissions. 
          // We want to intercept the TOOL_CALL and let OpenCode handle it.
          // If we approve here, iFlow's CLI might execute it before we catch the TOOL_CALL text/event.
          if (permMsg.options && permMsg.options.length > 0) {
            // Only auto-approve if NOT a tool execution. 
            // Most permission requests in iFlow CLI are for tools.
            const isToolPermission = true // Assume tool related in this context
            
            if (isToolPermission) {
              fileLog(`[PERMISSION DENIED] Blocked internal tool execution to delegate to OpenCode.`)
              // We don't respond, or we respond with a denial if possible.
              // For now, doing nothing might be safer or we can find the "deny" optionId.
              const denyOption = permMsg.options.find((o: any) => o.type === 'deny' || o.label?.toLowerCase().includes('deny'))
              if (denyOption) {
                client.respondToToolConfirmation(permMsg.requestId, denyOption.optionId).catch(() => {})
              }
            } else {
              client.respondToToolConfirmation(permMsg.requestId, permMsg.options[0].optionId).catch(() => {})
            }
          }
          continue
      }
    }

  } catch (error: any) {
    fileLog(`[EXCEPTION] Proxy Error: ${error.message}`)
    const errorChunk: StreamChunk = {
      id: chatId, object: 'chat.completion.chunk', created, model: request.model,
      choices: [{ index: 0, delta: { content: `Error: ${error.message}` }, finish_reason: 'stop' }]
    }
    res.write(`data: ${JSON.stringify(errorChunk)}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  }
}

export async function cleanupACPClients(): Promise<void> {
  for (const [model, client] of acpClients) {
    try { await client.disconnect() } catch (err) {}
  }
  acpClients.clear()
}

process.on('SIGINT', cleanupACPClients)
process.on('SIGTERM', cleanupACPClients)

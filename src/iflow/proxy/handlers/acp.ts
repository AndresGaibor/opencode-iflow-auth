import { ServerResponse } from 'http'
import { randomUUID } from 'crypto'
import { IFlowClient, PermissionMode, MessageType, ToolCallStatus } from '@iflow-ai/iflow-cli-sdk'
import * as logger from '../../../plugin/logger.js'
import { log } from '../utils.js'
import type { ChatCompletionRequest, StreamChunk } from '../types.js'

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
]

// Store active ACP clients — keyed by model+toolsHash para detectar cambios
const acpClients = new Map<string, { client: IFlowClient; toolsHash: string }>()

// Track tool call indices for proper OpenAI format
let toolCallIndex = 0

/**
 * Hash simple de las tools para detectar cambios de sesión
 */
function hashTools(tools: any[]): string {
  if (!tools || tools.length === 0) return 'no-tools'
  return tools.map(t => t.function?.name || t.name || '').sort().join(',')
}

/**
 * Construye un append_system_prompt con las definiciones de tools de OpenCode
 * para que glm-5 use exactamente esos nombres en sus tool_calls
 */
function buildToolsSystemPrompt(tools: any[]): string {
  if (!tools || tools.length === 0) return ''
  
  const toolDefs = tools.map((t: any) => {
    const fn = t.function || t
    const params = fn.parameters?.properties || {}
    const required = fn.parameters?.required || []
    
    const paramsList = Object.entries(params).map(([name, schema]: [string, any]) => {
      const req = required.includes(name) ? ' (required)' : ' (optional)'
      return `  - ${name}: ${schema.type || 'string'}${req} — ${schema.description || ''}`
    }).join('\n')
    
    return `### ${fn.name}\n${fn.description || ''}\nParameters:\n${paramsList || '  (none)'}`
  }).join('\n\n')

  return `\n\n## IMPORTANT: Tool Use Instructions\n\nYou MUST use ONLY the following tools. Do NOT use any other tool names.\nCall these tools using their EXACT names as listed below:\n\n${toolDefs}\n\nNever use: read_text_file, write_to_file, list_directory, directory_tree, todo_write, execute_command, or any other tool not listed above.`
}

/**
 * Get or create an ACP client for a specific model + tools combination
 */
async function getACPClient(model: string, tools: any[]): Promise<IFlowClient> {
  const toolsHash = hashTools(tools)
  const cacheKey = model
  const cached = acpClients.get(cacheKey)
  
  // Reusar cliente si el hash de tools no cambió
  if (cached && cached.client.isConnected() && cached.toolsHash === toolsHash) {
    return cached.client
  }
  
  // Desconectar cliente anterior si existe
  if (cached) {
    try { await cached.client.disconnect() } catch {}
  }
  
  log(`Creating new ACP client for model: ${model} (tools: ${toolsHash})`)
  
  const appendPrompt = buildToolsSystemPrompt(tools)
  
  const client = new IFlowClient({
    permissionMode: PermissionMode.AUTO,
    autoStartProcess: true,
    logLevel: 'ERROR',
    sessionSettings: {
      permission_mode: 'yolo',
      // Desactivar tools internas de iflow
      disallowed_tools: IFLOW_INTERNAL_TOOLS,
      // Inyectar definiciones de tools de OpenCode al system prompt
      ...(appendPrompt ? { append_system_prompt: appendPrompt } : {}),
    }
  })
  
  await client.connect()
  
  // Set the model if specified
  try {
    await client.config.set('model', model)
    log(`Model set to: ${model}`)
  } catch (err) {
    log(`Warning: Could not set model: ${err}`)
  }
  
  acpClients.set(cacheKey, { client, toolsHash })
  return client
}

/**
 * Convert ACP ToolCallMessage to OpenAI tool_calls format
 */
function convertToolCallToOpenAI(message: any): any {
  return {
    index: toolCallIndex++,
    id: message.id || `call_${randomUUID()}`,
    type: 'function' as const,
    function: {
      name: message.toolName || message.label || 'unknown_tool',
      arguments: JSON.stringify(message.args || {})
    }
  }
}

/**
 * Handle streaming request using ACP protocol
 */
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
  
  // Reset tool call index for new request
  toolCallIndex = 0

  // Build the prompt from messages
  const userMessages = request.messages.filter(m => m.role === 'user')
  const lastUserMessage = userMessages[userMessages.length - 1]
  const promptText = typeof lastUserMessage?.content === 'string' 
    ? lastUserMessage.content 
    : ''

  const tools = request.tools || []

  try {
    // Pasar tools al cliente para que iflow inyecte el system prompt correcto
    const client = await getACPClient(request.model, tools)
    
    if (enableLog) {
      logger.log(`[IFlowACP] [Request] model=${request.model} tools=${tools.length} prompt=${promptText.substring(0, 100)}...`)
    }

    // Send the message
    await client.sendMessage(promptText)

    // Track current tool call
    let currentToolCall: any = null

    // Process messages
    for await (const message of client.receiveMessages()) {
      if (enableLog) {
        logger.log(`[IFlowACP] [Message] type=${message.type}`)
      }

      const delta: any = {}

      switch (message.type) {
        case MessageType.ASSISTANT:
          // Handle assistant message (content or thought)
          const assistantMsg = message as any
          if (assistantMsg.chunk?.thought) {
            // This is reasoning content
            delta.reasoning_content = assistantMsg.chunk.thought
            if (enableLog) {
              logger.log(`[IFlowACP] [Reasoning] ${assistantMsg.chunk.thought.substring(0, 50)}...`)
            }
          } else if (assistantMsg.chunk?.text) {
            // This is regular content
            delta.content = assistantMsg.chunk.text
            if (enableLog) {
              logger.log(`[IFlowACP] [Content] ${assistantMsg.chunk.text.substring(0, 50)}...`)
            }
          }
          break

        case MessageType.TOOL_CALL:
          // Reenviar tool_calls a OpenCode — ahora glm-5 usa los nombres de tools de OpenCode
          // gracias al append_system_prompt inyectado en la sesión
          const toolMsg = message as any
          
          if (toolMsg.status === ToolCallStatus.PENDING ||
              toolMsg.status === ToolCallStatus.IN_PROGRESS) {
            // Nueva tool call iniciando
            const openAIToolCall = convertToolCallToOpenAI(toolMsg)
            delta.tool_calls = [openAIToolCall]
            currentToolCall = toolMsg
            
            if (enableLog) {
              logger.log(`[IFlowACP] [Tool Call] name=${toolMsg.toolName || toolMsg.label} status=${toolMsg.status}`)
            }
          } else if (toolMsg.status === ToolCallStatus.COMPLETED ||
                     toolMsg.status === ToolCallStatus.FAILED) {
            if (enableLog) {
              logger.log(`[IFlowACP] [Tool Result] name=${toolMsg.toolName} output=${toolMsg.output?.substring(0, 100) || ''}`)
            }
          }
          break

        case MessageType.TASK_FINISH:
          // Task is complete
          const finishMsg = message as any
          
          const finishChunk: StreamChunk = {
            id: chatId,
            object: 'chat.completion.chunk',
            created,
            model: request.model,
            choices: [{
              index: 0,
              delta: {},
              finish_reason: finishMsg.stopReason === 'max_tokens' ? 'length' : 'stop'
            }]
          }
          
          res.write(`data: ${JSON.stringify(finishChunk)}\n\n`)
          res.write('data: [DONE]\n\n')
          res.end()
          
          if (enableLog) {
            logger.log(`[IFlowACP] [Finish] reason=${finishMsg.stopReason}`)
          }
          return

        case MessageType.ERROR:
          const errorMsg = message as any
          logger.log(`[IFlowACP] [Error] ${errorMsg.message}`)
          break

        case MessageType.PLAN:
          const planMsg = message as any
          if (planMsg.entries && planMsg.entries.length > 0) {
            const planText = planMsg.entries.map((e: any) => 
              `- [${e.priority}] ${e.content} (${e.status})`
            ).join('\n')
            delta.reasoning_content = `Plan:\n${planText}`
          }
          break

        case MessageType.ASK_USER_QUESTIONS:
          const askMsg = message as any
          if (askMsg.questions && askMsg.questions.length > 0) {
            const answers: Record<string, string> = {}
            for (const q of askMsg.questions) {
              if (q.options && q.options.length > 0) {
                answers[q.header] = q.options[0].label
              }
            }
            await client.respondToAskUserQuestions(answers)
            if (enableLog) {
              logger.log(`[IFlowACP] [Auto-answered questions] ${JSON.stringify(answers)}`)
            }
          }
          continue

        case MessageType.EXIT_PLAN_MODE:
          await client.respondToExitPlanMode(true)
          if (enableLog) {
            logger.log(`[IFlowACP] [Auto-approved plan]`)
          }
          continue

        case MessageType.PERMISSION_REQUEST:
          const permMsg = message as any
          if (permMsg.options && permMsg.options.length > 0) {
            await client.respondToToolConfirmation(permMsg.requestId, permMsg.options[0].optionId)
            if (enableLog) {
              logger.log(`[IFlowACP] [Auto-approved permission] requestId=${permMsg.requestId}`)
            }
          }
          continue
      }

      // Only emit if delta has content
      if (delta.content || delta.reasoning_content || delta.tool_calls) {
        const chunk: StreamChunk = {
          id: chatId,
          object: 'chat.completion.chunk',
          created,
          model: request.model,
          choices: [{
            index: 0,
            delta,
            finish_reason: null
          }]
        }

        res.write(`data: ${JSON.stringify(chunk)}\n\n`)
      }
    }

  } catch (error: any) {
    logger.log('[IFlowACP] Error:', error.message)
    
    const errorChunk: StreamChunk = {
      id: chatId,
      object: 'chat.completion.chunk',
      created,
      model: request.model,
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

/**
 * Cleanup ACP clients on process exit
 */
export async function cleanupACPClients(): Promise<void> {
  for (const [model, entry] of acpClients) {
    try {
      await entry.client.disconnect()
      log(`Disconnected ACP client for model: ${model}`)
    } catch (err) {
      log(`Error disconnecting ACP client for ${model}:`, err)
    }
  }
  acpClients.clear()
}

// Register cleanup on process exit
process.on('SIGINT', cleanupACPClients)
process.on('SIGTERM', cleanupACPClients)



/**
 * Get or create an ACP client for a specific model
 */
async function getACPClient(model: string): Promise<IFlowClient> {
  let client = acpClients.get(model)
  
  if (client && client.isConnected()) {
    return client
  }
  
  log(`Creating new ACP client for model: ${model}`)
  
  client = new IFlowClient({
    permissionMode: PermissionMode.AUTO,
    autoStartProcess: true,
    logLevel: 'ERROR',
    sessionSettings: {
      permission_mode: 'yolo', // Auto-approve all operations
    }
  })
  
  await client.connect()
  
  // Set the model if specified
  try {
    await client.config.set('model', model)
    log(`Model set to: ${model}`)
  } catch (err) {
    log(`Warning: Could not set model: ${err}`)
  }
  
  acpClients.set(model, client)
  return client
}

/**
 * Handle streaming request using ACP protocol
 */
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
  
  // Build the prompt from messages
  const userMessages = request.messages.filter(m => m.role === 'user')
  const lastUserMessage = userMessages[userMessages.length - 1]
  const promptText = typeof lastUserMessage?.content === 'string' 
    ? lastUserMessage.content 
    : ''

  try {
    const client = await getACPClient(request.model)
    
    if (enableLog) {
      logger.log(`[IFlowACP] [Request] model=${request.model} prompt=${promptText.substring(0, 100)}...`)
    }

    // Send the message
    await client.sendMessage(promptText)

    // Process messages
    for await (const message of client.receiveMessages()) {
      if (enableLog) {
        logger.log(`[IFlowACP] [Message] type=${message.type}`)
      }

      const delta: any = {}

      switch (message.type) {
        case MessageType.ASSISTANT:
          // Handle assistant message (content or thought)
          const assistantMsg = message as any
          if (assistantMsg.chunk?.thought) {
            // This is reasoning content
            delta.reasoning_content = assistantMsg.chunk.thought
            if (enableLog) {
              logger.log(`[IFlowACP] [Reasoning] ${assistantMsg.chunk.thought.substring(0, 50)}...`)
            }
          } else if (assistantMsg.chunk?.text) {
            // This is regular content
            delta.content = assistantMsg.chunk.text
            if (enableLog) {
              logger.log(`[IFlowACP] [Content] ${assistantMsg.chunk.text.substring(0, 50)}...`)
            }
          }
          break

        case MessageType.TOOL_CALL:
          // iflow CLI usa sus propias tools internas (read_text_file, list_directory, etc.)
          // Estas NO deben reenviarse a OpenCode — iflow las maneja autónomamente.
          // Solo registrar en log si está habilitado.
          const toolMsg = message as any
          if (enableLog) {
            logger.log(`[IFlowACP] [Tool Call] name=${toolMsg.toolName || toolMsg.label} status=${toolMsg.status} output=${toolMsg.output?.substring(0, 100) || ''}`)
          }
          // No emitir delta — continuar al siguiente mensaje
          continue

        case MessageType.TASK_FINISH:
          // Task is complete
          const finishMsg = message as any
          
          const finishChunk: StreamChunk = {
            id: chatId,
            object: 'chat.completion.chunk',
            created,
            model: request.model,
            choices: [{
              index: 0,
              delta: {},
              finish_reason: finishMsg.stopReason === 'max_tokens' ? 'length' : 'stop'
            }]
          }
          
          res.write(`data: ${JSON.stringify(finishChunk)}\n\n`)
          res.write('data: [DONE]\n\n')
          res.end()
          
          if (enableLog) {
            logger.log(`[IFlowACP] [Finish] reason=${finishMsg.stopReason}`)
          }
          return

        case MessageType.ERROR:
          const errorMsg = message as any
          logger.log(`[IFlowACP] [Error] ${errorMsg.message}`)
          // Don't throw, just log and continue
          break

        case MessageType.PLAN:
          // Plan messages - we can emit as reasoning
          const planMsg = message as any
          if (planMsg.entries && planMsg.entries.length > 0) {
            const planText = planMsg.entries.map((e: any) => 
              `- [${e.priority}] ${e.content} (${e.status})`
            ).join('\n')
            delta.reasoning_content = `Plan:\n${planText}`
          }
          break

        case MessageType.ASK_USER_QUESTIONS:
          // Handle interactive questions - auto-answer with first option for proxy mode
          const askMsg = message as any
          if (askMsg.questions && askMsg.questions.length > 0) {
            // Auto-select first option for each question
            const answers: Record<string, string> = {}
            for (const q of askMsg.questions) {
              if (q.options && q.options.length > 0) {
                answers[q.header] = q.options[0].label
              }
            }
            await client.respondToAskUserQuestions(answers)
            if (enableLog) {
              logger.log(`[IFlowACP] [Auto-answered questions] ${JSON.stringify(answers)}`)
            }
          }
          continue // Don't emit this message

        case MessageType.EXIT_PLAN_MODE:
          // Auto-approve plans in proxy mode
          await client.respondToExitPlanMode(true)
          if (enableLog) {
            logger.log(`[IFlowACP] [Auto-approved plan]`)
          }
          continue

        case MessageType.PERMISSION_REQUEST:
          // Auto-approve permission requests
          const permMsg = message as any
          if (permMsg.options && permMsg.options.length > 0) {
            await client.respondToToolConfirmation(permMsg.requestId, permMsg.options[0].optionId)
            if (enableLog) {
              logger.log(`[IFlowACP] [Auto-approved permission] requestId=${permMsg.requestId}`)
            }
          }
          continue
      }

      // Only emit if delta has content
      if (delta.content || delta.reasoning_content || delta.tool_calls) {
        const chunk: StreamChunk = {
          id: chatId,
          object: 'chat.completion.chunk',
          created,
          model: request.model,
          choices: [{
            index: 0,
            delta,
            finish_reason: null
          }]
        }

        res.write(`data: ${JSON.stringify(chunk)}\n\n`)
      }
    }

  } catch (error: any) {
    logger.log('[IFlowACP] Error:', error.message)
    
    // Send error chunk
    const errorChunk: StreamChunk = {
      id: chatId,
      object: 'chat.completion.chunk',
      created,
      model: request.model,
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

/**
 * Cleanup ACP clients on process exit
 */
export async function cleanupACPClients(): Promise<void> {
  for (const [model, client] of acpClients) {
    try {
      await client.disconnect()
      log(`Disconnected ACP client for model: ${model}`)
    } catch (err) {
      log(`Error disconnecting ACP client for ${model}:`, err)
    }
  }
  acpClients.clear()
}

// Register cleanup on process exit
process.on('SIGINT', cleanupACPClients)
process.on('SIGTERM', cleanupACPClients)

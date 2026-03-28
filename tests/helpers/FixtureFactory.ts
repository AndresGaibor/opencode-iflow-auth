/**
 * FixtureFactory - Generates request fixtures for testing.
 */

import type { ChatCompletionRequest } from '../../src/iflow/proxy/types.js'

export interface MakeRequestOptions {
  model?: string
  messages?: any[]
  tools?: any[]
  stream?: boolean
  cwd?: string
  workspaceRoot?: string
}

const DEFAULT_MODEL = 'glm-5'

/**
 * Creates a basic chat completion request.
 */
export function makeRequest(options: MakeRequestOptions = {}): ChatCompletionRequest {
  return {
    model: options.model || DEFAULT_MODEL,
    messages: options.messages || [{ role: 'user', content: 'Hello' }],
    stream: options.stream ?? true,
    tools: options.tools,
    cwd: options.cwd,
    workspaceRoot: options.workspaceRoot,
  }
}

/**
 * Creates a request for repo review scenario.
 */
export function makeRepoReviewRequest(tools?: any[]): ChatCompletionRequest {
  return makeRequest({
    model: 'glm-5',
    messages: [
      { role: 'user', content: 'Revisa los archivos de este proyecto' },
    ],
    tools,
    cwd: '/project',
    workspaceRoot: '/project',
  })
}

/**
 * Creates a request for reading a file.
 */
export function makeReadmeRequest(tools?: any[]): ChatCompletionRequest {
  return makeRequest({
    model: 'glm-5',
    messages: [
      { role: 'user', content: 'Lee README.md' },
    ],
    tools,
    cwd: '/project',
    workspaceRoot: '/project',
  })
}

/**
 * Creates a request for searching code.
 */
export function makeGrepRequest(tools?: any[]): ChatCompletionRequest {
  return makeRequest({
    model: 'glm-5',
    messages: [
      { role: 'user', content: 'Busca donde se usa IFlowClient' },
    ],
    tools,
    cwd: '/project',
    workspaceRoot: '/project',
  })
}

/**
 * Creates a request for editing a file.
 */
export function makeEditRequest(tools?: any[]): ChatCompletionRequest {
  return makeRequest({
    model: 'glm-5',
    messages: [
      { role: 'user', content: 'Cambia foo por bar en src/index.ts' },
    ],
    tools,
    cwd: '/project',
    workspaceRoot: '/project',
  })
}

/**
 * Creates a request with a skill tool.
 */
export function makeSkillRequest(tools?: any[]): ChatCompletionRequest {
  return makeRequest({
    model: 'glm-5',
    messages: [
      { role: 'user', content: 'Usa la skill react-expert para crear un componente' },
    ],
    tools,
    cwd: '/project',
    workspaceRoot: '/project',
  })
}

/**
 * Creates a request with a todowrite tool.
 */
export function makeTodoWriteRequest(tools?: any[]): ChatCompletionRequest {
  return makeRequest({
    model: 'glm-5',
    messages: [
      { role: 'user', content: 'Crea un plan de tareas para refactorizar el código' },
    ],
    tools,
    cwd: '/project',
    workspaceRoot: '/project',
  })
}

/**
 * Creates a request with MCP tools.
 */
export function makeMcpRequest(tools?: any[]): ChatCompletionRequest {
  return makeRequest({
    model: 'glm-5',
    messages: [
      { role: 'user', content: 'Usa el servidor MCP para buscar' },
    ],
    tools,
    cwd: '/project',
    workspaceRoot: '/project',
  })
}

/**
 * Creates a request with a tool result message (for testing tool loops).
 */
export function makeToolResultRequest(
  previousRequest: ChatCompletionRequest,
  toolCallId: string,
  toolName: string,
  toolOutput: string
): ChatCompletionRequest {
  return {
    ...previousRequest,
    messages: [
      ...previousRequest.messages,
      {
        role: 'assistant' as const,
        content: null as any,
        tool_calls: [{
          id: toolCallId,
          type: 'function' as const,
          function: {
            name: toolName,
            arguments: '{}',
          },
        }],
      },
      {
        role: 'tool' as const,
        tool_call_id: toolCallId,
        name: toolName,
        content: toolOutput,
      },
    ] as any[],
  }
}

/**
 * Creates a request with a conversation history.
 */
export function makeConversationRequest(
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }>,
  options: MakeRequestOptions = {}
): ChatCompletionRequest {
  return makeRequest({
    ...options,
    messages,
  })
}

/**
 * Creates a request with system message.
 */
export function makeRequestWithSystem(
  systemPrompt: string,
  userMessage: string,
  options: MakeRequestOptions = {}
): ChatCompletionRequest {
  return makeRequest({
    ...options,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  })
}

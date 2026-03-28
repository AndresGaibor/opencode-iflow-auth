export interface ChatMessage {
  role: string
  content: string
}

export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  max_tokens?: number
  temperature?: number
  top_p?: number
  stream?: boolean
  [key: string]: any
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface StreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
      reasoning_content?: string
      thought?: string
      tool_calls?: Array<{
        index: number
        id?: string
        type?: 'function'
        function?: {
          name: string
          arguments: string
        }
      }>
    }
    finish_reason: string | null
  }>
}

export interface CLIStatus {
  installed: boolean
  loggedIn: boolean
  version?: string
  error?: string
  apiKey?: string
}

// Session management types
import type { IFlowClient } from '@iflow-ai/iflow-cli-sdk'

export interface SessionState {
  sessionKey: string
  model: string
  client: IFlowClient
  createdAt: number
  lastActivityAt: number
  initialized: boolean
  cwd?: string
  workspaceRoot?: string
  toolSchemaHash?: string
}

export interface ConversationContext {
  systemMessages: string[]
  userMessages: string[]
  assistantMessages: string[]
  toolMessages: Array<{
    name?: string
    content: string
    args?: Record<string, any>
  }>
  latestUserMessage: string
  latestToolResult?: {
    name: string
    content: string
    args?: Record<string, any>
  }
}

export interface NormalizedToolCall {
  name: string
  args: Record<string, any>
}

export interface ToolCallMessage {
  name: string
  args: Record<string, any>
}

export type ACPProcessingResult =
  | { type: 'tool_call'; toolCall: NormalizedToolCall; reasoning?: string }
  | { type: 'content'; content: string; reasoning?: string }
  | { type: 'done'; reasoning?: string }
  | { type: 'noop'; reasoning?: string }

/**
 * Unit tests for conversation context functions.
 */

import { describe, it, expect } from 'vitest'
import { 
  extractTextContent, 
  buildConversationContext,
  buildTurnPrompt,
  formatToolResultForIFlow
} from '../../src/iflow/proxy/handlers/acp-utils.js'
import type { ChatCompletionRequest, ConversationContext } from '../../src/iflow/proxy/types.js'

// ============================================================================
// EXTRACT TEXT CONTENT TESTS
// ============================================================================

describe('extractTextContent', () => {
  it('should extract string content directly', () => {
    const message = { content: 'Hello world' }
    expect(extractTextContent(message)).toBe('Hello world')
  })

  it('should return empty string for null message', () => {
    expect(extractTextContent(null)).toBe('')
  })

  it('should return empty string for undefined message', () => {
    expect(extractTextContent(undefined)).toBe('')
  })

  it('should return empty string for message without content', () => {
    expect(extractTextContent({})).toBe('')
  })

  it('should extract text from content array with text parts', () => {
    const message = {
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'World' },
      ]
    }
    expect(extractTextContent(message)).toBe('Hello\nWorld')
  })

  it('should handle mixed content array', () => {
    const message = {
      content: [
        { type: 'text', text: 'Text part' },
        { type: 'image', url: 'http://example.com/image.png' },
        'Plain string',
      ]
    }
    expect(extractTextContent(message)).toBe('Text part\nPlain string')
  })

  it('should filter out non-text parts', () => {
    const message = {
      content: [
        { type: 'image', url: 'http://example.com/image.png' },
        { type: 'text', text: 'Only text' },
      ]
    }
    expect(extractTextContent(message)).toBe('Only text')
  })

  it('should handle content array with strings', () => {
    const message = {
      content: ['First line', 'Second line']
    }
    expect(extractTextContent(message)).toBe('First line\nSecond line')
  })

  it('should handle empty text in content array', () => {
    const message = {
      content: [
        { type: 'text', text: '' },
        { type: 'text', text: 'Text' },
      ]
    }
    expect(extractTextContent(message)).toBe('Text')
  })
})

// ============================================================================
// BUILD CONVERSATION CONTEXT TESTS
// ============================================================================

describe('buildConversationContext', () => {
  const createRequest = (messages: any[]): ChatCompletionRequest => ({
    model: 'test',
    messages,
  })

  it('should extract system messages', () => {
    const request = createRequest([
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hi' },
    ])
    const ctx = buildConversationContext(request)
    expect(ctx.systemMessages).toEqual(['You are helpful'])
  })

  it('should extract user messages', () => {
    const request = createRequest([
      { role: 'user', content: 'Hello' },
      { role: 'user', content: 'World' },
    ])
    const ctx = buildConversationContext(request)
    expect(ctx.userMessages).toEqual(['Hello', 'World'])
    expect(ctx.latestUserMessage).toBe('World')
  })

  it('should extract assistant messages', () => {
    const request = createRequest([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
    ])
    const ctx = buildConversationContext(request)
    expect(ctx.assistantMessages).toEqual(['Hello!'])
  })

  it('should extract tool messages', () => {
    const request = createRequest([
      { role: 'tool', name: 'read', content: 'file contents' },
    ])
    const ctx = buildConversationContext(request)
    expect(ctx.toolMessages).toHaveLength(1)
    expect(ctx.toolMessages[0]?.name).toBe('read')
    expect(ctx.toolMessages[0]?.content).toBe('file contents')
  })

  it('should detect latestUserMessage', () => {
    const request = createRequest([
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Response' },
      { role: 'user', content: 'Second' },
    ])
    const ctx = buildConversationContext(request)
    expect(ctx.latestUserMessage).toBe('Second')
  })

  it('should detect latestToolResult', () => {
    const request = createRequest([
      { role: 'tool', name: 'read', content: 'first result' },
      { role: 'tool', name: 'write', content: 'second result' },
    ])
    const ctx = buildConversationContext(request)
    expect(ctx.latestToolResult).toBeDefined()
    expect(ctx.latestToolResult?.name).toBe('write')
    expect(ctx.latestToolResult?.content).toBe('second result')
  })

  it('should handle tool messages with arguments', () => {
    const request = createRequest([
      { role: 'tool', name: 'read', content: 'result', arguments: { path: 'test.ts' } },
    ])
    const ctx = buildConversationContext(request)
    expect(ctx.toolMessages[0]?.args).toEqual({ path: 'test.ts' })
  })

  it('should handle empty messages array', () => {
    const request = createRequest([])
    const ctx = buildConversationContext(request)
    expect(ctx.systemMessages).toEqual([])
    expect(ctx.userMessages).toEqual([])
    expect(ctx.assistantMessages).toEqual([])
    expect(ctx.toolMessages).toEqual([])
    expect(ctx.latestUserMessage).toBe('')
    expect(ctx.latestToolResult).toBeUndefined()
  })

  it('should handle missing messages field', () => {
    const request = { model: 'test' } as any
    const ctx = buildConversationContext(request)
    expect(ctx.systemMessages).toEqual([])
  })

  it('should handle content arrays in messages', () => {
    const request = createRequest([
      { 
        role: 'user', 
        content: [
          { type: 'text', text: 'Look at this' },
          { type: 'image', url: 'http://example.com/img.png' },
        ]
      },
    ])
    const ctx = buildConversationContext(request)
    expect(ctx.userMessages).toEqual(['Look at this'])
  })
})

// ============================================================================
// BUILD TURN PROMPT TESTS
// ============================================================================

describe('buildTurnPrompt', () => {
  const createConversation = (overrides: Partial<ConversationContext> = {}): ConversationContext => ({
    systemMessages: [],
    userMessages: ['Hello'],
    assistantMessages: [],
    toolMessages: [],
    latestUserMessage: 'Hello',
    ...overrides,
  })

  it('should return latestUserMessage for normal turn', () => {
    const conversation = createConversation()
    const request = { messages: [{ role: 'user', content: 'Hello' }] } as ChatCompletionRequest
    
    const prompt = buildTurnPrompt({ conversation, requestBody: request })
    expect(prompt).toBe('Hello')
  })

  it('should format tool result when last message is tool', () => {
    const conversation = createConversation({
      latestToolResult: { name: 'read', content: 'file contents' },
    })
    const request = {
      model: 'glm-5',
      messages: [{ role: 'tool', name: 'read', content: 'file contents' }]
    } as any as ChatCompletionRequest

    const prompt = buildTurnPrompt({ conversation, requestBody: request })
    expect(prompt).toContain('=== Tool Result from OpenCode ===')
    expect(prompt).toContain('Tool: read')
    expect(prompt).toContain('file contents')
  })

  it('should combine tool result with user message', () => {
    const conversation = createConversation({
      latestToolResult: { name: 'read', content: 'file contents' },
      latestUserMessage: 'What do you think?',
    })
    const request = {
      messages: [
        { role: 'tool', name: 'read', content: 'file contents' },
        { role: 'user', content: 'What do you think?' },
      ]
    } as ChatCompletionRequest

    const prompt = buildTurnPrompt({ conversation, requestBody: request })
    expect(prompt).toContain('=== Tool Result from OpenCode ===')
    expect(prompt).toContain('What do you think?')
  })

  it('should return "Continue." for empty conversation', () => {
    const conversation = createConversation({
      latestUserMessage: '',
    })
    const request = { messages: [] } as any as ChatCompletionRequest

    const prompt = buildTurnPrompt({ conversation, requestBody: request })
    expect(prompt).toBe('Continue.')
  })
})

// ============================================================================
// FORMAT TOOL RESULT FOR IFLOW TESTS
// ============================================================================

describe('formatToolResultForIFlow', () => {
  it('should format tool result correctly', () => {
    const result = formatToolResultForIFlow({
      toolName: 'read',
      args: { path: 'test.ts' },
      output: 'file contents here',
    })
    
    expect(result).toContain('=== Tool Result from OpenCode ===')
    expect(result).toContain('Tool: read')
    expect(result).toContain('path')
    expect(result).toContain('test.ts')
    expect(result).toContain('Status: success')
    expect(result).toContain('file contents here')
    expect(result).toContain('=== End Tool Result ===')
  })

  it('should handle error status', () => {
    const result = formatToolResultForIFlow({
      toolName: 'read',
      args: { path: 'missing.ts' },
      output: 'File not found',
      isError: true,
    })
    
    expect(result).toContain('Status: error')
  })

  it('should handle empty output', () => {
    const result = formatToolResultForIFlow({
      toolName: 'list',
      args: { path: '.' },
      output: '',
    })
    
    expect(result).toContain('(no output)')
  })

  it('should handle empty args', () => {
    const result = formatToolResultForIFlow({
      toolName: 'bash',
      args: {},
      output: 'command executed',
    })
    
    expect(result).toContain('Arguments: {}')
  })

  it('should handle complex args', () => {
    const result = formatToolResultForIFlow({
      toolName: 'edit',
      args: { 
        filePath: 'test.ts', 
        oldString: 'foo', 
        newString: 'bar' 
      },
      output: 'Changed 1 occurrence',
    })
    
    // JSON serialization may have no spaces after colons
    expect(result).toContain('filePath')
    expect(result).toContain('test.ts')
    expect(result).toContain('oldString')
    expect(result).toContain('foo')
    expect(result).toContain('newString')
    expect(result).toContain('bar')
  })
})

/**
 * Unit tests for parser functions (tool call extraction from text and ACP messages).
 */

import { describe, it, expect } from 'vitest'
import { 
  extractToolCallFromText,
  extractNativeACPToolCall,
  extractReasoning,
  extractACPText,
  isACPDoneMessage,
  processACPMessage,
  normalizeToolCall
} from '../../src/iflow/proxy/handlers/acp-utils.js'

// ============================================================================
// EXTRACT TOOL CALL FROM TEXT TESTS
// ============================================================================

describe('extractToolCallFromText', () => {
  it('should extract tool call from <<USA_TOOL>> format', () => {
    const text = 'Some text <<USA_TOOL>>read{"path": "README.md"}<</USA_TOOL>> more text'
    const result = extractToolCallFromText(text)
    
    expect(result).not.toBeNull()
    expect(result!.name).toBe('read')
    expect(result!.args.path).toBe('README.md')
  })

  it('should handle tool call without closing tag', () => {
    const text = '<<USA_TOOL>>bash{"command": "ls"}'
    const result = extractToolCallFromText(text)
    
    expect(result).not.toBeNull()
    expect(result!.name).toBe('bash')
  })

  it('should return null for text without tool markers', () => {
    const text = 'This is just regular text'
    const result = extractToolCallFromText(text)
    
    expect(result).toBeNull()
  })

  it('should handle malformed JSON gracefully', () => {
    const text = '<<USA_TOOL>>read{invalid json}<</USA_TOOL>>'
    const result = extractToolCallFromText(text)
    
    expect(result).toBeNull()
  })

  it('should handle tool call without args', () => {
    const text = '<<USA_TOOL>>list<</USA_TOOL>>'
    const result = extractToolCallFromText(text)
    
    expect(result).not.toBeNull()
    expect(result!.name).toBe('list')
    expect(result!.args).toEqual({})
  })

  it('should handle tool call with spaces', () => {
    const text = '<<USA_TOOL>>  read  {"path": "test.ts"}  <</USA_TOOL>>'
    const result = extractToolCallFromText(text)
    
    expect(result).not.toBeNull()
    expect(result!.name).toBe('read')
  })

  it('should handle tool name with dots', () => {
    const text = '<<USA_TOOL>>mcp.server.tool{"arg": "value"}<</USA_TOOL>>'
    const result = extractToolCallFromText(text)
    
    expect(result).not.toBeNull()
    expect(result!.name).toBe('mcp.server.tool')
  })

  it('should return null for null/undefined input', () => {
    expect(extractToolCallFromText(null as any)).toBeNull()
    expect(extractToolCallFromText(undefined as any)).toBeNull()
  })

  it('should return null for empty string', () => {
    expect(extractToolCallFromText('')).toBeNull()
  })

  it('should handle multiline JSON args', () => {
    const text = `<<USA_TOOL>>edit{
  "filePath": "test.ts",
  "oldString": "foo",
  "newString": "bar"
}<</USA_TOOL>>`
    const result = extractToolCallFromText(text)
    
    expect(result).not.toBeNull()
    expect(result!.name).toBe('edit')
    expect(result!.args.filePath).toBe('test.ts')
  })
})

// ============================================================================
// EXTRACT NATIVE ACP TOOL CALL TESTS
// ============================================================================

describe('extractNativeACPToolCall', () => {
  it('should extract from type: tool_call with payload', () => {
    const msg = {
      type: 'tool_call',
      payload: {
        toolName: 'read_text_file',
        arguments: { path: 'test.ts' }
      }
    }
    const result = extractNativeACPToolCall(msg)
    
    expect(result).not.toBeNull()
    expect(result!.name).toBe('read_text_file')
    expect(result!.args).toEqual({ path: 'test.ts' })
  })

  it('should extract from messageType: TOOL_CALL', () => {
    const msg = {
      messageType: 'TOOL_CALL',
      toolCall: {
        name: 'list_directory',
        arguments: { directory: '.' }
      }
    }
    const result = extractNativeACPToolCall(msg)
    
    expect(result).not.toBeNull()
    expect(result!.name).toBe('list_directory')
  })

  it('should extract from direct toolName field', () => {
    const msg = {
      toolName: 'edit_file',
      args: { filePath: 'test.ts' }
    }
    const result = extractNativeACPToolCall(msg)
    
    expect(result).not.toBeNull()
    expect(result!.name).toBe('edit_file')
  })

  it('should extract from toolName with arguments field', () => {
    const msg = {
      toolName: 'bash',
      arguments: { command: 'ls -la' }
    }
    const result = extractNativeACPToolCall(msg)
    
    expect(result).not.toBeNull()
    expect(result!.name).toBe('bash')
    expect(result!.args).toEqual({ command: 'ls -la' })
  })

  it('should return null for message without tool call', () => {
    const msg = {
      type: 'content',
      content: 'Hello world'
    }
    const result = extractNativeACPToolCall(msg)
    
    expect(result).toBeNull()
  })

  it('should return null for null input', () => {
    expect(extractNativeACPToolCall(null)).toBeNull()
  })

  it('should return null for undefined input', () => {
    expect(extractNativeACPToolCall(undefined)).toBeNull()
  })

  it('should handle empty arguments', () => {
    const msg = {
      toolName: 'list',
      arguments: {}
    }
    const result = extractNativeACPToolCall(msg)
    
    expect(result).not.toBeNull()
    expect(result!.args).toEqual({})
  })
})

// ============================================================================
// EXTRACT REASONING TESTS
// ============================================================================

describe('extractReasoning', () => {
  it('should extract from chunk.thought', () => {
    const msg = {
      chunk: { thought: 'Thinking about this...' }
    }
    expect(extractReasoning(msg)).toBe('Thinking about this...')
  })

  it('should extract from reasoning field', () => {
    const msg = {
      reasoning: 'My reasoning here'
    }
    expect(extractReasoning(msg)).toBe('My reasoning here')
  })

  it('should return empty string for message without reasoning', () => {
    const msg = { content: 'Hello' }
    expect(extractReasoning(msg)).toBe('')
  })

  it('should return empty string for null input', () => {
    expect(extractReasoning(null)).toBe('')
  })
})

// ============================================================================
// EXTRACT ACP TEXT TESTS
// ============================================================================

describe('extractACPText', () => {
  it('should extract from chunk.text', () => {
    const msg = {
      chunk: { text: 'Response text' }
    }
    expect(extractACPText(msg)).toBe('Response text')
  })

  it('should extract from content field', () => {
    const msg = {
      content: 'Direct content'
    }
    expect(extractACPText(msg)).toBe('Direct content')
  })

  it('should extract string message directly', () => {
    expect(extractACPText('Plain string message')).toBe('Plain string message')
  })

  it('should return empty string for message without text', () => {
    const msg = { type: 'tool_call' }
    expect(extractACPText(msg)).toBe('')
  })

  it('should return empty string for null input', () => {
    expect(extractACPText(null)).toBe('')
  })
})

// ============================================================================
// IS ACP DONE MESSAGE TESTS
// ============================================================================

describe('isACPDoneMessage', () => {
  it('should detect TASK_FINISH type', () => {
    const msg = { type: 'TASK_FINISH' }
    expect(isACPDoneMessage(msg)).toBe(true)
  })

  it('should detect messageType TASK_FINISH', () => {
    const msg = { messageType: 'TASK_FINISH' }
    expect(isACPDoneMessage(msg)).toBe(true)
  })

  it('should detect stopReason field', () => {
    const msg = { stopReason: 'complete' }
    expect(isACPDoneMessage(msg)).toBe(true)
  })

  it('should return false for non-done message', () => {
    const msg = { type: 'content', content: 'Hello' }
    expect(isACPDoneMessage(msg)).toBe(false)
  })

  it('should return false for null input', () => {
    expect(isACPDoneMessage(null)).toBe(false)
  })
})

// ============================================================================
// PROCESS ACP MESSAGE TESTS
// ============================================================================

describe('processACPMessage', () => {
  it('should process native tool call with priority', () => {
    const msg = {
      toolName: 'read_text_file',
      args: { path: 'test.ts' }
    }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_call')
    expect(result.toolCall!.name).toBe('read') // Normalized
    expect(result.toolCall!.args.path).toBe('test.ts')
  })

  it('should process fallback textual tool call', () => {
    const msg = {
      chunk: { text: '<<USA_TOOL>>list{"path": "."}<</USA_TOOL>>' }
    }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_call')
    expect(result.toolCall!.name).toBe('list')
  })

  it('should process content message', () => {
    const msg = {
      chunk: { text: 'This is a response' }
    }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('content')
    expect(result.content).toBe('This is a response')
  })

  it('should process done message', () => {
    const msg = { type: 'TASK_FINISH' }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('done')
  })

  it('should return noop for null message', () => {
    const result = processACPMessage(null)
    expect(result.type).toBe('noop')
  })

  it('should extract reasoning from tool call message', () => {
    const msg = {
      toolName: 'read',
      args: { path: 'test.ts' },
      chunk: { thought: 'Need to read the file' }
    }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_call')
    expect(result.reasoning).toBe('Need to read the file')
  })

  it('should extract reasoning from content message', () => {
    const msg = {
      chunk: { 
        text: 'Response',
        thought: 'Thinking...'
      }
    }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('content')
    expect(result.reasoning).toBe('Thinking...')
  })

  it('should prioritize native tool call over textual fallback', () => {
    // If a message has both native tool call AND text with <<USA_TOOL>>,
    // native should win
    const msg = {
      toolName: 'read_text_file',
      args: { path: 'real.ts' },
      chunk: { text: '<<USA_TOOL>>write{"path": "fake.ts"}<</USA_TOOL>>' }
    }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_call')
    expect(result.toolCall!.name).toBe('read') // Native, not write
    expect(result.toolCall!.args.path).toBe('real.ts')
  })

  it('should normalize tool calls', () => {
    const msg = {
      toolName: 'list_directory',
      args: { directory: '.' }
    }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_call')
    expect(result.toolCall!.name).toBe('list') // Normalized from list_directory
    expect(result.toolCall!.args.path).toBe('.') // directory -> path
  })

  it('should return noop for unrecognized message', () => {
    const msg = { unknownField: 'value' }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('noop')
  })
})

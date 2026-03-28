/**
 * Integration tests for ACP streaming behavior.
 * Tests the separation of reasoning, content, and tool_calls in SSE chunks.
 */

import { describe, it, expect } from 'vitest'
import { processACPMessage } from '../../src/iflow/proxy/handlers/acp-utils.js'

// ============================================================================
// STREAMING SEQUENCE TESTS
// ============================================================================

describe('Streaming: Message Processing', () => {
  describe('Reasoning chunks', () => {
    it('should extract reasoning from chunk.thought', () => {
      const msg = {
        chunk: { thought: 'Analyzing the request...' }
      }
      
      const result = processACPMessage(msg)
      
      expect(result.reasoning).toBe('Analyzing the request...')
    })

    it('should extract reasoning from reasoning field', () => {
      const msg = {
        reasoning: 'Planning my approach'
      }
      
      const result = processACPMessage(msg)
      
      expect(result.reasoning).toBe('Planning my approach')
    })

    it('should return empty string for no reasoning', () => {
      const msg = {
        chunk: { text: 'Hello world' }
      }
      
      const result = processACPMessage(msg)
      
      expect(result.reasoning).toBe('')
    })
  })

  describe('Content chunks', () => {
    it('should extract content from chunk.text', () => {
      const msg = {
        chunk: { text: 'This is the response' }
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('content')
      if (result.type === 'content') {
        expect(result.content).toBe('This is the response')
      }
    })

    it('should extract content from content field', () => {
      const msg = {
        content: 'Direct content here'
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('content')
      if (result.type === 'content') {
        expect(result.content).toBe('Direct content here')
      }
    })

    it('should extract content from string message', () => {
      const result = processACPMessage('Plain string message')
      
      expect(result.type).toBe('content')
      if (result.type === 'content') {
        expect(result.content).toBe('Plain string message')
      }
    })
  })

  describe('Tool call chunks', () => {
    it('should emit tool_call type for native tool calls', () => {
      const msg = {
        toolName: 'read',
        args: { path: 'test.ts' }
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('tool_call')
      if (result.type === 'tool_call') {
        expect(result.toolCall).toBeDefined()
        expect(result.toolCall.name).toBe('read')
      }
    })

    it('should emit tool_call type for text fallback', () => {
      const msg = {
        chunk: { text: '<<USA_TOOL>>read{"path": "test.ts"}<</USA_TOOL>>' }
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('tool_call')
      if (result.type === 'tool_call') {
        expect(result.toolCall.name).toBe('read')
      }
    })

    it('should not emit content when tool call is present', () => {
      const msg = {
        toolName: 'list',
        args: { path: '.' }
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('tool_call')
    })
  })

  describe('Done chunks', () => {
    it('should detect TASK_FINISH type', () => {
      const msg = { type: 'TASK_FINISH' }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('done')
    })

    it('should detect messageType TASK_FINISH', () => {
      const msg = { messageType: 'TASK_FINISH' }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('done')
    })

    it('should detect stopReason field', () => {
      const msg = { stopReason: 'complete' }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('done')
    })
  })
})

// ============================================================================
// STREAMING ORDER TESTS
// ============================================================================

describe('Streaming: Order', () => {
  it('should process reasoning before tool call', () => {
    const msg = {
      toolName: 'read',
      args: { path: 'test.ts' },
      chunk: { thought: 'Need to read file' }
    }
    
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_call')
    expect(result.reasoning).toBe('Need to read file')
  })

  it('should process reasoning with content', () => {
    const msg = {
      chunk: { 
        text: 'Response text',
        thought: 'My reasoning'
      }
    }
    
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('content')
    if (result.type === 'content') {
      expect(result.content).toBe('Response text')
    }
    expect(result.reasoning).toBe('My reasoning')
  })

  it('should process reasoning with done', () => {
    const msg = {
      type: 'TASK_FINISH',
      reasoning: 'Final thoughts'
    }
    
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('done')
    expect(result.reasoning).toBe('Final thoughts')
  })
})

// ============================================================================
// STREAMING PRIORITY TESTS
// ============================================================================

describe('Streaming: Priority', () => {
  it('should prioritize native tool call over content', () => {
    const msg = {
      toolName: 'read',
      args: { path: 'test.ts' },
      content: 'Some content here'
    }
    
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_call')
    if (result.type === 'tool_call') {
      expect(result.toolCall.name).toBe('read')
    }
  })

  it('should prioritize native tool call over text fallback', () => {
    const msg = {
      toolName: 'list',
      args: { path: '.' },
      chunk: { text: '<<USA_TOOL>>read{"path": "other.ts"}<</USA_TOOL>>' }
    }
    
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_call')
    if (result.type === 'tool_call') {
      expect(result.toolCall.name).toBe('list')
    }
  })

  it('should prioritize text fallback over content', () => {
    const msg = {
      chunk: { text: 'Some text <<USA_TOOL>>read{"path": "test.ts"}<</USA_TOOL>> more text' }
    }
    
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_call')
    if (result.type === 'tool_call') {
      expect(result.toolCall.name).toBe('read')
    }
  })

  it('should emit content when no tool call present', () => {
    const msg = {
      chunk: { text: 'Just regular content without tool markers' }
    }
    
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('content')
    if (result.type === 'content') {
      expect(result.content).toBe('Just regular content without tool markers')
    }
  })
})

// ============================================================================
// STREAMING FINISH REASON TESTS
// ============================================================================

describe('Streaming: Finish Reasons', () => {
  it('should not have finish_reason until done', () => {
    const contentMsg = {
      chunk: { text: 'Content' }
    }
    
    const result = processACPMessage(contentMsg)
    
    expect(result.type).toBe('content')
    expect(result.type).not.toBe('done')
  })

  it('should indicate done when TASK_FINISH received', () => {
    const msg = { type: 'TASK_FINISH' }
    
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('done')
  })

  it('should indicate tool_calls when tool call received', () => {
    const msg = {
      toolName: 'read',
      args: { path: 'test.ts' }
    }
    
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_call')
  })
})

// ============================================================================
// STREAMING ERROR HANDLING TESTS
// ============================================================================

describe('Streaming: Error Handling', () => {
  it('should handle null message', () => {
    const result = processACPMessage(null)
    
    expect(result.type).toBe('noop')
  })

  it('should handle undefined message', () => {
    const result = processACPMessage(undefined)
    
    expect(result.type).toBe('noop')
  })

  it('should handle empty object', () => {
    const result = processACPMessage({})
    
    expect(result.type).toBe('noop')
  })

  it('should handle malformed tool marker', () => {
    const msg = {
      chunk: { text: '<<USA_TOOL>>read{invalid json}<</USA_TOOL>>' }
    }
    
    const result = processACPMessage(msg)
    
    // Should fall back to content since JSON is invalid
    expect(result.type).toBe('content')
  })
})
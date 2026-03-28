/**
 * Contract tests for OpenCode agent behavior.
 * Validates that the plugin preserves expected agent-like behavior.
 */

import { describe, it, expect } from 'vitest'
import { normalizeToolCall, processACPMessage } from '../../src/iflow/proxy/handlers/acp-utils.js'

// ============================================================================
// REPO EXPLORATION BEHAVIOR
// ============================================================================

describe('Behavior: Repo exploration', () => {
  it('should map list_directory to list (not bash)', () => {
    // When iFlow emits list_directory, it should become 'list' tool
    const result = normalizeToolCall('list_directory', { directory: '.' })
    
    expect(result.name).toBe('list')
    expect(result.name).not.toBe('bash')
  })

  it('should map read_text_file to read', () => {
    const result = normalizeToolCall('read_text_file', { path: 'README.md' })
    
    expect(result.name).toBe('read')
  })

  it('should preserve tool sequence in message processing', () => {
    // Simulate a list tool call message
    const listMsg = {
      toolName: 'list_directory',
      args: { directory: '.' }
    }
    
    const result = processACPMessage(listMsg)
    
    expect(result.type).toBe('tool_call')
    if (result.type === 'tool_call') {
      expect(result.toolCall.name).toBe('list')
    }
  })

  it('should handle exploration flow: list -> read', () => {
    // First: list
    const listResult = normalizeToolCall('list_directory', { directory: 'src' })
    expect(listResult.name).toBe('list')
    
    // Then: read
    const readResult = normalizeToolCall('read_text_file', { path: 'src/index.ts' })
    expect(readResult.name).toBe('read')
  })
})

// ============================================================================
// FILE READING BEHAVIOR
// ============================================================================

describe('Behavior: File reading', () => {
  it('should use read tool, not bash cat', () => {
    const result = normalizeToolCall('read', { path: 'README.md' })
    
    expect(result.name).toBe('read')
    expect(result.name).not.toBe('bash')
  })

  it('should map cat alias to read', () => {
    const result = normalizeToolCall('cat', { file: 'config.json' })
    
    expect(result.name).toBe('read')
  })
})

// ============================================================================
// CODE SEARCH BEHAVIOR
// ============================================================================

describe('Behavior: Code search', () => {
  it('should map search_files to grep', () => {
    const result = normalizeToolCall('search_files', { 
      pattern: 'IFlowClient',
      path: '.'
    })
    
    expect(result.name).toBe('grep')
  })

  it('should preserve search pattern', () => {
    const result = normalizeToolCall('grep', { pattern: 'function' })
    
    expect(result.args.pattern).toBe('function')
  })
})

// ============================================================================
// CODE EDITING BEHAVIOR
// ============================================================================

describe('Behavior: Code editing', () => {
  it('should use edit tool for replacements', () => {
    const result = normalizeToolCall('edit', { 
      filePath: 'test.ts', 
      oldString: 'foo', 
      newString: 'bar' 
    })
    
    expect(result.name).toBe('edit')
  })

  it('should NOT convert edit to write', () => {
    const result = normalizeToolCall('edit_file', { 
      path: 'test.ts', 
      oldString: 'a', 
      newString: 'b' 
    })
    
    expect(result.name).toBe('edit')
    expect(result.name).not.toBe('write')
  })

  it('should preserve edit schema (oldString, newString)', () => {
    const result = normalizeToolCall('edit', { 
      filePath: 'test.ts', 
      oldString: 'old code', 
      newString: 'new code' 
    })
    
    expect(result.args.oldString).toBe('old code')
    expect(result.args.newString).toBe('new code')
  })
})

// ============================================================================
// TOOL PRIORITY BEHAVIOR
// ============================================================================

describe('Behavior: Tool priority', () => {
  it('should prioritize native ACP tool calls over text fallback', () => {
    const msg = {
      toolName: 'read',
      args: { path: 'real.ts' },
      chunk: { text: '<<USA_TOOL>>write{"path": "fake.ts"}<</USA_TOOL>>' }
    }
    
    const result = processACPMessage(msg)
    
    // Native tool call should win
    expect(result.type).toBe('tool_call')
    if (result.type === 'tool_call') {
      expect(result.toolCall.name).toBe('read')
      expect(result.toolCall.args.path).toBe('real.ts')
    }
  })

  it('should extract tool from text when no native tool call', () => {
    const msg = {
      chunk: { text: '<<USA_TOOL>>read{"path": "test.ts"}<</USA_TOOL>>' }
    }
    
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_call')
    if (result.type === 'tool_call') {
      expect(result.toolCall.name).toBe('read')
    }
  })
})

// ============================================================================
// ADVANCED TOOLS BEHAVIOR
// ============================================================================

describe('Behavior: Advanced tools preservation', () => {
  it('should preserve skill tool unchanged', () => {
    const result = normalizeToolCall('skill', { 
      skill: 'react-expert', 
      args: { component: 'Button' } 
    })
    
    expect(result.name).toBe('skill')
    expect(result.args.skill).toBe('react-expert')
  })

  it('should preserve todowrite tool', () => {
    const result = normalizeToolCall('todowrite', { 
      todos: [{ id: '1', task: 'Test', status: 'pending' }] 
    })
    
    expect(result.name).toBe('todowrite')
  })

  it('should preserve task tool for subagents', () => {
    const result = normalizeToolCall('task', { 
      description: 'Search', 
      prompt: 'Find files',
      subagent_type: 'explore-agent'
    })
    
    expect(result.name).toBe('task')
    expect(result.args.subagent_type).toBe('explore-agent')
  })

  it('should preserve MCP tool names', () => {
    const result = normalizeToolCall('mcp__brave_search', { query: 'test' })
    
    expect(result.name).toBe('mcp__brave_search')
  })
})

// ============================================================================
// ERROR HANDLING BEHAVIOR
// ============================================================================

describe('Behavior: Error handling', () => {
  it('should handle null message gracefully', () => {
    const result = processACPMessage(null)
    expect(result.type).toBe('noop')
  })

  it('should handle undefined message gracefully', () => {
    const result = processACPMessage(undefined)
    expect(result.type).toBe('noop')
  })

  it('should handle malformed tool call gracefully', () => {
    const msg = {
      chunk: { text: '<<USA_TOOL>>read{invalid json}<</USA_TOOL>>' }
    }
    
    const result = processACPMessage(msg)
    
    // Should fall back to content since JSON is invalid
    expect(result.type).toBe('content')
  })
})

// ============================================================================
// REASONING BEHAVIOR
// ============================================================================

describe('Behavior: Reasoning extraction', () => {
  it('should extract reasoning from chunk.thought', () => {
    const msg = {
      toolName: 'read',
      args: { path: 'test.ts' },
      chunk: { thought: 'I need to read this file' }
    }
    
    const result = processACPMessage(msg)
    
    expect(result.reasoning).toBe('I need to read this file')
  })

  it('should extract reasoning from reasoning field', () => {
    const msg = {
      toolName: 'read',
      args: { path: 'test.ts' },
      reasoning: 'Analyzing the code'
    }
    
    const result = processACPMessage(msg)
    
    expect(result.reasoning).toBe('Analyzing the code')
  })

  it('should include reasoning in content messages', () => {
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
})

// ============================================================================
// STREAMING BEHAVIOR
// ============================================================================

describe('Behavior: Streaming', () => {
  it('should identify done messages correctly', () => {
    const doneMsgs = [
      { type: 'TASK_FINISH' },
      { messageType: 'TASK_FINISH' },
      { stopReason: 'complete' },
    ]
    
    for (const msg of doneMsgs) {
      const result = processACPMessage(msg)
      expect(result.type).toBe('done')
    }
  })

  it('should handle done with reasoning', () => {
    const msg = {
      type: 'TASK_FINISH',
      reasoning: 'Task completed successfully'
    }
    
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('done')
    expect(result.reasoning).toBe('Task completed successfully')
  })
})
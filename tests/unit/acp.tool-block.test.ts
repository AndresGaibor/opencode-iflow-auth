/**
 * Unit tests for shouldBlockTool and processACPMessage tool blocking functionality.
 * Tests the strict OpenCode mode that blocks iFlow internal tools.
 */

import { describe, it, expect } from 'vitest'
import { 
  shouldBlockTool, 
  getStrictModeBlockedTools,
  processACPMessage 
} from '../../src/iflow/proxy/handlers/acp-utils.js'

// ============================================================================
// SHOULD BLOCK TOOL TESTS
// ============================================================================

describe('shouldBlockTool', () => {
  describe('strict mode (default)', () => {
    it('should block task tool (subagents)', () => {
      const result = shouldBlockTool('task')
      expect(result.blocked).toBe(true)
      expect(result.reason).toContain('task_blocked')
    })

    it('should block read_multiple_files', () => {
      const result = shouldBlockTool('read_multiple_files')
      expect(result.blocked).toBe(true)
      expect(result.reason).toContain('read_multiple_files_blocked')
    })

    it('should block python', () => {
      const result = shouldBlockTool('python')
      expect(result.blocked).toBe(true)
    })

    it('should block sh', () => {
      const result = shouldBlockTool('sh')
      expect(result.blocked).toBe(true)
    })

    it('should block computer_use', () => {
      const result = shouldBlockTool('computer_use')
      expect(result.blocked).toBe(true)
    })

    it('should block create_directory', () => {
      const result = shouldBlockTool('create_directory')
      expect(result.blocked).toBe(true)
    })

    it('should block move_file', () => {
      const result = shouldBlockTool('move_file')
      expect(result.blocked).toBe(true)
    })

    it('should block delete_file', () => {
      const result = shouldBlockTool('delete_file')
      expect(result.blocked).toBe(true)
    })

    it('should block iFlow file tools that should be mapped', () => {
      // These are blocked because they should be mapped to OpenCode equivalents
      // The mapping happens before blocking check in processACPMessage
      expect(shouldBlockTool('read_text_file').blocked).toBe(true)
      expect(shouldBlockTool('read_file').blocked).toBe(true)
      expect(shouldBlockTool('list_directory').blocked).toBe(true)
      expect(shouldBlockTool('list_directory_with_sizes').blocked).toBe(true)
      expect(shouldBlockTool('directory_tree').blocked).toBe(true)
    })

    it('should block with case insensitivity', () => {
      expect(shouldBlockTool('TASK').blocked).toBe(true)
      expect(shouldBlockTool('Task').blocked).toBe(true)
      expect(shouldBlockTool('PYTHON').blocked).toBe(true)
    })

    it('should NOT block OpenCode-native tools', () => {
      expect(shouldBlockTool('read').blocked).toBe(false)
      expect(shouldBlockTool('write').blocked).toBe(false)
      expect(shouldBlockTool('edit').blocked).toBe(false)
      expect(shouldBlockTool('list').blocked).toBe(false)
      expect(shouldBlockTool('glob').blocked).toBe(false)
      expect(shouldBlockTool('grep').blocked).toBe(false)
      expect(shouldBlockTool('bash').blocked).toBe(false)
      expect(shouldBlockTool('todowrite').blocked).toBe(false)
      expect(shouldBlockTool('webfetch').blocked).toBe(false)
      expect(shouldBlockTool('websearch').blocked).toBe(false)
      expect(shouldBlockTool('skill').blocked).toBe(false)
    })

    it('should NOT block MCP namespaced tools', () => {
      expect(shouldBlockTool('mcp__brave_search').blocked).toBe(false)
      expect(shouldBlockTool('mcp__lsp_goto_definition').blocked).toBe(false)
    })
  })

  describe('non-strict mode', () => {
    it('should NOT block any tool when strictMode is false', () => {
      expect(shouldBlockTool('task', { strictMode: false }).blocked).toBe(false)
      expect(shouldBlockTool('python', { strictMode: false }).blocked).toBe(false)
      expect(shouldBlockTool('read_multiple_files', { strictMode: false }).blocked).toBe(false)
    })
  })

  describe('explicit strictMode true', () => {
    it('should block tools when strictMode is explicitly true', () => {
      const result = shouldBlockTool('task', { strictMode: true })
      expect(result.blocked).toBe(true)
    })
  })
})

// ============================================================================
// GET STRICT MODE BLOCKED TOOLS TESTS
// ============================================================================

describe('getStrictModeBlockedTools', () => {
  it('should return list of blocked tools', () => {
    const blocked = getStrictModeBlockedTools()
    expect(blocked).toContain('task')
    expect(blocked).toContain('read_multiple_files')
    expect(blocked).toContain('python')
    expect(blocked).toContain('sh')
    expect(blocked).toContain('computer_use')
  })

  it('should return a copy (not reference)', () => {
    const blocked1 = getStrictModeBlockedTools()
    const blocked2 = getStrictModeBlockedTools()
    expect(blocked1).not.toBe(blocked2) // Different references
    expect(blocked1).toEqual(blocked2) // Same content
  })
})

// ============================================================================
// PROCESS ACP MESSAGE WITH BLOCKING TESTS
// ============================================================================

describe('processACPMessage with tool blocking', () => {
  describe('strict mode (default)', () => {
    it('should block task tool call from native ACP message', () => {
      const msg = {
        toolName: 'task',
        args: {
          description: 'Explore codebase',
          prompt: 'Find all TypeScript files',
          subagent_type: 'explore-agent'
        }
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('tool_blocked')
      if (result.type === 'tool_blocked') {
        expect(result.originalName).toBe('task')
        expect(result.reason).toContain('task_blocked')
      }
    })

    it('should block read_multiple_files tool call', () => {
      const msg = {
        toolName: 'read_multiple_files',
        args: {
          paths: ['file1.ts', 'file2.ts']
        }
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('tool_blocked')
      if (result.type === 'tool_blocked') {
        expect(result.originalName).toBe('read_multiple_files')
      }
    })

    it('should block python tool call', () => {
      const msg = {
        toolName: 'python',
        args: {
          script: 'print("hello")'
        }
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('tool_blocked')
    })

    it('should NOT block and normalize read tool call (OpenCode native)', () => {
      const msg = {
        toolName: 'read',
        args: {
          filePath: 'src/index.ts'
        }
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('tool_call')
      if (result.type === 'tool_call') {
        expect(result.toolCall.name).toBe('read')
        expect(result.toolCall.args.filePath).toBe('src/index.ts')
      }
    })

    it('should NOT block and normalize list tool call', () => {
      const msg = {
        toolName: 'list',
        args: {
          path: '/project'
        }
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('tool_call')
      if (result.type === 'tool_call') {
        expect(result.toolCall.name).toBe('list')
      }
    })

    it('should NOT block MCP tools', () => {
      const msg = {
        toolName: 'mcp__lsp_goto_definition',
        args: {
          file: 'src/index.ts',
          line: 10,
          character: 5
        }
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('tool_call')
      if (result.type === 'tool_call') {
        expect(result.toolCall.name).toBe('mcp__lsp_goto_definition')
      }
    })
  })

  describe('non-strict mode', () => {
    it('should NOT block task when strictMode is false', () => {
      const msg = {
        toolName: 'task',
        args: {
          description: 'Explore codebase',
          prompt: 'Find files'
        }
      }
      
      const result = processACPMessage(msg, { strictMode: false })
      
      // In non-strict mode, task should be normalized, not blocked
      expect(result.type).toBe('tool_call')
      if (result.type === 'tool_call') {
        expect(result.toolCall.name).toBe('task')
      }
    })

    it('should NOT block python when strictMode is false', () => {
      const msg = {
        toolName: 'python',
        args: {
          script: 'print("hello")'
        }
      }
      
      const result = processACPMessage(msg, { strictMode: false })
      
      expect(result.type).toBe('tool_call')
      if (result.type === 'tool_call') {
        // python is not in the normalizeToolCall mapping, so it passes through
        expect(result.toolCall.name).toBe('python')
      }
    })
  })

  describe('textual fallback tool calls', () => {
    it('should block task from textual fallback', () => {
      const msg = {
        chunk: {
          text: '<<USA_TOOL>> task {"description": "Test", "prompt": "Do something"}'
        }
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('tool_blocked')
    })

    it('should NOT block read from textual fallback', () => {
      const msg = {
        chunk: {
          text: '<<USA_TOOL>> read {"filePath": "test.ts"}'
        }
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('tool_call')
      if (result.type === 'tool_call') {
        expect(result.toolCall.name).toBe('read')
      }
    })
  })

  describe('content messages', () => {
    it('should pass through content messages unchanged', () => {
      const msg = {
        chunk: {
          text: 'This is just regular content, not a tool call.'
        }
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('content')
      if (result.type === 'content') {
        expect(result.content).toBe('This is just regular content, not a tool call.')
      }
    })
  })

  describe('done messages', () => {
    it('should handle done messages', () => {
      const msg = {
        type: 'TASK_FINISH'
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('done')
    })
  })

  describe('noop messages', () => {
    it('should handle null messages', () => {
      const result = processACPMessage(null)
      expect(result.type).toBe('noop')
    })

    it('should handle undefined messages', () => {
      const result = processACPMessage(undefined)
      expect(result.type).toBe('noop')
    })

    it('should handle empty objects', () => {
      const result = processACPMessage({})
      expect(result.type).toBe('noop')
    })
  })
})

// ============================================================================
// INTEGRATION: Blocking + Normalization
// ============================================================================

describe('tool blocking integration', () => {
  it('should demonstrate that task is blocked, not mapped', () => {
    // task should be BLOCKED, not passed through or mapped
    const msg = {
      toolName: 'task',
      args: {
        description: 'Explore',
        prompt: 'Find files',
        subagent_type: 'explore-agent'
      }
    }
    
    const result = processACPMessage(msg)
    
    // CRITICAL: task must be blocked to prevent invisible work
    expect(result.type).toBe('tool_blocked')
    if (result.type === 'tool_blocked') {
      expect(result.originalName).toBe('task')
      // The original args should be preserved for logging
      expect(result.originalArgs).toBeDefined()
    }
  })

  it('should demonstrate that read_multiple_files is blocked (no equivalent)', () => {
    // read_multiple_files has no direct OpenCode equivalent
    const msg = {
      toolName: 'read_multiple_files',
      args: {
        paths: ['file1.ts', 'file2.ts', 'file3.ts']
      }
    }
    
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_blocked')
  })

  it('should demonstrate that native OpenCode tools pass through', () => {
    const tools = ['read', 'write', 'edit', 'list', 'glob', 'grep', 'bash', 'todowrite', 'skill']
    
    for (const tool of tools) {
      const msg = {
        toolName: tool,
        args: {}
      }
      
      const result = processACPMessage(msg)
      
      expect(result.type).toBe('tool_call')
      if (result.type === 'tool_call') {
        expect(result.toolCall.name).toBe(tool)
      }
    }
  })
})

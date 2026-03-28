/**
 * Contract tests for OpenCode tool schemas.
 * Ensures that tool calls emitted by the plugin match expected OpenCode schemas.
 */

import { describe, it, expect } from 'vitest'
import { normalizeToolCall } from '../../src/iflow/proxy/handlers/acp-utils.js'

// ============================================================================
// READ TOOL CONTRACT
// ============================================================================

describe('Contract: read tool', () => {
  it('should have "filePath" field, not "path"', () => {
    const result = normalizeToolCall('read_text_file', { path: 'test.ts' })
    expect(result.args.filePath).toBeDefined()
    expect(result.args.path).toBeUndefined()
  })

  it('should have optional offset and limit fields', () => {
    const result = normalizeToolCall('read', { 
      filePath: 'test.ts', 
      offset: 100, 
      limit: 50 
    })
    expect(result.args.filePath).toBe('test.ts')
    expect(result.args.offset).toBe(100)
    expect(result.args.limit).toBe(50)
  })

  it('should work with minimal args (only filePath)', () => {
    const result = normalizeToolCall('read', { filePath: 'README.md' })
    expect(result.args.filePath).toBe('README.md')
    expect(result.args.offset).toBeUndefined()
    expect(result.args.limit).toBeUndefined()
  })
})

// ============================================================================
// WRITE TOOL CONTRACT
// ============================================================================

describe('Contract: write tool', () => {
  it('should have "filePath" field, not "path"', () => {
    const result = normalizeToolCall('write', { path: 'test.ts', content: 'hello' })
    expect(result.args.filePath).toBeDefined()
    expect(result.args.path).toBeUndefined()
  })

  it('should have "content" field', () => {
    const result = normalizeToolCall('write', { filePath: 'test.ts', content: 'hello' })
    expect(result.args.content).toBe('hello')
  })

  it('should work with minimal args', () => {
    const result = normalizeToolCall('write', { filePath: 'new.txt' })
    expect(result.args.filePath).toBe('new.txt')
    expect(result.args.content).toBe('')
  })
})

// ============================================================================
// EDIT TOOL CONTRACT
// ============================================================================

describe('Contract: edit tool', () => {
  it('should have "filePath" field', () => {
    const result = normalizeToolCall('edit', { 
      path: 'test.ts', 
      oldString: 'a', 
      newString: 'b' 
    })
    expect(result.args.filePath).toBeDefined()
  })

  it('should have "oldString" and "newString" fields', () => {
    const result = normalizeToolCall('edit', { 
      filePath: 'test.ts', 
      oldString: 'foo', 
      newString: 'bar' 
    })
    expect(result.args.oldString).toBe('foo')
    expect(result.args.newString).toBe('bar')
  })

  it('should NOT have "text" or "explanation" fields', () => {
    const result = normalizeToolCall('edit', { 
      filePath: 'test.ts', 
      oldString: 'a', 
      newString: 'b',
      text: 'should be removed',
      explanation: 'should be removed'
    })
    expect(result.args.text).toBeUndefined()
    expect(result.args.explanation).toBeUndefined()
  })

  it('should have optional "replaceAll" field', () => {
    const result = normalizeToolCall('edit', { 
      filePath: 'test.ts', 
      oldString: 'a', 
      newString: 'b',
      replaceAll: true
    })
    expect(result.args.replaceAll).toBe(true)
  })
})

// ============================================================================
// LIST TOOL CONTRACT
// ============================================================================

describe('Contract: list tool', () => {
  it('should have "path" field', () => {
    const result = normalizeToolCall('list_directory', { directory: '/project' })
    expect(result.args.path).toBe('/project')
  })

  it('should NOT be converted to bash ls', () => {
    const result = normalizeToolCall('list_directory', { directory: '.' })
    expect(result.name).toBe('list')
    expect(result.name).not.toBe('bash')
  })

  it('should default to "." if no path provided', () => {
    const result = normalizeToolCall('list', {})
    expect(result.args.path).toBe('.')
  })
})

// ============================================================================
// GLOB TOOL CONTRACT
// ============================================================================

describe('Contract: glob tool', () => {
  it('should have "pattern" field', () => {
    const result = normalizeToolCall('find_files', { pattern: '**/*.ts' })
    expect(result.args.pattern).toBe('**/*.ts')
  })

  it('should have optional "path" field', () => {
    const result = normalizeToolCall('glob', { pattern: '*.ts', path: 'src' })
    expect(result.args.pattern).toBe('*.ts')
    expect(result.args.path).toBe('src')
  })
})

// ============================================================================
// GREP TOOL CONTRACT
// ============================================================================

describe('Contract: grep tool', () => {
  it('should have "pattern" field', () => {
    const result = normalizeToolCall('search_files', { query: 'IFlowClient' })
    expect(result.args.pattern).toBe('IFlowClient')
  })

  it('should have optional "path" field', () => {
    const result = normalizeToolCall('grep', { pattern: 'test', path: 'src' })
    expect(result.args.pattern).toBe('test')
    expect(result.args.path).toBe('src')
  })

  it('should have optional "include" field', () => {
    const result = normalizeToolCall('grep', { 
      pattern: 'test', 
      include: '*.ts' 
    })
    expect(result.args.include).toBe('*.ts')
  })
})

// ============================================================================
// BASH TOOL CONTRACT
// ============================================================================

describe('Contract: bash tool', () => {
  it('should have "command" field', () => {
    const result = normalizeToolCall('run_shell_command', { command: 'npm test' })
    expect(result.args.command).toBe('npm test')
  })

  it('should have optional "timeout" field', () => {
    const result = normalizeToolCall('bash', { command: 'sleep 10', timeout: 60 })
    expect(result.args.timeout).toBe(60)
  })

  it('should map "script" to "command"', () => {
    const result = normalizeToolCall('bash', { script: 'npm run build' })
    expect(result.args.command).toBe('npm run build')
  })
})

// ============================================================================
// SKILL TOOL CONTRACT
// ============================================================================

describe('Contract: skill tool', () => {
  it('should have "skill" field', () => {
    const result = normalizeToolCall('skill', { skill: 'react-expert' })
    expect(result.args.skill).toBe('react-expert')
  })

  it('should have optional "args" field', () => {
    const result = normalizeToolCall('skill', { 
      skill: 'react-expert', 
      args: { component: 'Button' } 
    })
    expect(result.args.args).toEqual({ component: 'Button' })
  })

  it('should NOT be remapped or transformed', () => {
    const original = { skill: 'typescript-pro', args: { strict: true } }
    const result = normalizeToolCall('skill', original)
    expect(result.name).toBe('skill')
    expect(result.args.skill).toBe('typescript-pro')
  })
})

// ============================================================================
// TODOWRITE TOOL CONTRACT
// ============================================================================

describe('Contract: todowrite tool', () => {
  it('should have "todos" array field', () => {
    const result = normalizeToolCall('todowrite', { 
      todos: [{ id: '1', task: 'Test', status: 'pending' }] 
    })
    expect(Array.isArray(result.args.todos)).toBe(true)
    expect(result.args.todos).toHaveLength(1)
  })

  it('should default to empty array', () => {
    const result = normalizeToolCall('todowrite', {})
    expect(result.args.todos).toEqual([])
  })

  it('should NOT be remapped', () => {
    const result = normalizeToolCall('todo_write', { todos: [] })
    expect(result.name).toBe('todowrite')
  })
})

// ============================================================================
// TASK TOOL CONTRACT (subagents)
// ============================================================================

describe('Contract: task tool', () => {
  it('should have "description" and "prompt" fields', () => {
    const result = normalizeToolCall('task', { 
      description: 'Search', 
      prompt: 'Find files' 
    })
    expect(result.args.description).toBe('Search')
    expect(result.args.prompt).toBe('Find files')
  })

  it('should have "subagent_type" field with default', () => {
    const result = normalizeToolCall('task', { 
      description: 'Test', 
      prompt: 'Run tests' 
    })
    expect(result.args.subagent_type).toBe('general-purpose')
  })

  it('should have optional "useContext" field', () => {
    const result = normalizeToolCall('task', { 
      description: 'Test', 
      prompt: 'Run tests',
      useContext: true
    })
    expect(result.args.useContext).toBe(true)
  })

  it('should have optional "constraints" field', () => {
    const result = normalizeToolCall('task', { 
      description: 'Test', 
      prompt: 'Run tests',
      constraints: 'timeout: 60s'
    })
    expect(result.args.constraints).toBe('timeout: 60s')
  })
})

// ============================================================================
// MCP TOOLS CONTRACT
// ============================================================================

describe('Contract: MCP tools', () => {
  it('should preserve mcp__ prefix', () => {
    const result = normalizeToolCall('mcp__brave_search', { query: 'test' })
    expect(result.name).toBe('mcp__brave_search')
  })

  it('should preserve all arguments unchanged', () => {
    const args = { 
      uri: 'file://test.ts', 
      position: { line: 10, character: 5 } 
    }
    const result = normalizeToolCall('mcp__lsp_goto_definition', args)
    expect(result.args).toEqual(args)
  })

  it('should handle namespaced MCP tools', () => {
    const result = normalizeToolCall('mcp__server__tool', { arg: 'value' })
    expect(result.name).toBe('mcp__server__tool')
  })
})

// ============================================================================
// UNKNOWN TOOLS CONTRACT
// ============================================================================

describe('Contract: unknown tools', () => {
  it('should pass through unknown tools unchanged', () => {
    const result = normalizeToolCall('custom_unknown_tool', { custom: 'arg' })
    expect(result.name).toBe('custom_unknown_tool')
    expect(result.args).toEqual({ custom: 'arg' })
  })

  it('should preserve complex arguments for unknown tools', () => {
    const args = { 
      nested: { deep: { value: 123 } },
      array: [1, 2, 3]
    }
    const result = normalizeToolCall('unknown', args)
    expect(result.args).toEqual(args)
  })
})

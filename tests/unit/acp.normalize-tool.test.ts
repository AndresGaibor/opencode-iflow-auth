/**
 * Unit tests for normalizeToolCall function.
 * This is the critical function for ensuring tool compatibility between iFlow and OpenCode.
 */

import { describe, it, expect } from 'vitest'
import { normalizeToolCall } from '../../src/iflow/proxy/handlers/acp-utils.js'

// ============================================================================
// READ TOOL TESTS
// ============================================================================

describe('normalizeToolCall - read tool', () => {
  it('should normalize read_text_file to read', () => {
    const result = normalizeToolCall('read_text_file', { path: 'src/index.ts' })
    expect(result.name).toBe('read')
    expect(result.args.path).toBe('src/index.ts')
  })

  it('should normalize read_file to read', () => {
    const result = normalizeToolCall('read_file', { filePath: 'src/file.ts' })
    expect(result.name).toBe('read')
    expect(result.args.path).toBe('src/file.ts')
  })

  it('should normalize cat to read', () => {
    const result = normalizeToolCall('cat', { file: 'README.md' })
    expect(result.name).toBe('read')
    expect(result.args.path).toBe('README.md')
  })

  it('should normalize getFile to read', () => {
    const result = normalizeToolCall('getFile', { filename: 'config.json' })
    expect(result.name).toBe('read')
    expect(result.args.path).toBe('config.json')
  })

  it('should preserve offset and limit', () => {
    const result = normalizeToolCall('read', { 
      path: 'large-file.ts',
      offset: 100,
      limit: 50
    })
    expect(result.name).toBe('read')
    expect(result.args.offset).toBe(100)
    expect(result.args.limit).toBe(50)
  })

  it('should map filePath to path for read tool', () => {
    const result = normalizeToolCall('read', { filePath: 'src/file.ts' })
    expect(result.args.path).toBe('src/file.ts')
    expect(result.args.filePath).toBeUndefined()
  })

  it('should use "path" not "filePath" in output', () => {
    const result = normalizeToolCall('read_text_file', { filePath: 'test.ts' })
    expect(result.args.path).toBeDefined()
    expect(result.args.filePath).toBeUndefined()
  })
})

// ============================================================================
// WRITE TOOL TESTS
// ============================================================================

describe('normalizeToolCall - write tool', () => {
  it('should normalize write_to_file to write', () => {
    const result = normalizeToolCall('write_to_file', { path: 'output.txt', content: 'hello' })
    expect(result.name).toBe('write')
    expect(result.args.filePath).toBe('output.txt')
    expect(result.args.content).toBe('hello')
  })

  it('should normalize write_file to write', () => {
    const result = normalizeToolCall('write_file', { filePath: 'test.ts', content: 'code' })
    expect(result.name).toBe('write')
    expect(result.args.filePath).toBe('test.ts')
  })

  it('should normalize save_file to write', () => {
    const result = normalizeToolCall('save_file', { path: 'data.json', text: '{"key": "value"}' })
    expect(result.name).toBe('write')
    expect(result.args.filePath).toBe('data.json')
    expect(result.args.content).toBe('{"key": "value"}')
  })

  it('should normalize createFile to write', () => {
    const result = normalizeToolCall('createFile', { file: 'new.txt', content: 'new content' })
    expect(result.name).toBe('write')
    expect(result.args.filePath).toBe('new.txt')
  })

  it('should use "filePath" in output, not "path"', () => {
    const result = normalizeToolCall('write', { path: 'test.ts', content: 'hello' })
    expect(result.args.filePath).toBeDefined()
    expect(result.args.path).toBeUndefined()
  })

  it('should map "text" to "content"', () => {
    const result = normalizeToolCall('write', { filePath: 'file.txt', text: 'some text' })
    expect(result.args.content).toBe('some text')
  })
})

// ============================================================================
// EDIT TOOL TESTS
// ============================================================================

describe('normalizeToolCall - edit tool', () => {
  it('should normalize edit_file to edit', () => {
    const result = normalizeToolCall('edit_file', { 
      filePath: 'src/index.ts',
      oldString: 'foo',
      newString: 'bar'
    })
    expect(result.name).toBe('edit')
    expect(result.args.filePath).toBe('src/index.ts')
    expect(result.args.oldString).toBe('foo')
    expect(result.args.newString).toBe('bar')
  })

  it('should normalize replace_in_file to edit', () => {
    const result = normalizeToolCall('replace_in_file', { 
      path: 'config.ts',
      old_text: 'old',
      new_text: 'new'
    })
    expect(result.name).toBe('edit')
    expect(result.args.oldString).toBe('old')
    expect(result.args.newString).toBe('new')
  })

  it('should normalize modify_file to edit', () => {
    const result = normalizeToolCall('modify_file', { 
      file: 'source.ts',
      search: 'find',
      replace: 'replace'
    })
    expect(result.name).toBe('edit')
    expect(result.args.oldString).toBe('find')
    expect(result.args.newString).toBe('replace')
  })

  it('should normalize patch_file to edit', () => {
    const result = normalizeToolCall('patch_file', { 
      filePath: 'file.ts',
      oldString: 'a',
      newString: 'b'
    })
    expect(result.name).toBe('edit')
  })

  it('should preserve replaceAll flag', () => {
    const result = normalizeToolCall('edit', {
      filePath: 'src/index.ts',
      oldString: 'foo',
      newString: 'bar',
      replaceAll: true
    })
    expect(result.args.replaceAll).toBe(true)
  })

  it('should NOT use "text" field in output', () => {
    const result = normalizeToolCall('edit_file', {
      path: 'src/index.ts',
      old_text: 'foo',
      new_text: 'bar',
      text: 'should be ignored',
      explanation: 'should be ignored'
    })
    expect(result.name).toBe('edit')
    expect(result.args.oldString).toBe('foo')
    expect(result.args.newString).toBe('bar')
    expect(result.args.text).toBeUndefined()
    expect(result.args.explanation).toBeUndefined()
  })

  it('should use correct schema: filePath, oldString, newString', () => {
    const result = normalizeToolCall('edit', {
      filePath: 'src/index.ts',
      oldString: 'foo',
      newString: 'bar'
    })
    expect(result.name).toBe('edit')
    expect(result.args.filePath).toBe('src/index.ts')
    expect(result.args.oldString).toBe('foo')
    expect(result.args.newString).toBe('bar')
    // Should NOT have these fields
    expect(result.args.text).toBeUndefined()
    expect(result.args.explanation).toBeUndefined()
  })

  it('should use "filePath" not "path" in output', () => {
    const result = normalizeToolCall('edit', { 
      path: 'test.ts', 
      oldString: 'a', 
      newString: 'b' 
    })
    expect(result.args.filePath).toBeDefined()
  })
})

// ============================================================================
// LIST TOOL TESTS
// ============================================================================

describe('normalizeToolCall - list tool', () => {
  it('should normalize list_directory to list (NOT bash)', () => {
    const result = normalizeToolCall('list_directory', { directory: '/project' })
    expect(result.name).toBe('list')
    expect(result.args.path).toBe('/project')
    // CRITICAL: should NOT be 'bash'
    expect(result.name).not.toBe('bash')
  })

  it('should normalize list_directory_with_sizes to list', () => {
    const result = normalizeToolCall('list_directory_with_sizes', { directory: '.' })
    expect(result.name).toBe('list')
  })

  it('should normalize ls to list', () => {
    const result = normalizeToolCall('ls', { path: '/project' })
    expect(result.name).toBe('list')
  })

  it('should normalize list_dir to list', () => {
    const result = normalizeToolCall('list_dir', { directory: 'src' })
    expect(result.name).toBe('list')
  })

  it('should normalize directory_tree to list', () => {
    const result = normalizeToolCall('directory_tree', { path: '.' })
    expect(result.name).toBe('list')
  })

  it('should use "path" not "filePath" in output', () => {
    const result = normalizeToolCall('list', { filePath: '/project' })
    expect(result.args.path).toBeDefined()
  })

  it('should map directory to path', () => {
    const result = normalizeToolCall('list_directory', { directory: '/home/user' })
    expect(result.args.path).toBe('/home/user')
  })
})

// ============================================================================
// GLOB TOOL TESTS
// ============================================================================

describe('normalizeToolCall - glob tool', () => {
  it('should normalize find_files to glob', () => {
    const result = normalizeToolCall('find_files', { pattern: '**/*.ts' })
    expect(result.name).toBe('glob')
    expect(result.args.pattern).toBe('**/*.ts')
  })

  it('should normalize glob_search to glob', () => {
    const result = normalizeToolCall('glob_search', { glob: '*.json' })
    expect(result.name).toBe('glob')
    expect(result.args.pattern).toBe('*.json')
  })

  it('should normalize file_glob to glob', () => {
    const result = normalizeToolCall('file_glob', { pattern: 'src/**/*.ts' })
    expect(result.name).toBe('glob')
  })

  it('should use "pattern" for the glob pattern', () => {
    const result = normalizeToolCall('glob', { glob: '**/*.ts' })
    expect(result.args.pattern).toBeDefined()
  })

  it('should preserve optional path', () => {
    const result = normalizeToolCall('glob', { pattern: '*.ts', path: 'src' })
    expect(result.args.path).toBe('src')
  })
})

// ============================================================================
// GREP TOOL TESTS
// ============================================================================

describe('normalizeToolCall - grep tool', () => {
  it('should normalize search_files to grep', () => {
    const result = normalizeToolCall('search_files', { 
      pattern: 'IFlowClient',
      path: '/project'
    })
    expect(result.name).toBe('grep')
    expect(result.args.pattern).toBe('IFlowClient')
    expect(result.args.path).toBe('/project')
  })

  it('should normalize file_search to grep', () => {
    const result = normalizeToolCall('file_search', { query: 'function' })
    expect(result.name).toBe('grep')
    expect(result.args.pattern).toBe('function')
  })

  it('should normalize find_in_files to grep', () => {
    const result = normalizeToolCall('find_in_files', { search: 'className' })
    expect(result.name).toBe('grep')
    expect(result.args.pattern).toBe('className')
  })

  it('should use "pattern" for the search pattern', () => {
    const result = normalizeToolCall('grep', { query: 'IFlowClient' })
    expect(result.args.pattern).toBeDefined()
  })

  it('should preserve optional include filter', () => {
    const result = normalizeToolCall('grep', { 
      pattern: 'test',
      include: '*.ts'
    })
    expect(result.args.include).toBe('*.ts')
  })

  it('should preserve optional context_lines', () => {
    const result = normalizeToolCall('grep', { 
      pattern: 'test',
      context_lines: 3
    })
    expect(result.args.context_lines).toBe(3)
  })
})

// ============================================================================
// BASH TOOL TESTS
// ============================================================================

describe('normalizeToolCall - bash tool', () => {
  it('should normalize run_shell_command to bash', () => {
    const result = normalizeToolCall('run_shell_command', { command: 'ls -la' })
    expect(result.name).toBe('bash')
    expect(result.args.command).toBe('ls -la')
  })

  it('should normalize execute_command to bash', () => {
    const result = normalizeToolCall('execute_command', { command: 'npm test' })
    expect(result.name).toBe('bash')
  })

  it('should normalize run_command to bash', () => {
    const result = normalizeToolCall('run_command', { script: 'yarn build' })
    expect(result.name).toBe('bash')
    expect(result.args.command).toBe('yarn build')
  })

  it('should normalize shell to bash', () => {
    const result = normalizeToolCall('shell', { command: 'echo hello' })
    expect(result.name).toBe('bash')
  })

  it('should normalize terminal to bash', () => {
    const result = normalizeToolCall('terminal', { command: 'pwd' })
    expect(result.name).toBe('bash')
  })

  it('should normalize bash_execute to bash', () => {
    const result = normalizeToolCall('bash_execute', { command: 'git status' })
    expect(result.name).toBe('bash')
  })

  it('should map script to command for bash', () => {
    const result = normalizeToolCall('bash', { script: 'npm test' })
    expect(result.name).toBe('bash')
    expect(result.args.command).toBe('npm test')
  })

  it('should preserve optional timeout', () => {
    const result = normalizeToolCall('bash', { 
      command: 'long-running',
      timeout: 60
    })
    expect(result.args.timeout).toBe(60)
  })
})

// ============================================================================
// SKILL TOOL TESTS
// ============================================================================

describe('normalizeToolCall - skill tool', () => {
  it('should preserve skill tool unchanged', () => {
    const result = normalizeToolCall('skill', { 
      skill: 'react-expert',
      args: { component: 'Button' }
    })
    expect(result.name).toBe('skill')
    expect(result.args.skill).toBe('react-expert')
    expect(result.args.args).toEqual({ component: 'Button' })
  })

  it('should map name to skill if skill not provided', () => {
    const result = normalizeToolCall('skill', { name: 'typescript-pro' })
    expect(result.args.skill).toBe('typescript-pro')
  })
})

// ============================================================================
// TODOWRITE TOOL TESTS
// ============================================================================

describe('normalizeToolCall - todowrite tool', () => {
  it('should preserve todowrite tool unchanged', () => {
    const result = normalizeToolCall('todowrite', {
      todos: [
        { id: '1', task: 'Read config', status: 'completed' },
        { id: '2', task: 'Write tests', status: 'pending' }
      ]
    })
    expect(result.name).toBe('todowrite')
    expect(result.args.todos).toHaveLength(2)
  })

  it('should normalize todo_write to todowrite', () => {
    const result = normalizeToolCall('todo_write', {
      todos: [{ id: '1', task: 'Test', status: 'pending' }]
    })
    expect(result.name).toBe('todowrite')
  })

  it('should default to empty array if no todos', () => {
    const result = normalizeToolCall('todowrite', {})
    expect(result.args.todos).toEqual([])
  })
})

// ============================================================================
// TODO_READ TOOL TESTS
// ============================================================================

describe('normalizeToolCall - todo_read tool', () => {
  it('should pass through with no args', () => {
    const result = normalizeToolCall('todo_read', {})
    expect(result.name).toBe('todo_read')
    expect(Object.keys(result.args)).toHaveLength(0)
  })
})

// ============================================================================
// TASK TOOL TESTS (subagents)
// ============================================================================

describe('normalizeToolCall - task tool', () => {
  it('should normalize task with all fields', () => {
    const result = normalizeToolCall('task', {
      description: 'Search for files',
      prompt: 'Find all TypeScript files in src/',
      subagent_type: 'explore-agent',
      useContext: true
    })
    expect(result.name).toBe('task')
    expect(result.args.description).toBe('Search for files')
    expect(result.args.prompt).toBe('Find all TypeScript files in src/')
    expect(result.args.subagent_type).toBe('explore-agent')
    expect(result.args.useContext).toBe(true)
  })

  it('should map task to prompt if prompt not provided', () => {
    const result = normalizeToolCall('task', {
      description: 'Test task',
      task: 'Run unit tests'
    })
    expect(result.args.prompt).toBe('Run unit tests')
  })

  it('should map type to subagent_type if subagent_type not provided', () => {
    const result = normalizeToolCall('task', {
      description: 'Generic task',
      prompt: 'Do something',
      type: 'search-specialist'
    })
    expect(result.args.subagent_type).toBe('search-specialist')
  })

  it('should default subagent_type to general-purpose', () => {
    const result = normalizeToolCall('task', {
      description: 'Generic task',
      prompt: 'Do something'
    })
    expect(result.args.subagent_type).toBe('general-purpose')
  })

  it('should preserve constraints', () => {
    const result = normalizeToolCall('task', {
      description: 'Task',
      prompt: 'Do something',
      constraints: 'timeout: 60s'
    })
    expect(result.args.constraints).toBe('timeout: 60s')
  })
})

// ============================================================================
// WEBFETCH TOOL TESTS
// ============================================================================

describe('normalizeToolCall - webfetch tool', () => {
  it('should normalize search_web to webfetch', () => {
    const result = normalizeToolCall('search_web', { url: 'https://example.com' })
    expect(result.name).toBe('webfetch')
  })

  it('should normalize fetch_url to webfetch', () => {
    const result = normalizeToolCall('fetch_url', { url: 'https://api.example.com' })
    expect(result.name).toBe('webfetch')
  })

  it('should normalize curl to webfetch', () => {
    const result = normalizeToolCall('curl', { url: 'https://example.com' })
    expect(result.name).toBe('webfetch')
  })

  it('should preserve webfetch unchanged', () => {
    const result = normalizeToolCall('webfetch', { 
      url: 'https://example.com',
      prompt: 'Extract the title'
    })
    expect(result.name).toBe('webfetch')
    expect(result.args.url).toBe('https://example.com')
    expect(result.args.prompt).toBe('Extract the title')
  })
})

// ============================================================================
// MCP TOOLS PASSTHROUGH TESTS
// ============================================================================

describe('normalizeToolCall - MCP tools passthrough', () => {
  it('should pass through MCP tools unchanged (mcp__ prefix)', () => {
    const mcpArgs = {
      uri: 'file:///path/to/file.ts',
      position: { line: 10, character: 5 },
      options: { includeDeclaration: true }
    }
    const result = normalizeToolCall('mcp__lsp_goto_definition', mcpArgs)
    expect(result.name).toBe('mcp__lsp_goto_definition')
    expect(result.args).toEqual(mcpArgs)
  })

  it('should handle MCP tools with complex arguments', () => {
    const complexArgs = {
      uri: 'file:///path/to/file.ts',
      position: { line: 10, character: 5 },
      options: { includeDeclaration: true }
    }
    const result = normalizeToolCall('mcp__lsp_find_references', complexArgs)
    expect(result.args).toEqual(complexArgs)
  })

  it('should pass through unknown tools unchanged', () => {
    const customArgs = { custom: 'value', nested: { deep: true } }
    const result = normalizeToolCall('custom_tool', customArgs)
    expect(result.name).toBe('custom_tool')
    expect(result.args).toEqual(customArgs)
  })

  it('should preserve MCP tool names with server prefix', () => {
    const result = normalizeToolCall('mcp__brave_search', { query: 'test' })
    expect(result.name).toBe('mcp__brave_search')
  })

  it('should preserve MCP tool names with multiple underscores', () => {
    const result = normalizeToolCall('mcp__some_server__some_tool', { arg: 'value' })
    expect(result.name).toBe('mcp__some_server__some_tool')
  })
})

// ============================================================================
// EDGE CASES
// ============================================================================

describe('normalizeToolCall - edge cases', () => {
  it('should handle empty tool name', () => {
    const result = normalizeToolCall('', { path: 'test' })
    expect(result.name).toBe('')
  })

  it('should handle null args', () => {
    const result = normalizeToolCall('read', null)
    expect(result.name).toBe('read')
    expect(result.args.path).toBe('')
  })

  it('should handle undefined args', () => {
    const result = normalizeToolCall('read', undefined)
    expect(result.name).toBe('read')
    expect(result.args.path).toBe('')
  })

  it('should handle tool name with whitespace', () => {
    const result = normalizeToolCall('  read_text_file  ', { path: 'test.ts' })
    expect(result.name).toBe('read')
  })

  it('should handle partial args', () => {
    const result = normalizeToolCall('edit', { filePath: 'test.ts' })
    expect(result.args.filePath).toBe('test.ts')
    expect(result.args.oldString).toBe('')
    expect(result.args.newString).toBe('')
  })

  it('should handle args with extra fields', () => {
    const result = normalizeToolCall('read', { 
      path: 'test.ts',
      extraField: 'should be preserved for unknown tools'
    })
    // For read tool, only specific fields are extracted
    expect(result.args.path).toBe('test.ts')
  })
})

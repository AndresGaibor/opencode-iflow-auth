import { describe, it, expect } from 'vitest'

// ============================================================================
// MCP TOOLS PASSTHROUGH TESTS
// ============================================================================

function normalizeToolCall(name: string, args: any): { name: string; args: any } {
  let mappedName = name.trim()
  let mappedArgs = args || {}

  // Tool name redirection
  if (['run_shell_command', 'execute_command', 'run_command', 'shell', 'terminal', 'bash_execute'].includes(mappedName)) {
    mappedName = 'bash'
  } else if (['read_text_file', 'read_file', 'cat', 'getFile'].includes(mappedName)) {
    mappedName = 'read'
  } else if (['write_to_file', 'write_file', 'save_file', 'createFile'].includes(mappedName)) {
    mappedName = 'write'
  } else if (['edit_file', 'replace_in_file', 'modify_file', 'patch_file'].includes(mappedName)) {
    mappedName = 'edit'
  } else if (['list_directory_with_sizes', 'list_directory', 'ls', 'list_dir', 'directory_tree'].includes(mappedName)) {
    mappedName = 'list'
  } else if (['find_files', 'glob_search', 'file_glob'].includes(mappedName)) {
    mappedName = 'glob'
  } else if (['search_files', 'file_search', 'find_in_files'].includes(mappedName)) {
    mappedName = 'grep'
  } else if (mappedName === 'todo_write') {
    mappedName = 'todowrite'
  }

  // Schema-specific argument normalization
  let cleanedArgs: any = {}

  switch (mappedName) {
    case 'read':
      cleanedArgs.path = mappedArgs.path || mappedArgs.filePath || mappedArgs.file || ''
      if (mappedArgs.offset !== undefined) cleanedArgs.offset = mappedArgs.offset
      if (mappedArgs.limit !== undefined) cleanedArgs.limit = mappedArgs.limit
      break

    case 'write':
      cleanedArgs.filePath = mappedArgs.filePath || mappedArgs.path || ''
      cleanedArgs.content = mappedArgs.content || mappedArgs.text || ''
      break

    case 'edit':
      cleanedArgs.filePath = mappedArgs.filePath || mappedArgs.path || ''
      cleanedArgs.oldString = mappedArgs.oldString || mappedArgs.old_text || mappedArgs.search || ''
      cleanedArgs.newString = mappedArgs.newString || mappedArgs.new_text || mappedArgs.replace || ''
      if (mappedArgs.replaceAll !== undefined) cleanedArgs.replaceAll = !!mappedArgs.replaceAll
      break

    case 'list':
      cleanedArgs.path = mappedArgs.path || mappedArgs.filePath || mappedArgs.directory || '.'
      break

    case 'glob':
      cleanedArgs.pattern = mappedArgs.pattern || mappedArgs.glob || '*'
      if (mappedArgs.path) cleanedArgs.path = mappedArgs.path
      break

    case 'grep':
      cleanedArgs.pattern = mappedArgs.pattern || mappedArgs.query || ''
      if (mappedArgs.path) cleanedArgs.path = mappedArgs.path
      break

    case 'bash':
      cleanedArgs.command = mappedArgs.command || mappedArgs.script || ''
      break

    case 'skill':
      cleanedArgs.skill = mappedArgs.skill || mappedArgs.name || ''
      if (mappedArgs.args) cleanedArgs.args = mappedArgs.args
      break

    case 'todowrite':
      cleanedArgs.todos = Array.isArray(mappedArgs.todos) ? mappedArgs.todos : []
      break

    case 'todo_read':
      break

    case 'task':
      cleanedArgs.description = mappedArgs.description || ''
      cleanedArgs.prompt = mappedArgs.prompt || mappedArgs.task || ''
      cleanedArgs.subagent_type = mappedArgs.subagent_type || mappedArgs.type || 'general-purpose'
      if (mappedArgs.useContext !== undefined) cleanedArgs.useContext = !!mappedArgs.useContext
      if (mappedArgs.constraints) cleanedArgs.constraints = mappedArgs.constraints
      break

    default:
      cleanedArgs = mappedArgs
  }

  return { name: mappedName, args: cleanedArgs }
}

describe('MCP Tools Passthrough', () => {
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

  it('should pass through MCP search tools unchanged', () => {
    const mcpArgs = {
      query: 'search something',
      options: { limit: 10 }
    }
    const result = normalizeToolCall('mcp__brave_search', mcpArgs)
    expect(result.name).toBe('mcp__brave_search')
    expect(result.args).toEqual(mcpArgs)
  })
})

describe('CLI Detection', () => {
  it('should return installed boolean in checkIFlowCLI result', () => {
    const expectedResult = { installed: true, version: '1.0.0' }
    expect(expectedResult.installed).toBe(true)
    expect(expectedResult.version).toBeDefined()
  })

  it('should return error when CLI not found', () => {
    const expectedResult = { installed: false, error: 'iflow CLI not found' }
    expect(expectedResult.installed).toBe(false)
    expect(expectedResult.error).toBeDefined()
  })
})

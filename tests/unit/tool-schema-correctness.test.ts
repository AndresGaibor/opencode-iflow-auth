import { describe, it, expect } from 'vitest'

// ============================================================================
// TOOL SCHEMA CORRECTNESS TESTS
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

describe('OpenCode Tool Schema Correctness', () => {
  it('read should use "path" not "filePath"', () => {
    const result = normalizeToolCall('read', { filePath: 'test.ts' })
    expect(result.args.path).toBeDefined()
    expect(result.args.filePath).toBeUndefined()
  })

  it('write should use "filePath" not "path"', () => {
    const result = normalizeToolCall('write', { path: 'test.ts', content: 'hello' })
    expect(result.args.filePath).toBeDefined()
  })

  it('edit should use "filePath" not "path"', () => {
    const result = normalizeToolCall('edit', {
      path: 'test.ts',
      oldString: 'a',
      newString: 'b'
    })
    expect(result.args.filePath).toBeDefined()
  })

  it('list should use "path" not "filePath"', () => {
    const result = normalizeToolCall('list', { filePath: '/project' })
    expect(result.args.path).toBeDefined()
  })

  it('glob should use "pattern" for the glob pattern', () => {
    const result = normalizeToolCall('glob', { glob: '**/*.ts' })
    expect(result.args.pattern).toBeDefined()
  })

  it('grep should use "pattern" for the search pattern', () => {
    const result = normalizeToolCall('grep', { query: 'IFlowClient' })
    expect(result.args.pattern).toBeDefined()
  })

  describe('Integration Scenarios', () => {
    it('should produce a list tool call for directory exploration', () => {
      const result = normalizeToolCall('list_directory', { directory: '.' })
      expect(result.name).toBe('list')
      expect(result.args.path).toBe('.')
    })

    it('should produce a read tool call with correct path', () => {
      const result = normalizeToolCall('read', { path: 'README.md' })
      expect(result.name).toBe('read')
      expect(result.args.path).toBe('README.md')
    })

    it('should produce an edit tool call with correct schema', () => {
      const result = normalizeToolCall('edit', {
        filePath: 'src/index.ts',
        oldString: 'foo',
        newString: 'bar'
      })
      expect(result.name).toBe('edit')
      expect(result.args.filePath).toBe('src/index.ts')
      expect(result.args.oldString).toBe('foo')
      expect(result.args.newString).toBe('bar')
    })

    it('should produce a grep tool call', () => {
      const result = normalizeToolCall('search_files', {
        pattern: 'IFlowClient',
        path: '.'
      })
      expect(result.name).toBe('grep')
      expect(result.args.pattern).toBe('IFlowClient')
    })
  })
})

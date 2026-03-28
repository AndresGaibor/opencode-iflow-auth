import { describe, it, expect } from 'vitest'

// ============================================================================
// TOOL NORMALIZATION TESTS
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

describe('Tool Normalization', () => {
  describe('read tool', () => {
    it('should normalize read_text_file to read', () => {
      const result = normalizeToolCall('read_text_file', { path: 'src/index.ts' })
      expect(result.name).toBe('read')
      expect(result.args.path).toBe('src/index.ts')
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
    })
  })

  describe('edit tool', () => {
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

    it('should NOT use text or explanation fields', () => {
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
  })

  describe('list tool', () => {
    it('should map list_directory to list (NOT bash)', () => {
      const result = normalizeToolCall('list_directory', { directory: '/project' })
      expect(result.name).toBe('list')
      expect(result.args.path).toBe('/project')
    })

    it('should map ls to list', () => {
      const result = normalizeToolCall('ls', { path: '/project' })
      expect(result.name).toBe('list')
    })
  })

  describe('glob tool', () => {
    it('should map find_files to glob', () => {
      const result = normalizeToolCall('find_files', { pattern: '**/*.ts' })
      expect(result.name).toBe('glob')
      expect(result.args.pattern).toBe('**/*.ts')
    })
  })

  describe('grep tool', () => {
    it('should map search_files to grep', () => {
      const result = normalizeToolCall('search_files', {
        pattern: 'IFlowClient',
        path: '/project'
      })
      expect(result.name).toBe('grep')
      expect(result.args.pattern).toBe('IFlowClient')
      expect(result.args.path).toBe('/project')
    })
  })

  describe('bash tool', () => {
    it('should map run_shell_command to bash', () => {
      const result = normalizeToolCall('run_shell_command', { command: 'ls -la' })
      expect(result.name).toBe('bash')
      expect(result.args.command).toBe('ls -la')
    })

    it('should map script to command for bash', () => {
      const result = normalizeToolCall('bash', { script: 'npm test' })
      expect(result.name).toBe('bash')
      expect(result.args.command).toBe('npm test')
    })
  })
})

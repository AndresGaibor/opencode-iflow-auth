import { describe, it, expect } from 'vitest'

// ============================================================================
// ADVANCED TOOLS TESTS (skill, todowrite, task)
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

describe('Advanced OpenCode Tools', () => {
  describe('skill tool', () => {
    it('should normalize skill with skill name', () => {
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

  describe('todowrite tool', () => {
    it('should normalize todowrite with todos array', () => {
      const result = normalizeToolCall('todowrite', {
        todos: [
          { id: '1', task: 'Read config', status: 'completed' },
          { id: '2', task: 'Write tests', status: 'pending' }
        ]
      })
      expect(result.name).toBe('todowrite')
      expect(result.args.todos).toHaveLength(2)
    })

    it('should handle todo_write alias', () => {
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

  describe('todo_read tool', () => {
    it('should pass through with no args', () => {
      const result = normalizeToolCall('todo_read', {})
      expect(result.name).toBe('todo_read')
      expect(Object.keys(result.args)).toHaveLength(0)
    })
  })

  describe('task tool (subagents)', () => {
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
})

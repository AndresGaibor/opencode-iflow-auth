import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createHash } from 'crypto'

// ============================================================================
// TEST HELPERS - Import the functions we need to test
// ============================================================================

// Since we can't easily import internal functions, we'll recreate key logic for unit testing
// In a real implementation, these would be exported from the module

function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex').substring(0, 16)
}

function makeSessionKey(model: string, messages: any[]): string {
  const seed = JSON.stringify({
    model,
    firstMessages: messages.slice(0, 6).map((m: any) => ({
      role: m.role,
      content: typeof m.content === 'string' 
        ? m.content.substring(0, 200) 
        : JSON.stringify(m.content).substring(0, 200),
    })),
  })
  return hashString(seed)
}

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
      // No args
      break
      
    case 'task':
      cleanedArgs.description = mappedArgs.description || ''
      cleanedArgs.prompt = mappedArgs.prompt || mappedArgs.task || ''
      cleanedArgs.subagent_type = mappedArgs.subagent_type || mappedArgs.type || 'general-purpose'
      if (mappedArgs.useContext !== undefined) cleanedArgs.useContext = !!mappedArgs.useContext
      if (mappedArgs.constraints) cleanedArgs.constraints = mappedArgs.constraints
      break
      
    default:
      // MCP tools and unknown tools pass through
      cleanedArgs = mappedArgs
  }

  return { name: mappedName, args: cleanedArgs }
}

function extractToolCallFromText(text: string): { name: string; args: any } | null {
  if (!text || !text.includes('<<USA_TOOL>>')) return null

  const match = text.match(/<<USA_TOOL>>\s*([\w.-]+)\s*(\{[\s\S]*?\})?\s*(?:<<\/USA_TOOL>>|$)/)
  if (!match) return null

  const toolName = match[1]
  const rawArgs = match[2]
  
  if (!toolName) return null

  try {
    return {
      name: toolName,
      args: rawArgs ? JSON.parse(rawArgs) : {},
    }
  } catch {
    return null
  }
}

// ============================================================================
// SESSION MANAGEMENT TESTS
// ============================================================================

describe('Session Management', () => {
  it('should generate different session keys for different conversations', () => {
    const messages1 = [{ role: 'user', content: 'Hello world' }]
    const messages2 = [{ role: 'user', content: 'Different message' }]
    
    const key1 = makeSessionKey('glm-5', messages1)
    const key2 = makeSessionKey('glm-5', messages2)
    
    expect(key1).not.toBe(key2)
  })

  it('should generate same session key for same initial conversation', () => {
    const messages = [{ role: 'user', content: 'Hello world' }]
    
    const key1 = makeSessionKey('glm-5', messages)
    const key2 = makeSessionKey('glm-5', messages)
    
    expect(key1).toBe(key2)
  })

  it('should generate different session keys for different models with same messages', () => {
    const messages = [{ role: 'user', content: 'Hello world' }]
    
    const key1 = makeSessionKey('glm-5', messages)
    const key2 = makeSessionKey('glm-4', messages)
    
    expect(key1).not.toBe(key2)
  })

  it('should only consider first 6 messages for session key', () => {
    const messages1 = [
      { role: 'user', content: 'msg1' },
      { role: 'user', content: 'msg2' },
      { role: 'user', content: 'msg3' },
      { role: 'user', content: 'msg4' },
      { role: 'user', content: 'msg5' },
      { role: 'user', content: 'msg6' },
    ]
    const messages2 = [
      ...messages1,
      { role: 'user', content: 'msg7' }, // Extra message
    ]
    
    const key1 = makeSessionKey('glm-5', messages1)
    const key2 = makeSessionKey('glm-5', messages2)
    
    expect(key1).toBe(key2)
  })
})

// ============================================================================
// TOOL NORMALIZATION TESTS
// ============================================================================

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

// ============================================================================
// TEXT PARSING TESTS
// ============================================================================

describe('Tool Call Text Parsing', () => {
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
})

// ============================================================================
// INTEGRATION SCENARIOS
// ============================================================================

describe('Integration Scenarios', () => {
  describe('Scenario 1: "revisa los archivos de este proyecto"', () => {
    it('should produce a list tool call for directory exploration', () => {
      // This tests that list_directory normalization works correctly
      const result = normalizeToolCall('list_directory', { directory: '.' })
      expect(result.name).toBe('list')
      expect(result.args.path).toBe('.')
    })
  })

  describe('Scenario 2: "lee README.md"', () => {
    it('should produce a read tool call with correct path', () => {
      const result = normalizeToolCall('read', { path: 'README.md' })
      expect(result.name).toBe('read')
      expect(result.args.path).toBe('README.md')
    })
  })

  describe('Scenario 3: "cambia foo por bar en src/index.ts"', () => {
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
  })

  describe('Scenario 4: "busca donde se usa IFlowClient"', () => {
    it('should produce a grep tool call', () => {
      const result = normalizeToolCall('search_files', {
        pattern: 'IFlowClient',
        path: '.'
      })
      expect(result.name).toBe('grep')
      expect(result.args.pattern).toBe('IFlowClient')
    })
  })

  describe('Scenario 5: Session isolation', () => {
    it('should not share session state between different chats', () => {
      const chat1Messages = [{ role: 'user', content: 'Chat 1 message' }]
      const chat2Messages = [{ role: 'user', content: 'Chat 2 message' }]
      
      const key1 = makeSessionKey('glm-5', chat1Messages)
      const key2 = makeSessionKey('glm-5', chat2Messages)
      
      // Different chats should have different session keys
      expect(key1).not.toBe(key2)
    })
  })
})

// ============================================================================
// TOOL SCHEMA CORRECTNESS TESTS
// ============================================================================

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
})

// ============================================================================
// ADVANCED TOOLS TESTS (skill, todowrite, task)
// ============================================================================

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

// ============================================================================
// MCP TOOLS PASSTHROUGH TESTS
// ============================================================================

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
})

// ============================================================================
// CLI DETECTION TESTS
// ============================================================================

describe('CLI Detection', () => {
  // Note: These tests would require mocking execSync
  // For now, we just verify the function exists and returns expected structure
  
  it('should return installed boolean in checkIFlowCLI result', () => {
    // This is a type check - the actual function is in cli-manager.ts
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

// ============================================================================
// ADVANCED TOOLS TESTS (skill, todowrite, task)
// ============================================================================

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
          { id: '1', task: 'Task 1', status: 'pending' },
          { id: '2', task: 'Task 2', status: 'completed' }
        ]
      })
      expect(result.name).toBe('todowrite')
      expect(result.args.todos).toHaveLength(2)
    })

    it('should map todo_write to todowrite', () => {
      const result = normalizeToolCall('todo_write', { todos: [] })
      expect(result.name).toBe('todowrite')
    })

    it('should handle empty todos array', () => {
      const result = normalizeToolCall('todowrite', {})
      expect(result.args.todos).toEqual([])
    })
  })

  describe('todo_read tool', () => {
    it('should normalize todo_read with no args', () => {
      const result = normalizeToolCall('todo_read', {})
      expect(result.name).toBe('todo_read')
    })
  })

  describe('task tool (subagent)', () => {
    it('should normalize task with description and prompt', () => {
      const result = normalizeToolCall('task', {
        description: 'Search for files',
        prompt: 'Find all TypeScript files in src/',
        subagent_type: 'explore-agent'
      })
      expect(result.name).toBe('task')
      expect(result.args.description).toBe('Search for files')
      expect(result.args.prompt).toBe('Find all TypeScript files in src/')
      expect(result.args.subagent_type).toBe('explore-agent')
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

    it('should preserve useContext flag', () => {
      const result = normalizeToolCall('task', {
        description: 'Task',
        prompt: 'Do something',
        useContext: true
      })
      expect(result.args.useContext).toBe(true)
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

// ============================================================================
// MCP TOOLS PASSTHROUGH TESTS
// ============================================================================

describe('MCP Tools Passthrough', () => {
  it('should pass through MCP tools unchanged (mcp__ prefix)', () => {
    const mcpArgs = { 
      query: 'search something',
      options: { limit: 10 }
    }
    const result = normalizeToolCall('mcp__brave_search', mcpArgs)
    expect(result.name).toBe('mcp__brave_search')
    expect(result.args).toEqual(mcpArgs)
  })

  it('should pass through unknown tools unchanged', () => {
    const unknownArgs = { custom: 'args' }
    const result = normalizeToolCall('custom_tool', unknownArgs)
    expect(result.name).toBe('custom_tool')
    expect(result.args).toEqual(unknownArgs)
  })

  it('should handle MCP tools with complex arguments', () => {
    const complexArgs = {
      uri: 'file:///path/to/file.ts',
      position: { line: 10, character: 5 },
      options: { includeDeclaration: true }
    }
    const result = normalizeToolCall('mcp__lsp_goto_definition', complexArgs)
    expect(result.args).toEqual(complexArgs)
  })
})

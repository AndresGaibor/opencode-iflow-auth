/**
 * makeToolDefinitions - Creates OpenCode tool definitions for testing.
 */

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: {
      type: 'object'
      properties: Record<string, any>
      required?: string[]
    }
  }
}

/**
 * Creates a basic tool definition.
 */
function makeTool(name: string, description: string, properties: Record<string, any>, required: string[] = []): ToolDefinition {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      },
    },
  }
}

/**
 * OpenCode read tool definition.
 */
export function makeReadTool(): ToolDefinition {
  return makeTool('read', 'Read file contents', {
    filePath: { type: 'string', description: 'File path to read' },
    offset: { type: 'number', description: 'Start line (optional)' },
    limit: { type: 'number', description: 'Max lines to read (optional)' },
  }, ['filePath'])
}

/**
 * OpenCode write tool definition.
 */
export function makeWriteTool(): ToolDefinition {
  return makeTool('write', 'Write content to a file', {
    filePath: { type: 'string', description: 'File path to write' },
    content: { type: 'string', description: 'Content to write' },
  }, ['filePath', 'content'])
}

/**
 * OpenCode edit tool definition.
 */
export function makeEditTool(): ToolDefinition {
  return makeTool('edit', 'Edit a file with string replacement', {
    filePath: { type: 'string', description: 'File path to edit' },
    oldString: { type: 'string', description: 'Text to search for' },
    newString: { type: 'string', description: 'Text to replace with' },
    replaceAll: { type: 'boolean', description: 'Replace all occurrences (optional)' },
  }, ['filePath', 'oldString', 'newString'])
}

/**
 * OpenCode list tool definition.
 */
export function makeListTool(): ToolDefinition {
  return makeTool('list', 'List directory contents', {
    path: { type: 'string', description: 'Directory path to list' },
  }, ['path'])
}

/**
 * OpenCode glob tool definition.
 */
export function makeGlobTool(): ToolDefinition {
  return makeTool('glob', 'Find files by pattern', {
    pattern: { type: 'string', description: 'Glob pattern' },
    path: { type: 'string', description: 'Base directory (optional)' },
  }, ['pattern'])
}

/**
 * OpenCode grep tool definition.
 */
export function makeGrepTool(): ToolDefinition {
  return makeTool('grep', 'Search for text in files', {
    pattern: { type: 'string', description: 'Search pattern' },
    path: { type: 'string', description: 'Directory to search (optional)' },
    include: { type: 'string', description: 'File pattern to include (optional)' },
  }, ['pattern'])
}

/**
 * OpenCode bash tool definition.
 */
export function makeBashTool(): ToolDefinition {
  return makeTool('bash', 'Execute a shell command', {
    command: { type: 'string', description: 'Command to execute' },
    timeout: { type: 'number', description: 'Timeout in seconds (optional)' },
  }, ['command'])
}

/**
 * OpenCode skill tool definition.
 */
export function makeSkillTool(): ToolDefinition {
  return makeTool('skill', 'Invoke a specialized skill', {
    skill: { type: 'string', description: 'Skill name to invoke' },
    args: { type: 'object', description: 'Arguments for the skill (optional)' },
  }, ['skill'])
}

/**
 * OpenCode todowrite tool definition.
 */
export function makeTodowriteTool(): ToolDefinition {
  return makeTool('todowrite', 'Write todo list', {
    todos: {
      type: 'array',
      description: 'List of todo items',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          task: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'failed'] },
        },
      },
    },
  }, ['todos'])
}

/**
 * OpenCode task tool definition (for subagents).
 */
export function makeTaskTool(): ToolDefinition {
  return makeTool('task', 'Launch a subagent task', {
    description: { type: 'string', description: 'Short description' },
    prompt: { type: 'string', description: 'Task prompt' },
    subagent_type: { type: 'string', description: 'Agent type (optional)' },
    useContext: { type: 'boolean', description: 'Include context (optional)' },
    constraints: { type: 'string', description: 'Constraints (optional)' },
  }, ['description', 'prompt'])
}

/**
 * OpenCode webfetch tool definition.
 */
export function makeWebfetchTool(): ToolDefinition {
  return makeTool('webfetch', 'Fetch content from a URL', {
    url: { type: 'string', description: 'URL to fetch' },
    prompt: { type: 'string', description: 'How to process the content (optional)' },
  }, ['url'])
}

/**
 * OpenCode websearch tool definition.
 */
export function makeWebsearchTool(): ToolDefinition {
  return makeTool('websearch', 'Search the web', {
    query: { type: 'string', description: 'Search query' },
  }, ['query'])
}

/**
 * Creates a namespaced MCP tool definition.
 */
export function makeMcpTool(serverName: string, toolName: string, properties: Record<string, any> = {}): ToolDefinition {
  return makeTool(`mcp__${serverName}__${toolName}`, `MCP tool: ${toolName}`, properties)
}

/**
 * Creates the standard set of OpenCode file tools.
 */
export function makeStandardFileTools(): ToolDefinition[] {
  return [
    makeReadTool(),
    makeWriteTool(),
    makeEditTool(),
    makeListTool(),
    makeGlobTool(),
    makeGrepTool(),
    makeBashTool(),
  ]
}

/**
 * Creates the full set of OpenCode tools including advanced tools.
 */
export function makeFullToolSet(): ToolDefinition[] {
  return [
    ...makeStandardFileTools(),
    makeSkillTool(),
    makeTodowriteTool(),
    makeTaskTool(),
    makeWebfetchTool(),
    makeWebsearchTool(),
  ]
}

/**
 * Creates tools with MCP tools included.
 */
export function makeToolsWithMcp(mcpTools: ToolDefinition[] = []): ToolDefinition[] {
  return [
    ...makeFullToolSet(),
    ...mcpTools,
  ]
}

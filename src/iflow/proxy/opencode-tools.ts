/**
 * OpenCode tool definitions - hardcoded for models that don't receive tools in request.
 * 
 * Some models (like glm-5) don't receive the `tools` field in the request from OpenCode.
 * This module provides hardcoded tool schemas so the model knows what tools are available.
 */

/**
 * OpenCode tool definition structure
 */
export interface OpenCodeToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, {
        type: string
        description: string
        enum?: string[]
        items?: any
      }>
      required: string[]
    }
  }
}

/**
 * Creates a tool definition
 */
function makeTool(
  name: string,
  description: string,
  properties: Record<string, { type: string; description: string; enum?: string[]; items?: any }>,
  required: string[] = []
): OpenCodeToolDefinition {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties,
        required,
      },
    },
  }
}

// ============================================================================
// OPENCODE TOOL DEFINITIONS
// ============================================================================

export const OPENCODE_READ_TOOL = makeTool('read', 'Read file contents', {
  filePath: { type: 'string', description: 'Absolute path to the file to read' },
  offset: { type: 'number', description: 'Start line number (0-based, optional)' },
  limit: { type: 'number', description: 'Maximum number of lines to read (optional)' },
}, ['filePath'])

export const OPENCODE_WRITE_TOOL = makeTool('write', 'Write content to a file', {
  filePath: { type: 'string', description: 'Absolute path to the file to write' },
  content: { type: 'string', description: 'Content to write to the file' },
}, ['filePath', 'content'])

export const OPENCODE_EDIT_TOOL = makeTool('edit', 'Edit a file by replacing text', {
  filePath: { type: 'string', description: 'Absolute path to the file to edit' },
  oldString: { type: 'string', description: 'The exact text to search for and replace' },
  newString: { type: 'string', description: 'The text to replace with' },
  replaceAll: { type: 'boolean', description: 'Replace all occurrences (optional, default false)' },
}, ['filePath', 'oldString', 'newString'])

export const OPENCODE_LIST_TOOL = makeTool('list', 'List directory contents', {
  path: { type: 'string', description: 'Absolute path to the directory to list' },
}, ['path'])

export const OPENCODE_GLOB_TOOL = makeTool('glob', 'Find files matching a glob pattern', {
  pattern: { type: 'string', description: 'Glob pattern to match files (e.g., **/*.ts)' },
  path: { type: 'string', description: 'Base directory for search (optional)' },
}, ['pattern'])

export const OPENCODE_GREP_TOOL = makeTool('grep', 'Search for text pattern in files', {
  pattern: { type: 'string', description: 'Regular expression pattern to search for' },
  path: { type: 'string', description: 'Directory to search in (optional)' },
  include: { type: 'string', description: 'File pattern to include (e.g., *.ts)' },
}, ['pattern'])

export const OPENCODE_BASH_TOOL = makeTool('bash', 'Execute a shell command', {
  command: { type: 'string', description: 'The shell command to execute' },
  timeout: { type: 'number', description: 'Timeout in seconds (optional)' },
}, ['command'])

export const OPENCODE_SKILL_TOOL = makeTool('skill', 'Invoke a specialized skill/agent', {
  skill: { type: 'string', description: 'Name of the skill to invoke' },
  args: { type: 'object', description: 'Arguments for the skill (optional)' },
}, ['skill'])

export const OPENCODE_TODOWRITE_TOOL = makeTool('todowrite', 'Update the todo list', {
  todos: {
    type: 'array',
    description: 'List of todo items',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique identifier for the todo' },
        task: { type: 'string', description: 'Description of the task' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'failed'], description: 'Status of the todo' },
        priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Priority level' },
      },
    },
  },
}, ['todos'])

export const OPENCODE_TASK_TOOL = makeTool('task', 'Launch a subagent for a specific task', {
  description: { type: 'string', description: 'Short description of the task (3-5 words)' },
  prompt: { type: 'string', description: 'Detailed instructions for the subagent' },
  subagent_type: { type: 'string', description: 'Type of agent (e.g., general-purpose, explore-agent)' },
  useContext: { type: 'boolean', description: 'Whether to include main agent context' },
  constraints: { type: 'string', description: 'Any constraints or limitations' },
}, ['description', 'prompt'])

export const OPENCODE_WEBFETCH_TOOL = makeTool('webfetch', 'Fetch content from a URL', {
  url: { type: 'string', description: 'The URL to fetch' },
  prompt: { type: 'string', description: 'How to process the fetched content (optional)' },
}, ['url'])

export const OPENCODE_WEBSEARCH_TOOL = makeTool('websearch', 'Search the web', {
  query: { type: 'string', description: 'Search query' },
  intent: { type: 'string', description: 'Intent of the search (optional)' },
  expected: { type: 'string', description: 'Expected results (optional)' },
}, ['query'])

// ============================================================================
// FULL TOOL SET
// ============================================================================

/**
 * All OpenCode tools - used when request doesn't include tools
 */
export const OPENCODE_TOOLS: OpenCodeToolDefinition[] = [
  OPENCODE_READ_TOOL,
  OPENCODE_WRITE_TOOL,
  OPENCODE_EDIT_TOOL,
  OPENCODE_LIST_TOOL,
  OPENCODE_GLOB_TOOL,
  OPENCODE_GREP_TOOL,
  OPENCODE_BASH_TOOL,
  OPENCODE_SKILL_TOOL,
  OPENCODE_TODOWRITE_TOOL,
  OPENCODE_TASK_TOOL,
  OPENCODE_WEBFETCH_TOOL,
  OPENCODE_WEBSEARCH_TOOL,
]

/**
 * Get tools to use - either from request or hardcoded
 */
export function getEffectiveTools(requestTools: any[] | undefined): any[] {
  if (requestTools && requestTools.length > 0) {
    return requestTools
  }
  return OPENCODE_TOOLS
}

/**
 * Build tool schema map for contract validation
 */
export function buildToolSchemaMap(tools: any[]): Map<string, { required: string[]; properties: string[] }> {
  const map = new Map<string, { required: string[]; properties: string[] }>()
  
  for (const tool of tools) {
    const fn = tool.function || tool
    if (fn.name && fn.parameters) {
      map.set(fn.name, {
        required: fn.parameters.required || [],
        properties: Object.keys(fn.parameters.properties || {}),
      })
    }
  }
  
  return map
}

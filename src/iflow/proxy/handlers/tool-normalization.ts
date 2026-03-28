/**
 * Tool normalization for ACP/iFlow
 * Maps tool names and arguments to OpenCode-compatible format
 */

import type { NormalizedToolCall } from '../types.js'

// ============================================================================
// TOOL NORMALIZATION
// ============================================================================

/**
 * Normalizes tool names and arguments to OpenCode-compatible format
 * This is the critical function for ensuring tool compatibility
 *
 * @param name - Original tool name
 * @param args - Original tool arguments
 * @returns Normalized tool call
 */
export function normalizeToolCall(name: string, args: any): NormalizedToolCall {
  let mappedName = name.trim()
  let mappedArgs = args || {}

  // Tool name redirection
  if (
    [
      'run_shell_command',
      'execute_command',
      'run_command',
      'shell',
      'terminal',
      'bash_execute',
    ].includes(mappedName)
  ) {
    mappedName = 'bash'
  } else if (['read_text_file', 'read_file', 'cat', 'getFile'].includes(mappedName)) {
    mappedName = 'read'
  } else if (['write_to_file', 'write_file', 'save_file', 'createFile'].includes(mappedName)) {
    mappedName = 'write'
  } else if (['edit_file', 'replace_in_file', 'modify_file', 'patch_file'].includes(mappedName)) {
    mappedName = 'edit'
  } else if (['search_web', 'fetch_url', 'curl'].includes(mappedName)) {
    mappedName = 'webfetch'
  } else if (
    ['list_directory_with_sizes', 'list_directory', 'ls', 'list_dir', 'directory_tree'].includes(
      mappedName
    )
  ) {
    // IMPORTANT: list_directory maps to 'list', NOT 'bash ls'
    mappedName = 'list'
  } else if (['find_files', 'glob_search', 'file_glob'].includes(mappedName)) {
    mappedName = 'glob'
  } else if (['search_files', 'file_search', 'find_in_files'].includes(mappedName)) {
    mappedName = 'grep'
  }

  // Schema-specific argument normalization
  let cleanedArgs: any = {}

  switch (mappedName) {
    case 'read':
      // OpenCode read: { filePath, offset?, limit? }
      // Note: OpenCode schema requires 'filePath', not 'path'
      cleanedArgs.filePath =
        mappedArgs.filePath || mappedArgs.path || mappedArgs.file || mappedArgs.filename || ''
      if (mappedArgs.offset !== undefined) cleanedArgs.offset = mappedArgs.offset
      if (mappedArgs.limit !== undefined) cleanedArgs.limit = mappedArgs.limit
      break

    case 'write':
      // OpenCode write: { filePath, content }
      cleanedArgs.filePath =
        mappedArgs.filePath || mappedArgs.path || mappedArgs.file || ''
      cleanedArgs.content = mappedArgs.content || mappedArgs.text || ''
      break

    case 'edit':
      // OpenCode edit: { filePath, oldString, newString, replaceAll? }
      cleanedArgs.filePath =
        mappedArgs.filePath || mappedArgs.path || mappedArgs.file || ''
      cleanedArgs.oldString =
        mappedArgs.oldString ||
        mappedArgs.old_text ||
        mappedArgs.search ||
        mappedArgs.text ||
        ''
      cleanedArgs.newString =
        mappedArgs.newString || mappedArgs.new_text || mappedArgs.replace || ''
      if (mappedArgs.replaceAll !== undefined) cleanedArgs.replaceAll = !!mappedArgs.replaceAll
      break

    case 'list':
      // OpenCode list: { path }
      cleanedArgs.path = mappedArgs.path || mappedArgs.filePath || mappedArgs.directory || '.'
      break

    case 'glob':
      // OpenCode glob: { pattern, path? }
      cleanedArgs.pattern = mappedArgs.pattern || mappedArgs.glob || '*'
      if (mappedArgs.path) cleanedArgs.path = mappedArgs.path
      break

    case 'grep':
      // OpenCode grep: { pattern, path?, include?, context_lines? }
      cleanedArgs.pattern = mappedArgs.pattern || mappedArgs.query || mappedArgs.search || ''
      if (mappedArgs.path) cleanedArgs.path = mappedArgs.path
      if (mappedArgs.include) cleanedArgs.include = mappedArgs.include
      if (mappedArgs.context_lines !== undefined)
        cleanedArgs.context_lines = mappedArgs.context_lines
      break

    case 'bash':
      // OpenCode bash: { command, timeout? }
      cleanedArgs.command = mappedArgs.command || mappedArgs.script || ''
      if (mappedArgs.timeout !== undefined) cleanedArgs.timeout = mappedArgs.timeout
      break

    case 'skill':
      // OpenCode skill: { skill, args? }
      cleanedArgs.skill = mappedArgs.skill || mappedArgs.name || ''
      if (mappedArgs.args) cleanedArgs.args = mappedArgs.args
      break

    case 'todowrite':
    case 'todo_write':
      mappedName = 'todowrite'
      // OpenCode todowrite: { todos }
      cleanedArgs.todos = Array.isArray(mappedArgs.todos) ? mappedArgs.todos : []
      break

    case 'todo_read':
      // OpenCode todo_read: no args
      break

    case 'task':
      // OpenCode task (subagent): { description, prompt, subagent_type, useContext? }
      cleanedArgs.description = mappedArgs.description || ''
      cleanedArgs.prompt = mappedArgs.prompt || mappedArgs.task || ''
      cleanedArgs.subagent_type =
        mappedArgs.subagent_type || mappedArgs.type || 'general-purpose'
      if (mappedArgs.useContext !== undefined) cleanedArgs.useContext = !!mappedArgs.useContext
      if (mappedArgs.constraints) cleanedArgs.constraints = mappedArgs.constraints
      break

    default:
      // MCP tools: pass through unchanged (mcp__ prefix)
      // Unknown tools: pass through
      cleanedArgs = mappedArgs
  }

  return { name: mappedName, args: cleanedArgs }
}

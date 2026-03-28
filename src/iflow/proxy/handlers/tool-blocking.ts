/**
 * Tool Blocking Policy for ACP/iFlow
 * Defines which tools should be blocked in strict OpenCode mode
 */

// ============================================================================
// BLOCKED TOOLS LIST
// ============================================================================

/**
 * Tools that ALWAYS block in strict mode.
 * These tools cause invisible work inside iFlow and break the "native OpenCode" illusion.
 */
export const STRICT_MODE_BLOCKED_TOOLS = [
  // Subagents - CRITICAL: causes invisible exploration inside iFlow
  'task',
  // No direct OpenCode equivalent - requires multiple 'read' calls
  'read_multiple_files',
  // Dangerous runtime execution
  'python',
  'sh',
  // Too broad, not native OpenCode behavior
  'computer_use',
  // File ops without clear OpenCode equivalent
  'create_directory',
  'move_file',
  'delete_file',
  // Already in IFLOW_INTERNAL_TOOLS but also block at normalization level
  'run_shell_command',
  'execute_command',
  'run_command',
  'bash_execute',
  'read_text_file',
  'read_file',
  'write_to_file',
  'write_file',
  'edit_file',
  'replace_in_file',
  'list_directory',
  'list_directory_with_sizes',
  'directory_tree',
  'search_files',
  'file_search',
  'find_files',
  'glob_search',
  'cat',
  'ls',
  'shell',
  'terminal',
]

// ============================================================================
// BLOCKING CHECK
// ============================================================================

/**
 * Check if a tool should be blocked based on policy
 * In strict mode, we block tools that would cause invisible work inside iFlow
 *
 * @param toolName - Name of the tool to check
 * @param options - Blocking options (strictMode)
 * @returns Object with blocked flag and reason
 */
export function shouldBlockTool(
  toolName: string,
  options?: { strictMode?: boolean }
): { blocked: boolean; reason?: string } {
  const strictMode = options?.strictMode !== false // Default to true

  if (!strictMode) {
    return { blocked: false }
  }

  const normalizedName = toolName.trim().toLowerCase()

  if (STRICT_MODE_BLOCKED_TOOLS.includes(normalizedName)) {
    // Special handling for task - most critical
    if (normalizedName === 'task') {
      return {
        blocked: true,
        reason: 'task_blocked_in_strict_mode:subagents_cause_invisible_work',
      }
    }

    // read_multiple_files - no direct equivalent
    if (normalizedName === 'read_multiple_files') {
      return {
        blocked: true,
        reason: 'read_multiple_files_blocked:no_direct_opencode_equivalent',
      }
    }

    return {
      blocked: true,
      reason: `${normalizedName}_blocked_in_strict_mode`,
    }
  }

  return { blocked: false }
}

/**
 * Get the list of all blocked tools for documentation/debugging
 *
 * @returns Array of blocked tool names
 */
export function getStrictModeBlockedTools(): string[] {
  return [...STRICT_MODE_BLOCKED_TOOLS]
}

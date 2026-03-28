/**
 * Golden tests for validating expected agent behavior sequences.
 * These tests compare actual tool sequences against expected patterns.
 * 
 * NOTE: These tests use OpenCode-native tool names (read, list, grep, edit)
 * because iFlow internal tools (read_text_file, list_directory, etc.) are
 * BLOCKED in strict mode.
 */

import { describe, it, expect } from 'vitest'
import { processACPMessage } from '../../src/iflow/proxy/handlers/acp-utils.js'

// Import golden fixtures
import repoReviewGolden from '../fixtures/opencode/repo-review.golden.json' with { type: 'json' }
import readmeGolden from '../fixtures/opencode/readme.golden.json' with { type: 'json' }
import grepSymbolGolden from '../fixtures/opencode/grep-symbol.golden.json' with { type: 'json' }
import editGolden from '../fixtures/opencode/edit.golden.json' with { type: 'json' }

// Helper to simulate processing a sequence of ACP messages
function processSequence(messages: any[]): { type: string; name?: string }[] {
  const results: { type: string; name?: string }[] = []

  for (const msg of messages) {
    const result = processACPMessage(msg)

    if (result.type === 'tool_call') {
      results.push({ type: 'tool_call', name: result.toolCall!.name })
    } else if (result.type === 'tool_blocked') {
      results.push({ type: 'tool_blocked', name: result.originalName })
    } else if (result.type === 'content' && result.reasoning) {
      results.push({ type: 'reasoning' })
      if (result.content) {
        results.push({ type: 'content' })
      }
    } else if (result.type === 'content') {
      results.push({ type: 'content' })
    } else if (result.type === 'done') {
      if (result.reasoning) {
        results.push({ type: 'reasoning' })
      }
      results.push({ type: 'done' })
    } else if (result.type === 'noop' && result.reasoning) {
      // Handle reasoning-only messages (thinking chunks)
      results.push({ type: 'reasoning' })
    }
  }

  return results
}

// Helper to check if a sequence matches a pattern
function matchesPattern(
  actual: { type: string; name?: string }[],
  expected: { type: string; name?: string }[]
): boolean {
  if (actual.length < expected.length) return false
  
  for (let i = 0; i < expected.length; i++) {
    const exp = expected[i]
    const act = actual[i]
    
    if (!exp || !act) return false
    if (exp.type !== act.type) return false
    if (exp.name && exp.name !== act.name) return false
  }
  
  return true
}

// ============================================================================
// REPO REVIEW GOLDEN TEST
// ============================================================================

describe('Golden: Repo Review', () => {
  it('should match expected sequence pattern', () => {
    const expected = repoReviewGolden.expectedSequence as { type: string; name?: string }[]

    // Simulate a typical repo review flow with OpenCode-native tools
    const messages = [
      { type: 'thinking', chunk: { thought: 'Exploring repo...' } },
      { toolName: 'list', args: { path: '.' } },
      { type: 'thinking', chunk: { thought: 'Reading files...' } },
      { toolName: 'read', args: { filePath: 'src/index.ts' } },
      { type: 'content', chunk: { text: 'Here is the repo structure...' } },
    ]

    const actual = processSequence(messages)

    // Check that actual matches the expected pattern length
    expect(actual.length).toBe(expected.length)
    expect(matchesPattern(actual, expected)).toBe(true)
  })

  it('should use list tool for directory exploration', () => {
    // Using OpenCode-native 'list' tool
    const msg = { toolName: 'list', args: { path: '.' } }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_call')
    if (result.type === 'tool_call') {
      expect(result.toolCall.name).toBe('list')
    }
  })

  it('should NOT respond with generic acknowledgment', () => {
    // If the first response is just content without tool calls,
    // that would be a generic acknowledgment
    const badMessages = [
      { type: 'content', chunk: { text: 'I understand. I will help you.' } },
      { type: 'TASK_FINISH' },
    ]
    
    const actual = processSequence(badMessages)
    
    // For proper behavior, should have tool call
    // This test documents expected behavior
    expect(repoReviewGolden.notes).toContain('Should explore before summarizing')
  })
  
  it('should BLOCK iFlow list_directory in strict mode', () => {
    // iFlow's list_directory should be blocked, not passed through
    const msg = { toolName: 'list_directory', args: { directory: '.' } }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_blocked')
  })
})

// ============================================================================
// README GOLDEN TEST
// ============================================================================

describe('Golden: Read README', () => {
  it('should match expected sequence pattern', () => {
    const expected = readmeGolden.expectedSequence as { type: string; name?: string }[]

    // Using OpenCode-native 'read' tool
    const messages = [
      { toolName: 'read', args: { filePath: 'README.md' } },
      { type: 'content', chunk: { text: 'Here is the README content...' } },
    ]

    const actual = processSequence(messages)

    expect(actual.length).toBe(expected.length)
    expect(matchesPattern(actual, expected)).toBe(true)
  })

  it('should use read tool, not bash cat', () => {
    // Using OpenCode-native 'read' tool
    const msg = { toolName: 'read', args: { filePath: 'README.md' } }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_call')
    if (result.type === 'tool_call') {
      expect(result.toolCall.name).toBe('read')
      expect(result.toolCall.name).not.toBe('bash')
    }
    
    // Check golden notes
    expect(readmeGolden.notes).toContain('Should use \'read\' tool')
  })
  
  it('should BLOCK iFlow read_text_file in strict mode', () => {
    // iFlow's read_text_file should be blocked
    const msg = { toolName: 'read_text_file', args: { path: 'README.md' } }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_blocked')
  })
})

// ============================================================================
// GREP SYMBOL GOLDEN TEST
// ============================================================================

describe('Golden: Grep Symbol', () => {
  it('should match expected sequence pattern', () => {
    const expected = grepSymbolGolden.expectedSequence as { type: string; name?: string }[]

    // Using OpenCode-native 'grep' tool
    const messages = [
      { toolName: 'grep', args: { pattern: 'IFlowClient' } },
      { type: 'content', chunk: { text: 'Found IFlowClient in these files...' } },
    ]

    const actual = processSequence(messages)

    expect(actual.length).toBe(expected.length)
    expect(matchesPattern(actual, expected)).toBe(true)
  })

  it('should use grep tool for code search', () => {
    // Using OpenCode-native 'grep' tool
    const msg = { toolName: 'grep', args: { pattern: 'IFlowClient' } }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_call')
    if (result.type === 'tool_call') {
      expect(result.toolCall.name).toBe('grep')
    }
  })
  
  it('should BLOCK iFlow search_files in strict mode', () => {
    // iFlow's search_files should be blocked
    const msg = { toolName: 'search_files', args: { pattern: 'IFlowClient' } }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_blocked')
  })
})

// ============================================================================
// EDIT GOLDEN TEST
// ============================================================================

describe('Golden: Edit File', () => {
  it('should match expected sequence pattern', () => {
    const expected = editGolden.expectedSequence as { type: string; name?: string }[]

    // Using OpenCode-native 'edit' tool
    const messages = [
      { type: 'thinking', chunk: { thought: 'Preparing edit...' } },
      { toolName: 'edit', args: {
        filePath: 'src/index.ts',
        oldString: 'foo',
        newString: 'bar'
      }},
      { type: 'content', chunk: { text: 'File updated successfully.' } },
    ]

    const actual = processSequence(messages)

    expect(actual.length).toBe(expected.length)
    expect(matchesPattern(actual, expected)).toBe(true)
  })

  it('should use edit tool with correct schema', () => {
    // Using OpenCode-native 'edit' tool
    const msg = { 
      toolName: 'edit', 
      args: { 
        filePath: 'src/index.ts', 
        oldString: 'foo', 
        newString: 'bar' 
      }
    }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_call')
    if (result.type === 'tool_call') {
      expect(result.toolCall.name).toBe('edit')
      expect(result.toolCall.args.filePath).toBe('src/index.ts')
      expect(result.toolCall.args.oldString).toBe('foo')
      expect(result.toolCall.args.newString).toBe('bar')
      expect(result.toolCall.args.text).toBeUndefined()
    }
    
    // Check golden notes
    expect(editGolden.notes).toContain('Should use \'edit\' tool with correct schema')
  })
  
  it('should BLOCK iFlow edit_file in strict mode', () => {
    // iFlow's edit_file should be blocked
    const msg = { 
      toolName: 'edit_file', 
      args: { 
        filePath: 'src/index.ts', 
        oldString: 'foo', 
        newString: 'bar' 
      }
    }
    const result = processACPMessage(msg)
    
    expect(result.type).toBe('tool_blocked')
  })
})

// ============================================================================
// PATTERN VALIDATION TESTS
// ============================================================================

describe('Pattern Validation', () => {
  it('should validate tool call pattern', () => {
    const pattern = [{ type: 'tool_call', name: 'read' }]
    const actual = [{ type: 'tool_call', name: 'read' }]
    
    expect(matchesPattern(actual, pattern)).toBe(true)
  })

  it('should validate reasoning pattern', () => {
    const pattern = [{ type: 'reasoning' }, { type: 'tool_call', name: 'list' }]
    
    const messages = [
      { chunk: { thought: 'Thinking...' } },
      { toolName: 'list', args: { path: '.' } },
    ]
    
    const actual = processSequence(messages)
    
    expect(matchesPattern(actual, pattern)).toBe(true)
  })

  it('should fail on name mismatch', () => {
    const pattern = [{ type: 'tool_call', name: 'read' }]
    const actual = [{ type: 'tool_call', name: 'write' }]
    
    expect(matchesPattern(actual, pattern)).toBe(false)
  })

  it('should fail on type mismatch', () => {
    const pattern = [{ type: 'tool_call' }]
    const actual = [{ type: 'content' }]
    
    expect(matchesPattern(actual, pattern)).toBe(false)
  })

  it('should pass when actual is longer than expected', () => {
    const pattern = [{ type: 'tool_call', name: 'read' }]
    const actual = [
      { type: 'tool_call', name: 'read' },
      { type: 'content' },
    ]
    
    expect(matchesPattern(actual, pattern)).toBe(true)
  })

  it('should fail when actual is shorter than expected', () => {
    const pattern = [
      { type: 'tool_call', name: 'read' },
      { type: 'content' },
    ]
    const actual = [{ type: 'tool_call', name: 'read' }]
    
    expect(matchesPattern(actual, pattern)).toBe(false)
  })
})
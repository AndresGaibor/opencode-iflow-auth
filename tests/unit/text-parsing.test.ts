import { describe, it, expect } from 'vitest'

// ============================================================================
// TEXT PARSING TESTS
// ============================================================================

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

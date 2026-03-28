import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'

// ============================================================================
// SESSION MANAGEMENT TESTS
// ============================================================================

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
      { role: 'user', content: 'msg7' },
    ]

    const key1 = makeSessionKey('glm-5', messages1)
    const key2 = makeSessionKey('glm-5', messages2)

    expect(key1).toBe(key2)
  })

  it('should not share session state between different chats', () => {
    const chat1Messages = [{ role: 'user', content: 'Chat 1 message' }]
    const chat2Messages = [{ role: 'user', content: 'Chat 2 message' }]

    const key1 = makeSessionKey('glm-5', chat1Messages)
    const key2 = makeSessionKey('glm-5', chat2Messages)

    expect(key1).not.toBe(key2)
  })
})

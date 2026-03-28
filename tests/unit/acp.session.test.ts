/**
 * Unit tests for session management functions.
 */

import { describe, it, expect } from 'vitest'
import { 
  hashString, 
  makeSessionKey, 
  hashToolSchema 
} from '../../src/iflow/proxy/handlers/acp-utils.js'
import type { ChatCompletionRequest } from '../../src/iflow/proxy/types.js'

// ============================================================================
// HASH STRING TESTS
// ============================================================================

describe('hashString', () => {
  it('should return a 16-character string', () => {
    const hash = hashString('test input')
    expect(hash).toHaveLength(16)
  })

  it('should return consistent hash for same input', () => {
    const hash1 = hashString('test input')
    const hash2 = hashString('test input')
    expect(hash1).toBe(hash2)
  })

  it('should return different hash for different input', () => {
    const hash1 = hashString('input 1')
    const hash2 = hashString('input 2')
    expect(hash1).not.toBe(hash2)
  })

  it('should handle empty string', () => {
    const hash = hashString('')
    expect(hash).toHaveLength(16)
  })

  it('should handle special characters', () => {
    const hash = hashString('特殊字符 🚀 <script>')
    expect(hash).toHaveLength(16)
  })
})

// ============================================================================
// MAKE SESSION KEY TESTS
// ============================================================================

describe('makeSessionKey', () => {
  const createRequest = (model: string, messages: any[]): ChatCompletionRequest => ({
    model,
    messages,
  })

  it('should generate different session keys for different conversations', () => {
    const request1 = createRequest('glm-5', [{ role: 'user', content: 'Hello world' }])
    const request2 = createRequest('glm-5', [{ role: 'user', content: 'Different message' }])
    
    const key1 = makeSessionKey(request1)
    const key2 = makeSessionKey(request2)
    
    expect(key1).not.toBe(key2)
  })

  it('should generate same session key for same initial conversation', () => {
    const request = createRequest('glm-5', [{ role: 'user', content: 'Hello world' }])
    
    const key1 = makeSessionKey(request)
    const key2 = makeSessionKey(request)
    
    expect(key1).toBe(key2)
  })

  it('should generate different session keys for different models with same messages', () => {
    const request1 = createRequest('glm-5', [{ role: 'user', content: 'Hello world' }])
    const request2 = createRequest('glm-4', [{ role: 'user', content: 'Hello world' }])
    
    const key1 = makeSessionKey(request1)
    const key2 = makeSessionKey(request2)
    
    expect(key1).not.toBe(key2)
  })

  it('should only consider first 6 messages for session key', () => {
    const messages = [
      { role: 'user', content: 'msg1' },
      { role: 'user', content: 'msg2' },
      { role: 'user', content: 'msg3' },
      { role: 'user', content: 'msg4' },
      { role: 'user', content: 'msg5' },
      { role: 'user', content: 'msg6' },
    ]
    
    const request1 = createRequest('glm-5', messages)
    const request2 = createRequest('glm-5', [...messages, { role: 'user', content: 'msg7' }])
    
    const key1 = makeSessionKey(request1)
    const key2 = makeSessionKey(request2)
    
    expect(key1).toBe(key2)
  })

  it('should change key if message in first 6 changes', () => {
    const messages1 = [
      { role: 'user', content: 'msg1' },
      { role: 'user', content: 'msg2' },
    ]
    const messages2 = [
      { role: 'user', content: 'msg1' },
      { role: 'user', content: 'CHANGED' },
    ]
    
    const request1 = createRequest('glm-5', messages1)
    const request2 = createRequest('glm-5', messages2)
    
    const key1 = makeSessionKey(request1)
    const key2 = makeSessionKey(request2)
    
    expect(key1).not.toBe(key2)
  })

  it('should handle empty messages array', () => {
    const request = createRequest('glm-5', [])
    const key = makeSessionKey(request)
    expect(key).toHaveLength(16)
  })

  it('should handle messages with content array', () => {
    const request = createRequest('glm-5', [
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] }
    ])
    const key = makeSessionKey(request)
    expect(key).toHaveLength(16)
  })

  it('should handle missing model', () => {
    const request = { model: undefined, messages: [] } as any
    const key = makeSessionKey(request)
    expect(key).toHaveLength(16)
  })

  it('should handle missing messages', () => {
    const request = { model: 'glm-5' } as any
    const key = makeSessionKey(request)
    expect(key).toHaveLength(16)
  })

  it('should truncate long content in messages', () => {
    const longContent = 'x'.repeat(500)
    const request = createRequest('glm-5', [
      { role: 'user', content: longContent }
    ])
    const key = makeSessionKey(request)
    expect(key).toHaveLength(16)
  })
})

// ============================================================================
// HASH TOOL SCHEMA TESTS
// ============================================================================

describe('hashToolSchema', () => {
  it('should return "none" for empty tools array', () => {
    const hash = hashToolSchema([])
    expect(hash).toBe('none')
  })

  it('should return "none" for null/undefined tools', () => {
    expect(hashToolSchema(null as any)).toBe('none')
    expect(hashToolSchema(undefined as any)).toBe('none')
  })

  it('should return consistent hash for same tools', () => {
    const tools = [
      { function: { name: 'read', parameters: { properties: { path: {} } } } }
    ]
    const hash1 = hashToolSchema(tools)
    const hash2 = hashToolSchema(tools)
    expect(hash1).toBe(hash2)
  })

  it('should return different hash for different tools', () => {
    const tools1 = [
      { function: { name: 'read', parameters: { properties: { path: {} } } } }
    ]
    const tools2 = [
      { function: { name: 'write', parameters: { properties: { path: {} } } } }
    ]
    const hash1 = hashToolSchema(tools1)
    const hash2 = hashToolSchema(tools2)
    expect(hash1).not.toBe(hash2)
  })

  it('should handle tools without function wrapper', () => {
    const tools = [
      { name: 'read', parameters: { properties: { path: {} } } }
    ]
    const hash = hashToolSchema(tools)
    expect(hash).toHaveLength(16)
  })

  it('should include parameter keys in hash', () => {
    const tools1 = [
      { function: { name: 'read', parameters: { properties: { path: {} } } } }
    ]
    const tools2 = [
      { function: { name: 'read', parameters: { properties: { path: {}, offset: {} } } } }
    ]
    const hash1 = hashToolSchema(tools1)
    const hash2 = hashToolSchema(tools2)
    expect(hash1).not.toBe(hash2)
  })

  it('should handle multiple tools', () => {
    const tools = [
      { function: { name: 'read', parameters: { properties: { path: {} } } } },
      { function: { name: 'write', parameters: { properties: { path: {}, content: {} } } } },
    ]
    const hash = hashToolSchema(tools)
    expect(hash).toHaveLength(16)
  })
})

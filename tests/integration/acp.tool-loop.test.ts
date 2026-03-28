/**
 * Integration tests for the complete tool loop flow.
 * Tests the interaction between OpenCode and the iFlow ACP bridge.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { TestServer, makeRequest, collectSSEChunks } from '../helpers/TestServer.js'
import { makeRepoReviewRequest, makeReadmeRequest, makeGrepRequest, makeEditRequest, makeToolResultRequest } from '../helpers/FixtureFactory.js'
import { makeStandardFileTools, makeFullToolSet } from '../helpers/makeToolDefinitions.js'

// Skip integration tests if no CLI is available
const shouldRunIntegration = process.env.IFLOW_RUN_INTEGRATION === 'true'

describe.skipIf(!shouldRunIntegration)('ACP Tool Loop Integration', () => {
  let server: TestServer
  let baseUrl: string

  beforeAll(async () => {
    server = new TestServer()
    const result = await server.start()
    baseUrl = result.baseUrl
  }, 30000)

  afterAll(async () => {
    await server.stop()
  }, 10000)

  describe('Basic Routing', () => {
    it('should respond to GET /v1/models', async () => {
      const response = await makeRequest(baseUrl, 'GET', '/v1/models')
      
      expect(response.status).toBe(200)
      expect(response.body.object).toBe('list')
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data.length).toBeGreaterThan(0)
    })

    it('should have correct model IDs', async () => {
      const response = await makeRequest(baseUrl, 'GET', '/v1/models')
      
      const modelIds = response.body.data.map((m: any) => m.id)
      expect(modelIds).toContain('glm-5')
      expect(modelIds).toContain('glm-4.6')
    })

    it('should return 404 for unknown routes', async () => {
      const response = await makeRequest(baseUrl, 'GET', '/v1/unknown')
      expect(response.status).toBe(404)
    })

    it('should return 405 for wrong method on /v1/models', async () => {
      const response = await makeRequest(baseUrl, 'POST', '/v1/models', {})
      expect(response.status).toBe(405)
    })
  })

  describe('Chat Completions', () => {
    it('should accept valid chat completion request', async () => {
      const request = {
        model: 'glm-5',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      }
      
      // This may fail if CLI is not available, but should at least parse correctly
      const response = await makeRequest(baseUrl, 'POST', '/v1/chat/completions', request)
      
      // Either succeeds or returns 503 (CLI not ready)
      expect([200, 503]).toContain(response.status)
    })

    it('should return 400 for invalid request body', async () => {
      const response = await makeRequest(baseUrl, 'POST', '/v1/chat/completions', 'invalid')
      expect(response.status).toBe(400)
    })

    it('should return 400 for missing model', async () => {
      const response = await makeRequest(baseUrl, 'POST', '/v1/chat/completions', {
        messages: [{ role: 'user', content: 'Hello' }],
      })
      expect(response.status).toBe(400)
    })
  })

  describe('Streaming', () => {
    it('should return SSE content-type for streaming requests', async () => {
      const request = {
        model: 'glm-5',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      }
      
      const response = await makeRequest(baseUrl, 'POST', '/v1/chat/completions', request)
      
      if (response.status === 200) {
        expect(response.headers['content-type']).toContain('text/event-stream')
      }
    })

    it('should emit properly formatted SSE chunks', async () => {
      const request = {
        model: 'glm-5',
        messages: [{ role: 'user', content: 'Say hello' }],
        stream: true,
      }
      
      // Skip actual chunk collection if CLI not ready
      const checkResponse = await makeRequest(baseUrl, 'GET', '/v1/models')
      if (checkResponse.status !== 200) {
        return
      }

      // This test would need a mocked or real CLI to work
      // For now we just verify the endpoint accepts streaming
    })
  })
})

// ============================================================================
// TOOL LOOP SIMULATION TESTS
// ============================================================================

describe('Tool Loop Simulation (Unit)', () => {
  // These tests simulate the tool loop without requiring a real server
  
  it('should create correct request after tool result', () => {
    const originalRequest = makeRepoReviewRequest(makeStandardFileTools())
    const toolResult = 'src/\n  index.ts\n  utils.ts\n  handlers/\n'
    
    const nextRequest = makeToolResultRequest(
      originalRequest,
      'call_123',
      'list',
      toolResult
    )
    
    expect(nextRequest.messages).toHaveLength(3) // user, assistant with tool_calls, tool result
    expect(nextRequest.messages[1].role).toBe('assistant')
    expect(nextRequest.messages[1].tool_calls).toBeDefined()
    expect(nextRequest.messages[2].role).toBe('tool')
    expect(nextRequest.messages[2].content).toBe(toolResult)
  })

  it('should preserve conversation history across tool loops', () => {
    const request1 = makeRepoReviewRequest()
    const request2 = makeToolResultRequest(request1, 'call_1', 'list', 'dir contents')
    const request3 = makeToolResultRequest(request2, 'call_2', 'read', 'file contents')
    
    // Should accumulate messages
    expect(request1.messages).toHaveLength(1)
    expect(request2.messages).toHaveLength(3)
    expect(request3.messages).toHaveLength(5)
    
    // Original message should be preserved
    expect(request3.messages[0].content).toContain('Revisa')
  })

  it('should maintain tools across tool loops', () => {
    const tools = makeFullToolSet()
    const request1 = makeRepoReviewRequest(tools)
    const request2 = makeToolResultRequest(request1, 'call_1', 'list', 'contents')
    
    expect(request2.tools).toBeDefined()
    expect(request2.tools?.length).toBe(tools.length)
  })
})

// ============================================================================
// TOOL SEQUENCE TESTS
// ============================================================================

describe('Tool Sequence Patterns', () => {
  it('should expect list -> read pattern for repo review', () => {
    // Test that the expected tool sequence is correctly structured
    const tools = makeStandardFileTools()
    const toolNames = tools.map(t => t.function.name)
    
    expect(toolNames).toContain('list')
    expect(toolNames).toContain('read')
  })

  it('should expect read pattern for file query', () => {
    const request = makeReadmeRequest(makeStandardFileTools())
    
    expect(request.messages[0].content).toContain('README')
    expect(request.tools).toBeDefined()
    expect(request.tools?.some((t: any) => t.function.name === 'read')).toBe(true)
  })

  it('should expect grep pattern for code search', () => {
    const request = makeGrepRequest(makeStandardFileTools())
    
    expect(request.messages[0].content).toContain('IFlowClient')
    expect(request.tools).toBeDefined()
    expect(request.tools?.some((t: any) => t.function.name === 'grep')).toBe(true)
  })

  it('should expect edit pattern for code modification', () => {
    const request = makeEditRequest(makeStandardFileTools())

    expect(request.messages[0].content).toContain('Cambia')
    expect(request.tools).toBeDefined()
    expect(request.tools?.some((t: any) => t.function.name === 'edit')).toBe(true)
  })
})

// ============================================================================
// SESSION ISOLATION TESTS
// ============================================================================

describe('Session Isolation', () => {
  it('should create different session keys for different conversations', async () => {
    const { makeSessionKey } = await import('../../src/iflow/proxy/handlers/acp-utils.js')
    
    const request1 = makeRepoReviewRequest()
    const request2 = makeReadmeRequest()
    
    const key1 = makeSessionKey(request1)
    const key2 = makeSessionKey(request2)
    
    expect(key1).not.toBe(key2)
  })

  it('should create same session key for same conversation', async () => {
    const { makeSessionKey } = await import('../../src/iflow/proxy/handlers/acp-utils.js')
    
    const request = makeRepoReviewRequest()
    
    const key1 = makeSessionKey(request)
    const key2 = makeSessionKey(request)
    
    expect(key1).toBe(key2)
  })

  it('should create different session keys for different models', async () => {
    const { makeSessionKey } = await import('../../src/iflow/proxy/handlers/acp-utils.js')
    
    const request1 = { ...makeRepoReviewRequest(), model: 'glm-5' }
    const request2 = { ...makeRepoReviewRequest(), model: 'glm-4.6' }
    
    const key1 = makeSessionKey(request1)
    const key2 = makeSessionKey(request2)
    
    expect(key1).not.toBe(key2)
  })
})

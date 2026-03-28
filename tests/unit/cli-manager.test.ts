/**
 * Unit tests for CLI detection functions.
 * Note: These tests use manual mocking since Bun test mocks work differently than Vitest.
 */

import { describe, it, expect } from 'bun:test'

// We can't easily mock child_process and fs in Bun test the same way as Vitest
// So we'll test the behavior indirectly through the exported functions

describe('CLI Detection', () => {
  it('should return installed boolean in checkIFlowCLI result', async () => {
    const { checkIFlowCLI } = await import('../../src/iflow/proxy/cli-manager.js')
    
    const result = checkIFlowCLI()
    
    // The result should always have an installed boolean
    expect(typeof result.installed).toBe('boolean')
  })

  it('should return error when CLI not found', async () => {
    const { checkIFlowCLI } = await import('../../src/iflow/proxy/cli-manager.js')
    
    const result = checkIFlowCLI()
    
    // If CLI is not installed, error should be present
    if (!result.installed) {
      expect(result.error).toBeDefined()
      expect(typeof result.error).toBe('string')
    }
  })
})

describe('Login Detection', () => {
  it('should return loggedIn boolean in checkIFlowLogin result', async () => {
    const { checkIFlowLogin } = await import('../../src/iflow/proxy/cli-manager.js')
    
    const result = checkIFlowLogin()
    
    // The result should always have a loggedIn boolean
    expect(typeof result.loggedIn).toBe('boolean')
  })

  it('should return apiKey when logged in', async () => {
    const { checkIFlowLogin } = await import('../../src/iflow/proxy/cli-manager.js')
    
    const result = checkIFlowLogin()
    
    // If logged in, apiKey should be present
    if (result.loggedIn) {
      expect(result.apiKey).toBeDefined()
      expect(typeof result.apiKey).toBe('string')
    }
  })
})

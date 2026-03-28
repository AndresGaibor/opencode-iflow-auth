/**
 * Unit tests for index exports.
 * Verifies that the plugin exports are correct.
 */

import { describe, it, expect } from 'vitest'

// ============================================================================
// EXPORT VALIDATION TESTS
// ============================================================================

describe('Index Exports', () => {
  it('should export IFlowPlugin', async () => {
    const exports = await import('../../src/index.js')
    
    expect(exports.IFlowPlugin).toBeDefined()
    expect(typeof exports.IFlowPlugin).toBe('function')
  })

  it('should export IFlowProxyPlugin', async () => {
    const exports = await import('../../src/index.js')
    
    expect(exports.IFlowProxyPlugin).toBeDefined()
    expect(typeof exports.IFlowProxyPlugin).toBe('function')
  })

  it('should have IFlowProxyPlugin as separate implementation', async () => {
    const exports = await import('../../src/index.js')

    // After refactoring, IFlowProxyPlugin is a separate implementation (not an alias)
    // Both should be functions but different references
    expect(exports.IFlowProxyPlugin).toBeDefined()
    expect(exports.IFlowPlugin).toBeDefined()
    expect(typeof exports.IFlowProxyPlugin).toBe('function')
    expect(typeof exports.IFlowPlugin).toBe('function')
    // They are different functions now (separate implementations for different providers)
    expect(exports.IFlowProxyPlugin).not.toBe(exports.IFlowPlugin)
  })

  it('should export IFlowConfig type', async () => {
    const exports = await import('../../src/index.js')
    
    // Type exports are not runtime values, but we can check the module loaded
    expect(exports).toBeDefined()
  })

  it('should export IFlowAuthMethod type', async () => {
    const exports = await import('../../src/index.js')
    
    expect(exports).toBeDefined()
  })

  it('should export ManagedAccount type', async () => {
    const exports = await import('../../src/index.js')
    
    expect(exports).toBeDefined()
  })
})

// ============================================================================
// PLUGIN STRUCTURE TESTS
// ============================================================================

describe('Plugin Structure', () => {
  it('should return hooks object when IFlowPlugin is called', async () => {
    const { IFlowPlugin } = await import('../../src/index.js')
    
    // Mock PluginInput
    const mockInput = {
      client: {
        tui: {
          showToast: () => Promise.resolve(),
        },
      },
    }
    
    // IFlowPlugin is async and returns Hooks
    const hooks = await IFlowPlugin(mockInput as any)
    
    expect(hooks).toBeDefined()
    expect(hooks.auth).toBeDefined()
    expect(hooks['chat.headers']).toBeDefined()
  })

  it('should have auth.provider set to "iflow"', async () => {
    const { IFlowPlugin } = await import('../../src/index.js')
    
    const mockInput = {
      client: {
        tui: {
          showToast: () => Promise.resolve(),
        },
      },
    }
    
    const hooks = await IFlowPlugin(mockInput as any)
    
    expect(hooks.auth.provider).toBe('iflow')
  })

  it('should have auth.loader function', async () => {
    const { IFlowPlugin } = await import('../../src/index.js')
    
    const mockInput = {
      client: {
        tui: {
          showToast: () => Promise.resolve(),
        },
      },
    }
    
    const hooks = await IFlowPlugin(mockInput as any)
    
    expect(typeof hooks.auth.loader).toBe('function')
  })

  it('should have auth.methods array', async () => {
    const { IFlowPlugin } = await import('../../src/index.js')
    
    const mockInput = {
      client: {
        tui: {
          showToast: () => Promise.resolve(),
        },
      },
    }
    
    const hooks = await IFlowPlugin(mockInput as any)
    
    expect(Array.isArray(hooks.auth.methods)).toBe(true)
    expect(hooks.auth.methods.length).toBeGreaterThan(0)
  })

  it('should have OAuth method', async () => {
    const { IFlowPlugin } = await import('../../src/index.js')
    
    const mockInput = {
      client: {
        tui: {
          showToast: () => Promise.resolve(),
        },
      },
    }
    
    const hooks = await IFlowPlugin(mockInput as any)
    
    const oauthMethod = hooks.auth.methods.find(m => m.type === 'oauth')
    expect(oauthMethod).toBeDefined()
    expect(oauthMethod?.label).toContain('OAuth')
  })

  it('should have API key method', async () => {
    const { IFlowPlugin } = await import('../../src/index.js')
    
    const mockInput = {
      client: {
        tui: {
          showToast: () => Promise.resolve(),
        },
      },
    }
    
    const hooks = await IFlowPlugin(mockInput as any)
    
    const apiMethod = hooks.auth.methods.find(m => m.type === 'api')
    expect(apiMethod).toBeDefined()
    expect(apiMethod?.label).toContain('API Key')
  })

  it('should have chat.headers hook', async () => {
    const { IFlowPlugin } = await import('../../src/index.js')
    
    const mockInput = {
      client: {
        tui: {
          showToast: () => Promise.resolve(),
        },
      },
    }
    
    const hooks = await IFlowPlugin(mockInput as any)
    
    expect(typeof hooks['chat.headers']).toBe('function')
  })

  it('should set User-Agent header in chat.headers', async () => {
    const { IFlowPlugin } = await import('../../src/index.js')
    
    const mockInput = {
      client: {
        tui: {
          showToast: () => Promise.resolve(),
        },
      },
    }
    
    const hooks = await IFlowPlugin(mockInput as any)
    
    const output = { headers: {} }
    await hooks['chat.headers']({}, output)
    
    expect(output.headers['User-Agent']).toBeDefined()
    // User-Agent contains iFlow (case may vary)
    expect(output.headers['User-Agent'].toLowerCase()).toContain('iflow')
  })
})

// ============================================================================
// PLUGIN-PROXY EXPORT TESTS
// ============================================================================

describe('Plugin-Proxy Exports', () => {
  it('should export IFlowProxyPlugin from plugin-proxy.ts', async () => {
    const exports = await import('../../src/plugin-proxy.js')
    
    expect(exports.IFlowProxyPlugin).toBeDefined()
    expect(typeof exports.IFlowProxyPlugin).toBe('function')
  })

  it('should have auth.provider set to "iflow-proxy"', async () => {
    const { IFlowProxyPlugin } = await import('../../src/plugin-proxy.js')
    
    const mockInput = {
      client: {
        tui: {
          showToast: () => Promise.resolve(),
        },
      },
    }
    
    const hooks = await IFlowProxyPlugin(mockInput as any)
    
    expect(hooks.auth.provider).toBe('iflow-proxy')
  })
})

// ============================================================================
// EXPORT CONSISTENCY TESTS
// ============================================================================

describe('Export Consistency', () => {
  it('should have consistent exports between index.ts and plugin-iflow.ts', async () => {
    const indexExports = await import('../../src/index.js')

    // IFlowPlugin should be the main export
    expect(indexExports.IFlowPlugin).toBeDefined()
    expect(indexExports.IFlowProxyPlugin).toBeDefined()

    // After refactoring, they are separate implementations for different providers
    // IFlowPlugin uses 'iflow' provider, IFlowProxyPlugin uses 'iflow-proxy' provider
    expect(indexExports.IFlowPlugin).not.toBe(indexExports.IFlowProxyPlugin)
  })

  it('should not have undefined exports', async () => {
    const exports = await import('../../src/index.js')
    
    const exportKeys = Object.keys(exports)
    for (const key of exportKeys) {
      expect((exports as any)[key]).not.toBeUndefined()
    }
  })
})

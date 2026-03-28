/**
 * Unit tests for CLI detection functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock child_process and fs before importing the module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'

// Import after mocking
import { 
  checkIFlowCLI, 
  checkIFlowLogin 
} from '../../src/iflow/proxy/cli-manager.js'

const mockedExecSync = vi.mocked(execSync)
const mockedExistsSync = vi.mocked(existsSync)
const mockedReadFileSync = vi.mocked(readFileSync)

// ============================================================================
// CHECK IFLOW CLI TESTS
// ============================================================================

describe('checkIFlowCLI', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return installed: true when CLI is found', () => {
    mockedExecSync.mockReturnValueOnce('/usr/local/bin/iflow') // which iflow
    mockedExecSync.mockReturnValueOnce('1.0.0') // iflow --version

    const result = checkIFlowCLI()

    expect(result.installed).toBe(true)
    expect(result.version).toBe('1.0.0')
  })

  it('should return installed: false when CLI is not in PATH', () => {
    mockedExecSync.mockImplementationOnce(() => {
      throw new Error('Command not found')
    })

    const result = checkIFlowCLI()

    expect(result.installed).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('should handle version command failure', () => {
    mockedExecSync.mockReturnValueOnce('/usr/local/bin/iflow') // which iflow
    mockedExecSync.mockImplementationOnce(() => {
      throw new Error('Version check failed')
    })

    const result = checkIFlowCLI()

    expect(result.installed).toBe(true)
    expect(result.version).toBe('installed')
  })

  it('should handle empty PATH result', () => {
    mockedExecSync.mockReturnValueOnce('') // which returns empty

    const result = checkIFlowCLI()

    expect(result.installed).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('should trim whitespace from version', () => {
    mockedExecSync.mockReturnValueOnce('/usr/local/bin/iflow')
    mockedExecSync.mockReturnValueOnce('  2.0.0  \n')

    const result = checkIFlowCLI()

    expect(result.version).toBe('2.0.0')
  })
})

// ============================================================================
// CHECK IFLOW LOGIN TESTS
// ============================================================================

describe('checkIFlowLogin', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return loggedIn: true when valid credentials exist', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      access_token: 'valid_token',
      apiKey: 'test_key',
      userName: 'test@example.com',
      expiry_date: Date.now() + 3600000, // 1 hour from now
    }))

    const result = checkIFlowLogin()

    expect(result.loggedIn).toBe(true)
    expect(result.apiKey).toBe('test_key')
  })

  it('should return loggedIn: false when credentials file does not exist', () => {
    mockedExistsSync.mockReturnValue(false)

    const result = checkIFlowLogin()

    expect(result.loggedIn).toBe(false)
    expect(result.error).toContain('no oauth_creds.json')
  })

  it('should return loggedIn: false when token is expired', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      access_token: 'expired_token',
      expiry_date: Date.now() - 3600000, // 1 hour ago
    }))

    const result = checkIFlowLogin()

    expect(result.loggedIn).toBe(false)
    expect(result.error).toContain('expired')
  })

  it('should return loggedIn: false when no token present', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      userName: 'test@example.com',
    }))

    const result = checkIFlowLogin()

    expect(result.loggedIn).toBe(false)
    expect(result.error).toContain('no token')
  })

  it('should handle malformed JSON in credentials file', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue('not valid json')

    const result = checkIFlowLogin()

    expect(result.loggedIn).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('should handle apiKey field instead of access_token', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      apiKey: 'direct_api_key',
      userName: 'test@example.com',
    }))

    const result = checkIFlowLogin()

    expect(result.loggedIn).toBe(true)
    expect(result.apiKey).toBe('direct_api_key')
  })

  it('should handle missing expiry_date (non-expiring token)', () => {
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      access_token: 'permanent_token',
      apiKey: 'test_key',
    }))

    const result = checkIFlowLogin()

    expect(result.loggedIn).toBe(true)
  })
})

// ============================================================================
// CLI DETECTION INTEGRATION TESTS
// ============================================================================

describe('CLI Detection Integration', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should distinguish between installed and loggedIn states', () => {
    // CLI installed but not logged in
    mockedExecSync.mockReturnValue('/usr/local/bin/iflow')
    mockedExecSync.mockReturnValueOnce('1.0.0')
    mockedExistsSync.mockReturnValue(false)

    const cliResult = checkIFlowCLI()
    const loginResult = checkIFlowLogin()

    expect(cliResult.installed).toBe(true)
    expect(loginResult.loggedIn).toBe(false)
  })

  it('should detect both installed and logged in', () => {
    // CLI installed
    mockedExecSync.mockReturnValue('/usr/local/bin/iflow')
    mockedExecSync.mockReturnValueOnce('1.0.0')
    
    // Logged in
    mockedExistsSync.mockReturnValue(true)
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      access_token: 'valid_token',
      apiKey: 'test_key',
    }))

    const cliResult = checkIFlowCLI()
    const loginResult = checkIFlowLogin()

    expect(cliResult.installed).toBe(true)
    expect(loginResult.loggedIn).toBe(true)
  })

  it('should detect neither installed nor logged in', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('Not found')
    })
    mockedExistsSync.mockReturnValue(false)

    const cliResult = checkIFlowCLI()
    const loginResult = checkIFlowLogin()

    expect(cliResult.installed).toBe(false)
    expect(loginResult.loggedIn).toBe(false)
  })
})

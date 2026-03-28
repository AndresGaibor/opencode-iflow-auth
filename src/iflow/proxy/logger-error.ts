/**
 * Error logging and contract validation for ACP/iFlow
 */

import { logJson, LOG_FILES, logLine } from './logger-core.js'
import type { LogErrorParams, ToolContract, ToolContractMap } from './logger-types.js'

// ============================================================================
// ERROR LOGGING
// ============================================================================

/**
 * Log error or contract mismatch
 *
 * @param params - Error logging parameters
 */
export function logError(params: LogErrorParams): void {
  const { sessionKey, turnId, model, errorType, message, details } = params

  logJson(LOG_FILES.ERRORS, {
    ts: new Date().toISOString(),
    event: 'error',
    errorType,
    sessionKey,
    turnId,
    model,
    message,
    details,
  })
}

// ============================================================================
// CONTRACT AUDIT UTILITIES
// ============================================================================

/**
 * Extract tool contracts from OpenCode tools array
 *
 * @param tools - Array of tool definitions
 * @returns Map of tool contracts
 */
export function buildToolContractMap(
  tools: Array<{ function?: { name: string; parameters?: any } }>
): ToolContractMap {
  const map: ToolContractMap = new Map()

  if (!tools) return map

  for (const tool of tools) {
    if (tool.function?.name && tool.function.parameters) {
      map.set(tool.function.name, {
        required: tool.function.parameters.required || [],
        properties: Object.keys(tool.function.parameters.properties || {}),
      })
    }
  }

  return map
}

/**
 * Validate tool call against contract and log mismatches
 *
 * @param params - Validation parameters
 * @returns Validation result with issues
 */
export function validateToolCallContract(params: {
  toolName: string
  args: Record<string, any>
  contractMap: ToolContractMap
  sessionKey?: string
  turnId?: string
  model?: string
}): { valid: boolean; issues: string[] } {
  const { toolName, args, contractMap, sessionKey, turnId, model } = params
  const issues: string[] = []

  const contract = contractMap.get(toolName)

  if (!contract) {
    // Unknown tool - can't validate
    return { valid: true, issues: [] }
  }

  // Check required fields
  for (const requiredField of contract.required) {
    if (args[requiredField] === undefined || args[requiredField] === '') {
      issues.push(`Missing required field: ${requiredField}`)
    }
  }

  // Check for common field name mismatches
  const commonMismatches: Record<string, string[]> = {
    // If schema expects filePath but we have path
    filePath: ['path', 'file', 'filename'],
    // If schema expects path but we have filePath
    path: ['filePath', 'file', 'filename'],
    // If schema expects command but we have script
    command: ['script', 'cmd'],
  }

  for (const [expectedField, aliases] of Object.entries(commonMismatches)) {
    if (contract.required.includes(expectedField) && !args[expectedField]) {
      for (const alias of aliases) {
        if (args[alias] !== undefined) {
          issues.push(`Field mismatch: schema expects '${expectedField}' but got '${alias}'`)
          break
        }
      }
    }
  }

  if (issues.length > 0) {
    logError({
      sessionKey,
      turnId,
      model,
      errorType: 'contract_mismatch',
      message: `Tool '${toolName}' has contract issues`,
      details: {
        toolName,
        expectedRequired: contract.required,
        actualArgs: args,
        issues,
      },
    })
  }

  return { valid: issues.length === 0, issues }
}

// ============================================================================
// TURN ID GENERATION
// ============================================================================

/**
 * Generate a unique turn ID for request correlation
 *
 * @returns Unique turn ID
 */
export function generateTurnId(): string {
  const { randomUUID } = require('crypto') as typeof import('crypto')
  return `turn_${Date.now()}_${randomUUID().substring(0, 8)}`
}

// ============================================================================
// SANITIZATION
// ============================================================================

/**
 * Sanitize a value for logging (remove sensitive data)
 *
 * @param value - Value to sanitize
 * @param maxDepth - Maximum recursion depth
 * @returns Sanitized value
 */
export function sanitizeForLog(value: unknown, maxDepth: number = 5): unknown {
  if (maxDepth <= 0) return '[max depth reached]'

  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'string') {
    // Redact potential secrets
    if (value.match(/^(sk-|api[_-]?key|token|password|secret|bearer)/i)) {
      return '[REDACTED]'
    }
    // Truncate very long strings
    if (value.length > 10000) {
      return value.substring(0, 10000) + '...[truncated]'
    }
    return value
  }

  if (typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((v) => sanitizeForLog(v, maxDepth - 1))
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    // Redact sensitive keys
    if (key.match(/^(api[_-]?key|token|password|secret|authorization|bearer)/i)) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = sanitizeForLog(val, maxDepth - 1)
    }
  }
  return sanitized
}

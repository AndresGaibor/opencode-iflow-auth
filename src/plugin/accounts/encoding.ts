/**
 * Refresh token encoding/decoding utilities
 */

import type { RefreshParts } from '../types.js'

/**
 * Encode refresh token parts to base64 string
 * @param parts - The refresh token parts
 * @returns Base64 encoded string
 */
export function encodeRefreshToken(parts: RefreshParts): string {
  return Buffer.from(JSON.stringify(parts)).toString('base64')
}

/**
 * Decode base64 refresh token to parts
 * @param encoded - The base64 encoded refresh token
 * @returns The decoded refresh token parts
 */
export function decodeRefreshToken(encoded: string): RefreshParts {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'))
  } catch {
    return { authMethod: 'apikey' }
  }
}

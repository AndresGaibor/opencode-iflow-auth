/**
 * OAuth callback input parsing utilities
 */

export interface CallbackInputResult {
  code: string
  state: string
}

/**
 * Parse OAuth callback input from various formats
 * @param input - The callback input string
 * @returns Parsed code and state, or null if invalid
 */
export function parseCallbackInput(input: string): CallbackInputResult | null {
  try {
    // Try parsing as URL
    if (input.startsWith('http')) {
      const url = new URL(input)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      if (code && state) {
        return { code, state }
      }
    }

    // Try parsing as query string
    if (input.includes('code=')) {
      const codeMatch = input.match(/code=([^&\s]+)/)
      const stateMatch = input.match(/state=([^&\s]+)/)
      if (codeMatch && stateMatch && codeMatch[1] && stateMatch[1]) {
        return { code: codeMatch[1], state: stateMatch[1] }
      }
    }

    // Try parsing as space-separated code and state
    const parts = input.split(/\s+/).filter(p => p.length > 0)
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return { code: parts[0], state: parts[1] }
    }

    // Try parsing as just code (if long enough)
    if (parts.length === 1 && parts[0] && parts[0].length > 20) {
      return { code: parts[0], state: '' }
    }

    return null
  } catch {
    return null
  }
}

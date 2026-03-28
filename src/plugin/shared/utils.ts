/**
 * Utility functions for shared plugin handlers
 */

/**
 * Parse OAuth callback input from user
 * Handles both full URLs and raw codes
 */
export function parseCallbackInput(input: string): string {
  if (input.startsWith('http')) {
    try {
      const url = new URL(input)
      const code = url.searchParams.get('code')
      if (code) return code
    } catch {}
  }

  if (input.includes('code=')) {
    const match = input.match(/code=([^&\s]+)/)
    if (match && match[1]) return match[1]
  }

  return input
}

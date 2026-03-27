import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

export function isHeadlessEnvironment(): boolean {
  return !!(
    process.env.SSH_CONNECTION ||
    process.env.SSH_CLIENT ||
    process.env.SSH_TTY ||
    process.env.OPENCODE_HEADLESS ||
    process.env.CI ||
    process.env.CONTAINER ||
    (process.platform !== 'win32' && !process.env.DISPLAY)
  )
}

export async function promptOAuthCallback(): Promise<string> {
  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question(
      'Headless environment detected. Completa la autenticación en tu navegador y pega aquí la callback URL o el authorization code: ',
    )
    return answer.trim()
  } finally {
    rl.close()
  }
}

export async function promptWaitForOAuth(): Promise<void> {
  const rl = createInterface({ input, output })
  try {
    await rl.question('Press Enter after completing authentication in browser...')
  } finally {
    rl.close()
  }
}

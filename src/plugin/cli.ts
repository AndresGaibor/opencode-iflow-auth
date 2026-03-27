import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

export async function promptAddAnotherAccount(currentCount: number): Promise<boolean> {
  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question(`Add another account? (${currentCount} added) (y/n): `)
    const normalized = answer.trim().toLowerCase()
    return normalized === 'y' || normalized === 'yes'
  } finally {
    rl.close()
  }
}

export type LoginMode = 'add' | 'fresh'

export interface ExistingAccountInfo {
  email?: string
  index: number
}

export async function promptLoginMode(existingAccounts: ExistingAccountInfo[]): Promise<LoginMode> {
  const rl = createInterface({ input, output })
  try {
    while (true) {
      const answer = await rl.question(
        `${existingAccounts.length} cuenta(s) guardada(s). ¿(a)ñadir nuevas cuentas o empezar de (f)resco? [a/f]: `,
      )
      const normalized = answer.trim().toLowerCase()

      if (normalized === 'a' || normalized === 'add') {
        return 'add'
      }
      if (normalized === 'f' || normalized === 'fresh') {
        return 'fresh'
      }

    }
  } finally {
    rl.close()
  }
}

export type AuthMethod = 'oauth' | 'apikey'

export async function promptAuthMethod(): Promise<AuthMethod> {
  const rl = createInterface({ input, output })
  try {
    while (true) {
      const answer = await rl.question('Choose auth method: (o)auth or (a)pi key? [o/a]: ')
      const normalized = answer.trim().toLowerCase()

      if (normalized === 'o' || normalized === 'oauth') {
        return 'oauth'
      }
      if (normalized === 'a' || normalized === 'apikey' || normalized === 'api') {
        return 'apikey'
      }
    }
  } finally {
    rl.close()
  }
}

export async function promptApiKey(): Promise<string> {
  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question('Enter your iFlow API Key (sk-...): ')
    return answer.trim()
  } finally {
    rl.close()
  }
}

export async function promptEmail(): Promise<string> {
  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question('Enter email (optional, for display): ')
    return answer.trim() || 'api-key-user'
  } finally {
    rl.close()
  }
}

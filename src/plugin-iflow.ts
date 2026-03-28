import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { loadConfig } from "./plugin/config/index.js"
import { AccountManager, generateAccountId } from "./plugin/accounts.js"
import { validateApiKey } from "./iflow/apikey.js"
import { promptApiKey, promptEmail } from "./plugin/cli.js"
import type { ManagedAccount } from "./plugin/types.js"
import { IFLOW_CONSTANTS, registerIFlowModels } from "./constants.js"
import { IFlowOAuthHandler, IFlowApiKeyHandler } from "./plugin/shared/index.js"

const DEBUG = process.env.IFLOW_AUTH_DEBUG === 'true'

function log(...args: any[]) {
  if (DEBUG) {
    console.error('[iflow-auth]', ...args)
  }
}

export const IFlowPlugin = async (input: PluginInput): Promise<Hooks> => {
  const config = loadConfig()
  const showToast = (
    message: string,
    variant: "info" | "warning" | "success" | "error",
  ) => {
    input.client.tui.showToast({ body: { message, variant } }).catch(() => {})
  }

  return {
    auth: {
      provider: "iflow",
      loader: async (getAuth: () => Promise<any>, provider: any) => {
        log('loader called')

        const auth = await getAuth()
        log('auth result:', auth ? 'found' : 'not found')

        const am = await AccountManager.loadFromDisk(
          config.account_selection_strategy,
        )

        log('account count:', am.getAccountCount())

        registerIFlowModels(provider)

        const accountCount = am.getAccountCount()
        if (accountCount === 0) {
          log('No accounts found in loader')
          return {}
        }

        const firstAccount = am.getCurrentOrNext()
        if (!firstAccount) {
          log('No available account')
          return {}
        }

        log('Using account:', firstAccount.email, 'apiKey:', firstAccount.apiKey.substring(0, 10) + '...')

        return {
          apiKey: firstAccount.apiKey,
          baseURL: IFLOW_CONSTANTS.BASE_URL,
        }
      },
      methods: [
        {
          label: "iFlow OAuth 2.0",
          type: "oauth",
          authorize: () => IFlowOAuthHandler.authorize(config, showToast),
        },
        {
          label: "iFlow API Key",
          type: "api",
          authorize: () => IFlowApiKeyHandler.authorize(config),
        },
      ],
    },
    "chat.headers": async (
      input: any,
      output: { headers: Record<string, string> },
    ) => {
      output.headers["User-Agent"] = `${IFLOW_CONSTANTS.USER_AGENT}/2.0`
    },
  }
}

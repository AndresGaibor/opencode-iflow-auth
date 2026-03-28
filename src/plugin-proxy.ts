import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { loadConfig } from "./plugin/config/index.js"
import { AccountManager, generateAccountId } from "./plugin/accounts.js"
import { startProxy, getProxyInstance } from "./iflow/proxy.js"
import { promptApiKey, promptEmail } from "./plugin/cli.js"
import { validateApiKey } from "./iflow/apikey.js"
import type { ManagedAccount } from "./plugin/types.js"
import { IFLOW_CONSTANTS, registerAllModels } from "./constants.js"
import { IFlowOAuthHandler, IFlowApiKeyHandler } from "./plugin/shared/index.js"

const DEBUG = process.env.IFLOW_PROXY_DEBUG === 'true'
const AUTO_START_PROXY = process.env.IFLOW_AUTO_START_PROXY !== 'false'

function log(...args: any[]) {
  if (DEBUG) {
    console.error('[iflow-proxy]', ...args)
  }
}

let proxyStarted = false

async function ensureProxyStarted(): Promise<string> {
  if (!proxyStarted && AUTO_START_PROXY) {
    log('Starting CLI proxy...')
    const proxy = await startProxy()
    proxyStarted = true
    log('CLI proxy started at:', proxy.getBaseUrl())
    return proxy.getBaseUrl()
  }
  return getProxyInstance().getBaseUrl()
}

export const IFlowProxyPlugin = async (input: PluginInput): Promise<Hooks> => {
  const config = loadConfig()
  const showToast = (
    message: string,
    variant: "info" | "warning" | "success" | "error",
  ) => {
    input.client.tui.showToast({ body: { message, variant } }).catch(() => {})
  }

  await ensureProxyStarted()

  return {
    auth: {
      provider: "iflow-proxy",
      loader: async (getAuth: () => Promise<any>, provider: any) => {
        log('loader called')

        const auth = await getAuth()
        log('auth result:', auth ? 'found' : 'not found')

        const am = await AccountManager.loadFromDisk(
          config.account_selection_strategy,
        )

        log('account count:', am.getAccountCount())

        registerAllModels(provider, null, true)

        const proxy = getProxyInstance()

        if (!proxy.isCLIAvailable()) {
          log('CLI not available')
          showToast('iflow CLI is not available. Please install: npm install -g iflow-cli', 'error')
          return {}
        }

        if (!proxy.isCLILoggedIn()) {
          log('CLI not logged in')
          showToast('iflow CLI is not logged in. Please run: iflow login', 'error')
          return {}
        }

        const accountCount = am.getAccountCount()
        if (accountCount === 0) {
          log('No accounts found, using CLI auth')
          return {
            apiKey: 'cli-auth',
            baseURL: proxy.getBaseUrl(),
          }
        }

        const firstAccount = am.getCurrentOrNext()
        if (!firstAccount) {
          log('No available account')
          return {
            apiKey: 'cli-auth',
            baseURL: proxy.getBaseUrl(),
          }
        }

        log('Using account:', firstAccount.email, 'apiKey:', firstAccount.apiKey.substring(0, 10) + '...')

        return {
          apiKey: firstAccount.apiKey,
          baseURL: proxy.getBaseUrl(),
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

import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { loadConfig } from "./plugin/config/index.js"
import { AccountManager } from "./plugin/accounts.js"
import { startProxy, getProxyInstance } from "./iflow/proxy.js"
import { getModels, type ModelCache } from "./iflow/models.js"
import { IFlowOAuthHandler } from "./plugin/auth/oauth-flow.js"
import { IFlowApiKeyHandler } from "./plugin/auth/apikey-flow.js"
import { IFLOW_CONSTANTS, registerAllModels } from "./constants.js"

const DEBUG = process.env.IFLOW_AUTH_DEBUG === 'true'
function log(...args: any[]) { if (DEBUG) console.error('[iflow-auth]', ...args) }

let proxyStarted = false
let modelCache: ModelCache | null = null

async function ensureProxyStarted(enableLog: boolean = false): Promise<string> {
  const proxy = await startProxy()
  if (!proxyStarted) {
    proxy.setEnableLog(enableLog)
    proxyStarted = true
  }
  proxy.setEnableLog(enableLog)
  return proxy.getBaseUrl()
}

export const IFlowPlugin = async (input: PluginInput): Promise<Hooks> => {
  const config = loadConfig()
  const showToast = (message: string, variant: "info" | "warning" | "success" | "error") => {
    input.client.tui.showToast({ body: { message, variant } }).catch(() => {})
  }

  try { await ensureProxyStarted(config.enable_log_api_request) } catch (e) { log('Proxy error:', e) }

  return {
    auth: {
      provider: "iflow",
      loader: async (getAuth: () => Promise<any>, provider: any) => {
        await ensureProxyStarted(config.enable_log_api_request)
        const am = await AccountManager.loadFromDisk(config.account_selection_strategy)
        const account = am.getCurrentOrNext()
        
        if (account?.apiKey) {
          try { modelCache = await getModels(account.apiKey) } catch (e) { log('Model load error:', e) }
        }

        registerAllModels(provider, modelCache, true)
        const proxy = getProxyInstance()
        
        if (!proxy.isCLIAvailable()) showToast('iflow CLI missing. GLM-5 disabled.', 'warning')
        else if (!proxy.isCLILoggedIn()) showToast('iflow CLI not logged in. GLM-5 disabled.', 'warning')

        if (am.getAccountCount() === 0) {
          if (proxy.isCLIAvailable() && proxy.isCLILoggedIn()) return { apiKey: 'cli-auth', baseURL: proxy.getBaseUrl() }
          return {}
        }

        const firstAccount = am.getCurrentOrNext()
        if (!firstAccount) return {}

        return { apiKey: firstAccount.apiKey, baseURL: proxy.getBaseUrl() }
      },
      methods: [
        { label: "iFlow OAuth 2.0", type: "oauth", authorize: () => IFlowOAuthHandler.authorize(config, showToast) },
        { label: "iFlow API Key", type: "api", authorize: () => IFlowApiKeyHandler.authorize(config) },
      ],
    },
    "chat.headers": async (input: any, output: { headers: Record<string, string> }) => {
      output.headers["User-Agent"] = `${IFLOW_CONSTANTS.USER_AGENT}/2.0`
    },
  }
}

export const IFlowProxyPlugin = IFlowPlugin
export type { IFlowConfig } from './plugin/config/index.js'
export type { IFlowAuthMethod, ManagedAccount } from './plugin/types.js'
export type { ModelCache, IFlowModelInfo } from './iflow/models.js'

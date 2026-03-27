import { authorizeIFlowOAuth, exchangeOAuthCode } from "../../iflow/oauth.js"
import { isHeadlessEnvironment } from "../headless.js"
import { startOAuthServer } from "../server.js"
import { openBrowser } from "../utils/browser.js"
import { parseCallbackInput } from "./utils.js"
import { AccountManager, generateAccountId } from "../accounts.js"
import { refreshModelsCache } from "../../iflow/models.js"
import type { ManagedAccount } from "../types.js"
import type { IFlowConfig } from "../config/index.js"

export class IFlowOAuthHandler {
  static async authorize(config: IFlowConfig, showToast: any): Promise<any> {
    return new Promise(async (resolve) => {
      try {
        const authData = await authorizeIFlowOAuth(config.auth_server_port_start)
        const headless = isHeadlessEnvironment()
        
        if (headless) {
          resolve({
            url: authData.authUrl,
            instructions: `Headless mode: Open this URL in your browser:\n${authData.authUrl}\n\nAfter authorization, paste the callback URL or code here.`,
            method: "code",
            callback: async (codeInput: string) => {
              try {
                const code = parseCallbackInput(codeInput)
                const res = await exchangeOAuthCode(code, authData.redirectUri)
                const am = await AccountManager.loadFromDisk(config.account_selection_strategy)
                const acc: ManagedAccount = {
                  id: generateAccountId(),
                  email: res.email,
                  authMethod: "oauth",
                  refreshToken: res.refreshToken,
                  accessToken: res.accessToken,
                  expiresAt: res.expiresAt,
                  apiKey: res.apiKey,
                  rateLimitResetTime: 0,
                  isHealthy: true,
                }
                am.addAccount(acc)
                await am.saveToDisk()
                try { await refreshModelsCache(res.apiKey) } catch {}
                showToast(`Successfully logged in as ${res.email}`, "success")
                return { type: "success" as const, key: res.apiKey }
              } catch (e: any) {
                showToast(`Login failed: ${e.message}`, "error")
                return { type: "failed" as const }
              }
            },
          })
        } else {
          const { url, waitForAuth } = await startOAuthServer(
            authData.authUrl,
            authData.state,
            authData.redirectUri,
            config.auth_server_port_start,
            config.auth_server_port_range,
          )
          openBrowser(url)
          resolve({
            url,
            instructions: `Open this URL to continue: ${url}`,
            method: "auto",
            callback: async () => {
              try {
                const res = await waitForAuth()
                const am = await AccountManager.loadFromDisk(config.account_selection_strategy)
                const acc: ManagedAccount = {
                  id: generateAccountId(),
                  email: res.email,
                  authMethod: "oauth",
                  refreshToken: res.refreshToken,
                  accessToken: res.accessToken,
                  expiresAt: res.expiresAt,
                  apiKey: res.apiKey,
                  rateLimitResetTime: 0,
                  isHealthy: true,
                }
                am.addAccount(acc)
                await am.saveToDisk()
                try { await refreshModelsCache(res.apiKey) } catch {}
                showToast(`Successfully logged in as ${res.email}`, "success")
                return { type: "success" as const, key: res.apiKey }
              } catch (e: any) {
                showToast(`Login failed: ${e.message}`, "error")
                return { type: "failed" as const }
              }
            },
          })
        }
      } catch (e: any) {
        resolve({
          url: "",
          instructions: "Authorization failed",
          method: "auto",
          callback: async () => ({ type: "failed" as const }),
        })
      }
    })
  }
}

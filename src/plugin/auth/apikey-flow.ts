import { validateApiKey } from "../../iflow/apikey.js"
import { promptApiKey, promptEmail } from "../cli.js"
import { AccountManager, generateAccountId } from "../accounts.js"
import { refreshModelsCache } from "../../iflow/models.js"
import type { ManagedAccount } from "../types.js"
import type { IFlowConfig } from "../config/index.js"

export class IFlowApiKeyHandler {
  static async authorize(config: IFlowConfig): Promise<any> {
    const apiKey = await promptApiKey()
    if (!apiKey) return { type: "failed" as const }

    try {
      await validateApiKey(apiKey)
      const email = await promptEmail()
      const am = await AccountManager.loadFromDisk(config.account_selection_strategy)
      const acc: ManagedAccount = {
        id: generateAccountId(),
        email,
        authMethod: "apikey",
        apiKey,
        rateLimitResetTime: 0,
        isHealthy: true,
      }
      am.addAccount(acc)
      await am.saveToDisk()
      try { await refreshModelsCache(apiKey) } catch {}
      return { type: "success" as const, key: apiKey }
    } catch (error: any) {
      return { type: "failed" as const }
    }
  }
}

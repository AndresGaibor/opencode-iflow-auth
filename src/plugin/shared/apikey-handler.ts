/**
 * Shared API Key authorization handler for iFlow plugins
 */

import { validateApiKey } from '../../iflow/apikey.js'
import { promptApiKey, promptEmail } from '../cli.js'
import { AccountManager, generateAccountId } from '../accounts/manager.js'
import { refreshModelsCache } from '../../iflow/models/cache.js'
import { fetchModelsFromAPI } from '../../iflow/models/api.js'
import type { ManagedAccount } from '../types.js'
import type { IFlowConfig } from '../config/index.js'

/**
 * Handle API Key authorization flow
 */
export class IFlowApiKeyHandler {
  static async authorize(
    config: IFlowConfig
  ): Promise<any> {
    const apiKey = await promptApiKey()
    if (!apiKey) {
      return { type: 'failed' as const }
    }

    try {
      const result = await validateApiKey(apiKey)
      const am = await AccountManager.loadFromDisk(config.account_selection_strategy)
      const acc: ManagedAccount = {
        id: generateAccountId(),
        email: result.email,
        authMethod: 'apikey',
        apiKey,
        rateLimitResetTime: 0,
        isHealthy: true,
      }
      am.addAccount(acc)
      await am.saveToDisk()
      try { await refreshModelsCache(apiKey, fetchModelsFromAPI) } catch {}
      return { type: 'success' as const, key: apiKey }
    } catch (error: any) {
      return { type: 'failed' as const }
    }
  }
}

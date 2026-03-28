/**
 * Model registration utilities for OpenCode provider
 * Handles registering iFlow models with the provider system
 */

import {
  API_BASE_URL,
  buildProxyUrl,
  IFLOW_MODELS,
  requiresCLI
} from '../constants/index.js'
import {
  getAllAvailableModels,
  inferModelConfig,
  type ModelCache,
  type MergedModelConfig
} from '../iflow/models.js'

/**
 * Convert model config to provider model format
 * @param modelConfig - The model configuration
 * @param useProxy - Whether to use proxy URL
 * @returns Provider-compatible model configuration
 */
function modelConfigToProviderModel(modelConfig: IFlowModelConfig, useProxy: boolean): any {
  const needsCLI = modelConfig.requiresCLI || requiresCLI(modelConfig.id)
  const baseUrl = (useProxy && needsCLI) ? buildProxyUrl() : API_BASE_URL

  return {
    id: modelConfig.id,
    providerID: useProxy ? 'iflow-proxy' : 'iflow',
    api: {
      id: modelConfig.id,
      url: baseUrl,
      npm: '@ai-sdk/openai-compatible'
    },
    name: modelConfig.name,
    family: modelConfig.family || modelConfig.id.split('-')[0],
    capabilities: {
      temperature: modelConfig.temperature ?? true,
      reasoning: modelConfig.reasoning ?? false,
      attachment: modelConfig.inputModalities.includes('image'),
      toolcall: modelConfig.toolcall ?? false,
      input: {
        text: modelConfig.inputModalities.includes('text'),
        audio: modelConfig.inputModalities.includes('audio'),
        image: modelConfig.inputModalities.includes('image'),
        video: modelConfig.inputModalities.includes('video'),
        pdf: modelConfig.inputModalities.includes('pdf')
      },
      output: {
        text: modelConfig.outputModalities.includes('text'),
        audio: modelConfig.outputModalities.includes('audio'),
        image: modelConfig.outputModalities.includes('image'),
        video: modelConfig.outputModalities.includes('video'),
        pdf: modelConfig.outputModalities.includes('pdf')
      },
      interleaved: modelConfig.reasoning ?? false
    },
    cost: {
      input: 0,
      output: 0,
      cache: { read: 0, write: 0 }
    },
    limit: {
      context: modelConfig.context,
      output: modelConfig.output
    },
    status: 'active',
    options: {},
    headers: {},
    release_date: '2025-01-01',
    variants: modelConfig.variants || {}
  }
}

export interface IFlowModelConfig {
  id: string
  name: string
  context: number
  output: number
  inputModalities: ('text' | 'image' | 'audio' | 'video' | 'pdf')[]
  outputModalities: ('text' | 'image' | 'audio' | 'video' | 'pdf')[]
  reasoning?: boolean
  toolcall?: boolean
  temperature?: boolean
  family?: string
  variants?: Record<string, Record<string, any>>
  requiresCLI?: boolean
}

/**
 * Register static iFlow models with provider
 * @param provider - OpenCode provider instance
 */
export function registerIFlowModels(provider: any): void {
  for (const modelConfig of IFLOW_MODELS) {
    if (!provider.models[modelConfig.id]) {
      provider.models[modelConfig.id] = modelConfigToProviderModel(modelConfig, false)
    }
  }
}

/**
 * Register dynamic models from API cache
 * @param provider - OpenCode provider instance
 * @param modelCache - Model cache from API
 * @param useProxy - Whether to use proxy URL
 */
export function registerDynamicModels(
  provider: any,
  modelCache: ModelCache | null,
  useProxy: boolean = false
): void {
  if (modelCache && modelCache.models.length > 0) {
    const allModelIds = getAllAvailableModels(modelCache)

    for (const modelId of allModelIds) {
      if (!provider.models[modelId]) {
        const staticConfig = IFLOW_MODELS.find((m: IFlowModelConfig) => m.id === modelId)

        if (staticConfig) {
          provider.models[modelId] = modelConfigToProviderModel(staticConfig, useProxy)
        } else {
          const inferredConfig = inferModelConfig(modelId)
          const config: IFlowModelConfig = {
            id: inferredConfig.id,
            name: inferredConfig.name,
            context: inferredConfig.context,
            output: inferredConfig.output,
            inputModalities: inferredConfig.inputModalities,
            outputModalities: inferredConfig.outputModalities,
            reasoning: inferredConfig.reasoning,
            toolcall: inferredConfig.toolcall,
            temperature: inferredConfig.temperature,
            family: inferredConfig.family,
            requiresCLI: inferredConfig.requiresCLI
          }
          provider.models[modelId] = modelConfigToProviderModel(config, useProxy)
        }
      }
    }
  } else {
    for (const modelConfig of IFLOW_MODELS) {
      if (!provider.models[modelConfig.id]) {
        provider.models[modelConfig.id] = modelConfigToProviderModel(modelConfig, useProxy)
      }
    }
  }
}

/**
 * Register all models (static + dynamic)
 * @param provider - OpenCode provider instance
 * @param modelCache - Optional model cache from API
 * @param useProxy - Whether to use proxy URL
 */
export function registerAllModels(
  provider: any,
  modelCache: ModelCache | null = null,
  useProxy: boolean = false
): void {
  registerDynamicModels(provider, modelCache, useProxy)
}

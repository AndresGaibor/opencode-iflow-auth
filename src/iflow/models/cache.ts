/**
 * Model cache management
 * Handles loading, saving, and managing model cache from iFlow API
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { IFlowModelInfo } from './types.js'
import type { ModelCache } from '../../types/cache.js'
import { getModelsCachePath } from '../../constants/paths.js'
import { MODEL_CACHE_TTL_MS } from '../../constants/limits.js'
import { CLI_EXCLUSIVE_MODELS } from '../../constants/models.js'

/**
 * Default model cache (when API is unavailable)
 */
const DEFAULT_MODELS_CACHE: ModelCache = {
  version: 1,
  lastUpdated: 0,
  models: [],
  cliModels: [...CLI_EXCLUSIVE_MODELS] as string[]
}

/**
 * Load cache from file
 * @returns The loaded cache or default cache if not found
 */
export function loadCacheFromFile(): ModelCache {
  const path = getModelsCachePath()
  try {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf-8')
      const cache = JSON.parse(content) as ModelCache
      if (cache.version === 1 && Array.isArray(cache.models)) {
        return cache
      }
    }
  } catch (error) {
    // Ignore error, return default cache
  }
  return { ...DEFAULT_MODELS_CACHE }
}

/**
 * Save cache to file
 * @param cache - The cache to save
 */
export function saveCacheToFile(cache: ModelCache): void {
  const path = getModelsCachePath()
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(cache, null, 2), 'utf-8')
  } catch (error) {
    console.error('[iflow-models] Failed to save cache:', error)
  }
}

/**
 * Get models with caching
 * @param apiKey - API key for authentication
 * @param forceRefresh - Force refresh even if cache is valid
 * @param fetchModelsFn - Function to fetch models from API
 * @returns The model cache
 */
export async function getModels(
  apiKey: string,
  forceRefresh = false,
  fetchModelsFn: (apiKey: string) => Promise<IFlowModelInfo[]>
): Promise<ModelCache> {
  const cache = loadCacheFromFile()
  const now = Date.now()

  // If cache is valid and not forced to refresh, return cached data
  if (!forceRefresh && cache.models.length > 0 && (now - cache.lastUpdated) < MODEL_CACHE_TTL_MS) {
    return cache
  }

  try {
    const models = await fetchModelsFn(apiKey)

    const newCache: ModelCache = {
      version: 1,
      lastUpdated: now,
      models,
      cliModels: [...CLI_EXCLUSIVE_MODELS] as string[]
    }

    saveCacheToFile(newCache)
    return newCache
  } catch (error) {
    console.error('[iflow-models] Failed to fetch models, using cache:', error)
    // Return old cache or default cache
    return cache.models.length > 0 ? cache : DEFAULT_MODELS_CACHE
  }
}

/**
 * Refresh model cache
 * @param apiKey - API key for authentication
 * @param fetchModelsFn - Function to fetch models from API
 * @returns The refreshed model cache
 */
export async function refreshModelsCache(
  apiKey: string,
  fetchModelsFn: (apiKey: string) => Promise<IFlowModelInfo[]>
): Promise<ModelCache> {
  return getModels(apiKey, true, fetchModelsFn)
}

/**
 * Get all available models (API + CLI exclusive)
 * @param cache - The model cache
 * @returns Array of all model IDs
 */
export function getAllAvailableModels(cache: ModelCache): string[] {
  const apiModels = cache.models.map(m => m.id)
  const allModels = new Set([...apiModels, ...CLI_EXCLUSIVE_MODELS])
  return Array.from(allModels)
}

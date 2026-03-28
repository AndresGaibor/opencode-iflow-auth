/**
 * Model API operations
 * Handles fetching models from iFlow API
 */

import type { IFlowModelInfo } from './types.js'
import { API_BASE_URL, USER_AGENT } from '../../constants/api.js'

/**
 * Fetch models from iFlow API
 * @param apiKey - API key for authentication
 * @returns Array of model information
 */
export async function fetchModelsFromAPI(apiKey: string): Promise<IFlowModelInfo[]> {
  const response = await fetch(`${API_BASE_URL}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': USER_AGENT
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`)
  }

  const data = await response.json()

  // OpenAI compatible format: { object: 'list', data: [...] }
  if (data.object === 'list' && Array.isArray(data.data)) {
    return data.data as IFlowModelInfo[]
  }

  // Direct array format
  if (Array.isArray(data)) {
    return data as IFlowModelInfo[]
  }

  return []
}

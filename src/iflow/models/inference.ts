/**
 * Model configuration inference
 * Infers model capabilities and configuration from model ID
 */

import type { MergedModelConfig } from './types.js'
import { isThinkingModel as checkIsThinkingModel } from '../../constants/thinking.js'
import { requiresCLI as checkRequiresCLI } from '../../constants/models.js'

/**
 * Infer model family from model ID
 * @param modelId - The model identifier
 * @returns The inferred family name
 */
export function inferFamily(modelId: string): string {
  if (modelId.startsWith('glm')) return 'glm'
  if (modelId.startsWith('deepseek-r')) return 'deepseek-r'
  if (modelId.startsWith('deepseek')) return 'deepseek'
  if (modelId.startsWith('qwen3-coder')) return 'qwen3-coder'
  if (modelId.startsWith('qwen3-vl')) return 'qwen3-vl'
  if (modelId.startsWith('qwen3')) return 'qwen3'
  if (modelId.startsWith('kimi')) return 'kimi'
  if (modelId.startsWith('iflow')) return 'iflow'
  return modelId.split('-')[0] || 'unknown'
}

/**
 * Infer model name from model ID
 * @param modelId - The model identifier
 * @returns The inferred display name
 */
export function inferModelName(modelId: string): string {
  const nameMap: Record<string, string> = {
    'glm-5': 'GLM-5',
    'glm-5-free': 'GLM-5 Free',
    'glm-5-thinking': 'GLM-5 Thinking',
    'glm-4.6': 'GLM-4.6',
    'glm-4.7': 'GLM-4.7',
    'deepseek-v3': 'DeepSeek V3',
    'deepseek-v3.2': 'DeepSeek V3.2',
    'deepseek-r1': 'DeepSeek R1',
    'qwen3-max': 'Qwen3 Max',
    'qwen3-coder-plus': 'Qwen3 Coder Plus',
    'kimi-k2': 'Kimi K2',
  }
  return nameMap[modelId] || modelId.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

/**
 * Infer context length from model ID
 * @param modelId - The model identifier
 * @returns The inferred context length in tokens
 */
export function inferContextLength(modelId: string): number {
  if (modelId.includes('coder-plus')) return 1000000
  if (modelId.startsWith('glm-5') || modelId.includes('235b')) return 256000
  if (modelId.startsWith('glm-4.7') || modelId.includes('kimi-k2-0905')) return 256000
  if (modelId.startsWith('glm-4.6')) return 200000
  if (modelId.startsWith('qwen3') || modelId.startsWith('kimi')) return 256000
  return 128000
}

/**
 * Infer output length from model ID
 * @param modelId - The model identifier
 * @returns The inferred output length in tokens
 */
export function inferOutputLength(modelId: string): number {
  if (modelId.includes('coder-plus')) return 64000
  if (modelId.startsWith('glm-4.6')) return 128000
  if (modelId.includes('v3.2') || modelId.includes('kimi')) return 64000
  return 32000
}

/**
 * Infer model configuration from model ID
 * @param modelId - The model identifier
 * @returns The inferred model configuration
 */
export function inferModelConfig(modelId: string): MergedModelConfig {
  const needsCLI = checkRequiresCLI(modelId)
  const isThinking = checkIsThinkingModel(modelId)

  // Infer capabilities from model name
  const hasVision = /vl|vision|glm-4\.6|glm-4\.7|glm-5(?!-thinking|-free)/.test(modelId)
  const hasToolCall = !/vl|vision/.test(modelId)
  const family = inferFamily(modelId)

  // Infer context and output lengths
  const context = inferContextLength(modelId)
  const output = inferOutputLength(modelId)

  return {
    id: modelId,
    name: inferModelName(modelId),
    context,
    output,
    inputModalities: hasVision ? ['text', 'image'] : ['text'],
    outputModalities: ['text'],
    reasoning: isThinking,
    toolcall: hasToolCall,
    temperature: true,
    family,
    requiresCLI: needsCLI,
    source: needsCLI ? 'cli' : 'api'
  }
}

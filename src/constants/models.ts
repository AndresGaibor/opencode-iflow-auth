/**
 * Static model configurations for iFlow models
 * Used as fallback when API model discovery is unavailable
 */

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
 * CLI-exclusive models (only available through iflow CLI proxy)
 */
export const CLI_EXCLUSIVE_MODELS = ['glm-5', 'glm-5-free', 'glm-5-thinking'] as const

/**
 * Patterns to identify models that require CLI proxy
 */
export const CLI_REQUIRED_PATTERNS = [/^glm-5/]

/**
 * Static model definitions
 */
export const IFLOW_MODELS: IFlowModelConfig[] = [
  // GLM-5 family (CLI exclusive)
  {
    id: 'glm-5',
    name: 'GLM-5',
    context: 256000,
    output: 64000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    reasoning: true,
    toolcall: true,
    family: 'glm',
    requiresCLI: true,
    variants: {
      low: { thinkingConfig: { thinkingBudget: 1024 } },
      medium: { thinkingConfig: { thinkingBudget: 8192 } },
      max: { thinkingConfig: { thinkingBudget: 32768 } }
    }
  },
  {
    id: 'glm-5-free',
    name: 'GLM-5 Free',
    context: 256000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    reasoning: true,
    toolcall: true,
    family: 'glm',
    requiresCLI: true,
    variants: {
      low: { thinkingConfig: { thinkingBudget: 1024 } },
      medium: { thinkingConfig: { thinkingBudget: 8192 } },
      max: { thinkingConfig: { thinkingBudget: 32768 } }
    }
  },
  {
    id: 'glm-5-thinking',
    name: 'GLM-5 Thinking',
    context: 256000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    reasoning: true,
    toolcall: true,
    family: 'glm',
    requiresCLI: true,
    variants: {
      low: { thinkingConfig: { thinkingBudget: 1024 } },
      medium: { thinkingConfig: { thinkingBudget: 8192 } },
      max: { thinkingConfig: { thinkingBudget: 32768 } }
    }
  },
  // GLM-4 family
  {
    id: 'glm-4.6',
    name: 'GLM-4.6 Thinking',
    context: 200000,
    output: 128000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    reasoning: true,
    toolcall: true,
    family: 'glm',
    variants: {
      low: { thinkingConfig: { thinkingBudget: 1024 } },
      medium: { thinkingConfig: { thinkingBudget: 8192 } },
      max: { thinkingConfig: { thinkingBudget: 32768 } }
    }
  },
  // Qwen3 family
  {
    id: 'qwen3-max',
    name: 'Qwen3 Max',
    context: 256000,
    output: 32000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'qwen3'
  },
  {
    id: 'qwen3-max-preview',
    name: 'Qwen3 Max Preview',
    context: 256000,
    output: 32000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'qwen3'
  },
  {
    id: 'qwen3-coder-plus',
    name: 'Qwen3 Coder Plus',
    context: 1000000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'qwen3-coder'
  },
  {
    id: 'qwen3-vl-plus',
    name: 'Qwen3 VL Plus',
    context: 256000,
    output: 32000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    family: 'qwen3-vl'
  },
  {
    id: 'qwen3-32b',
    name: 'Qwen3 32B',
    context: 128000,
    output: 32000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'qwen3'
  },
  {
    id: 'qwen3-235b',
    name: 'Qwen3 235B',
    context: 256000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'qwen3'
  },
  {
    id: 'qwen3-235b-a22b-thinking-2507',
    name: 'Qwen3 235B Thinking',
    context: 256000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    reasoning: true,
    toolcall: true,
    family: 'qwen3-thinking',
    variants: {
      low: { thinkingConfig: { thinkingBudget: 1024 } },
      medium: { thinkingConfig: { thinkingBudget: 8192 } },
      max: { thinkingConfig: { thinkingBudget: 32768 } }
    }
  },
  {
    id: 'qwen3-235b-a22b-instruct',
    name: 'Qwen3 235B Instruct',
    context: 256000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'qwen3'
  },
  // Kimi family
  {
    id: 'kimi-k2',
    name: 'Kimi K2',
    context: 128000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'kimi'
  },
  {
    id: 'kimi-k2-0905',
    name: 'Kimi K2 0905',
    context: 256000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'kimi'
  },
  // DeepSeek family
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    context: 128000,
    output: 32000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'deepseek'
  },
  {
    id: 'deepseek-v3.2',
    name: 'DeepSeek V3.2',
    context: 128000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    toolcall: true,
    family: 'deepseek'
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    context: 128000,
    output: 32000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    reasoning: true,
    toolcall: true,
    family: 'deepseek-r',
    variants: {
      low: { thinkingConfig: { thinkingBudget: 1024 } },
      medium: { thinkingConfig: { thinkingBudget: 8192 } },
      max: { thinkingConfig: { thinkingBudget: 32768 } }
    }
  },
  // iFlow ROME
  {
    id: 'iflow-rome-30ba3b',
    name: 'iFlow ROME 30B',
    context: 256000,
    output: 64000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    family: 'iflow-rome'
  }
]

/**
 * Check if a model requires CLI proxy
 * @param modelId - The model identifier to check
 * @returns true if the model requires CLI
 */
export function requiresCLI(modelId: string): boolean {
  return CLI_REQUIRED_PATTERNS.some(pattern => pattern.test(modelId))
}

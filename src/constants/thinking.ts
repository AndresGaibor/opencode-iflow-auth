/**
 * Thinking model configuration and detection logic
 */

/**
 * Patterns to identify thinking models
 * These models support thinking/reasoning capabilities
 */
export const THINKING_MODEL_PATTERNS = [
  /^glm-5/,
  /^glm-4\.7/,
  /^glm-4\.6/,
  /^glm-4/,
  /deepseek/,
  /thinking/,
  /reasoning/,
  /^kimi-k2\.5/,
  /^o1-/
]

/**
 * Check if a model ID matches the thinking model pattern
 * @param modelId - The model identifier to check
 * @returns true if the model supports thinking mode
 */
export function isThinkingModel(modelId: string): boolean {
  return THINKING_MODEL_PATTERNS.some(pattern => pattern.test(modelId))
}

/**
 * Apply thinking configuration to request body based on model type
 * @param body - Original request body
 * @param model - Model ID
 * @returns Modified request body with thinking configuration
 */
export function applyThinkingConfig(body: any, model: string): any {
  const thinkingBudget = body.providerOptions?.thinkingConfig?.thinkingBudget
  const isThinkingEnabled = body.providerOptions?.thinkingConfig?.enabled !== false

  // GLM-5 family thinking configuration
  if (model.startsWith('glm-5')) {
    const result: any = {
      ...body,
      temperature: 1,
      top_p: 0.95,
    }

    if (isThinkingEnabled) {
      result.chat_template_kwargs = { enable_thinking: true }
      result.enable_thinking = true
      result.thinking = { type: 'enabled' }
      if (thinkingBudget) {
        result.thinking_budget = thinkingBudget
      }
    } else {
      result.chat_template_kwargs = { enable_thinking: false }
      result.enable_thinking = false
      result.thinking = { type: 'disabled' }
    }

    return result
  }

  // GLM-4 family thinking configuration
  if (model.startsWith('glm-4')) {
    const result: any = {
      ...body,
      chat_template_kwargs: {
        enable_thinking: true,
        clear_thinking: false
      }
    }
    if (thinkingBudget) {
      result.thinking_budget = thinkingBudget
    }
    return result
  }

  // DeepSeek R1 thinking configuration
  if (model.startsWith('deepseek-r1')) {
    const result: any = { ...body }
    if (thinkingBudget) {
      result.thinking_budget = thinkingBudget
    }
    return result
  }

  // No thinking configuration needed
  return body
}

/**
 * Default thinking budget values for variants
 */
export const THINKING_BUDGET_VARIANTS = {
  low: 1024,
  medium: 8192,
  max: 32768
} as const

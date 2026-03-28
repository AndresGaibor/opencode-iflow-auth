/**
 * Model-related type definitions
 */

/**
 * iFlow model information interface
 */
export interface IFlowModelInfo {
  id: string
  object: string
  created: number
  owned_by: string
  permission?: any[]
  root?: string
  parent?: string
}

/**
 * Merged model configuration interface
 * Combines API model info with inferred capabilities
 */
export interface MergedModelConfig {
  id: string
  name: string
  context: number
  output: number
  inputModalities: ('text' | 'image' | 'audio' | 'video' | 'pdf')[]
  outputModalities: ('text' | 'image' | 'audio' | 'video' | 'pdf')[]
  reasoning: boolean
  toolcall: boolean
  temperature: boolean
  family: string
  requiresCLI: boolean
  source: 'api' | 'cli' | 'static'
}

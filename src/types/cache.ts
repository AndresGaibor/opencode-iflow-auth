/**
 * Cache-related type definitions
 */

import type { IFlowModelInfo } from '../iflow/models/types.js'

/**
 * Model cache interface
 */
export interface ModelCache {
  version: 1
  lastUpdated: number
  models: IFlowModelInfo[]
  cliModels: string[]
}

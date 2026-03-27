import { randomUUID } from 'crypto'
import { log } from './utils.js'

export class StreamParser {
  private buffer: string = ''
  private inThought: boolean
  private toolCallIndex: number = 0

  constructor(initialThought: boolean = false) {
    this.inThought = initialThought
  }

  processToken(chunk: string, onChunk: (content: string, done: boolean, isReasoning?: boolean, toolCall?: any) => void) {
    this.buffer += chunk
    
    if (this.inThought) {
      if (this.buffer.includes('</thought>') || this.buffer.includes('$ ') || this.buffer.includes('→ ')) {
         if (this.buffer.includes('$ ') || this.buffer.includes('→ ')) {
           this.inThought = false
         }
      }
      
      if (this.buffer.includes('</thought>')) {
        const parts = this.buffer.split('</thought>')
        if (parts[0]) onChunk(parts[0], false, true)
        this.inThought = false
        this.buffer = parts[1] || ''
        return
      }
    }

    onChunk(chunk, false, this.inThought)
    
    if (this.buffer.length > 100) {
      this.buffer = this.buffer.substring(this.buffer.length - 50)
    }
  }

  isInThought(): boolean {
    return this.inThought
  }
}

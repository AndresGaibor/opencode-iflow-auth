/**
 * FakeIFlowClient - Mock implementation of IFlowClient for testing.
 */

export type FakeIFlowEvent =
  | { kind: 'thinking'; text: string }
  | { kind: 'content'; text: string }
  | { kind: 'tool_call'; name: string; args: Record<string, any> }
  | { kind: 'permission_request'; payload: any }
  | { kind: 'ask_user'; questions: any[] }
  | { kind: 'done' }
  | { kind: 'error'; message: string }
  | { kind: 'raw'; message: any }

export interface FakeIFlowClientOptions {
  /** Script of events to emit for each turn */
  scripts: FakeIFlowEvent[][]
  /** Whether to auto-connect */
  autoConnect?: boolean
}

/**
 * A fake IFlowClient that can be scripted to emit specific events.
 */
export class FakeIFlowClient {
  private connected = false
  private scripts: FakeIFlowEvent[][]
  private currentScriptIndex = 0
  private messagesSent: string[] = []
  private _config: Record<string, any> = {}

  constructor(options: FakeIFlowClientOptions) {
    this.scripts = options.scripts || []
    if (options.autoConnect !== false) {
      this.connected = true
    }
  }

  // IFlowClient interface implementation

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  async sendMessage(message: string): Promise<void> {
    this.messagesSent.push(message)
  }

  async *receiveMessages(): AsyncGenerator<any> {
    const script = this.scripts[this.currentScriptIndex] || []
    this.currentScriptIndex++

    for (const event of script) {
      yield this.convertEventToMessage(event)
    }
  }

  get config() {
    return {
      set: async (key: string, value: any) => {
        this._config[key] = value
      },
      get: (key: string) => this._config[key],
    }
  }

  async respondToAskUserQuestions(answers: Record<string, string>): Promise<void> {
    // No-op in fake
  }

  async respondToExitPlanMode(approved: boolean): Promise<void> {
    // No-op in fake
  }

  async respondToToolConfirmation(requestId: string, optionId: string): Promise<void> {
    // No-op in fake
  }

  // Test helpers
  
  getMessagesSent(): string[] {
    return [...this.messagesSent]
  }

  getLastMessage(): string | undefined {
    return this.messagesSent[this.messagesSent.length - 1]
  }

  reset(): void {
    this.messagesSent = []
    this.currentScriptIndex = 0
  }

  addScript(script: FakeIFlowEvent[]): void {
    this.scripts.push(script)
  }

  // Private
  
  private convertEventToMessage(event: FakeIFlowEvent): any {
    switch (event.kind) {
      case 'thinking':
        return {
          type: 'thinking',
          chunk: { thought: event.text },
        }
      
      case 'content':
        return {
          type: 'content',
          chunk: { text: event.text },
        }
      
      case 'tool_call':
        return {
          type: 'tool_call',
          toolName: event.name,
          args: event.args,
        }
      
      case 'permission_request':
        return {
          type: 'PERMISSION_REQUEST',
          ...event.payload,
        }
      
      case 'ask_user':
        return {
          type: 'ASK_USER_QUESTIONS',
          questions: event.questions,
        }
      
      case 'done':
        return {
          type: 'TASK_FINISH',
        }
      
      case 'error':
        return {
          type: 'ERROR',
          message: event.message,
        }
      
      case 'raw':
        return event.message
    }
  }
}

/**
 * Creates a FakeIFlowClient with a simple script.
 */
export function createFakeClient(events: FakeIFlowEvent[]): FakeIFlowClient {
  return new FakeIFlowClient({ scripts: [events] })
}

/**
 * Creates a FakeIFlowClient for a repo review scenario.
 */
export function createRepoReviewFakeClient(): FakeIFlowClient {
  return new FakeIFlowClient({
    scripts: [
      // First turn: list, read, then summarize
      [
        { kind: 'thinking', text: 'Exploring the repository structure...' },
        { kind: 'tool_call', name: 'list_directory', args: { directory: '.' } },
      ],
      // Second turn: after tool result
      [
        { kind: 'thinking', text: 'Reading key files...' },
        { kind: 'tool_call', name: 'read_text_file', args: { filePath: 'README.md' } },
      ],
      // Third turn: final response
      [
        { kind: 'content', text: 'This is a Node.js project that provides authentication for iFlow CLI.' },
        { kind: 'done' },
      ],
    ],
  })
}

/**
 * Creates a FakeIFlowClient for a simple read scenario.
 */
export function createReadFakeClient(): FakeIFlowClient {
  return new FakeIFlowClient({
    scripts: [
      [
        { kind: 'tool_call', name: 'read_text_file', args: { filePath: 'README.md' } },
      ],
      [
        { kind: 'content', text: 'The README contains documentation for the project.' },
        { kind: 'done' },
      ],
    ],
  })
}

/**
 * Creates a FakeIFlowClient for an edit scenario.
 */
export function createEditFakeClient(): FakeIFlowClient {
  return new FakeIFlowClient({
    scripts: [
      [
        { kind: 'thinking', text: 'Preparing to edit the file...' },
        { kind: 'tool_call', name: 'edit_file', args: { 
          filePath: 'src/index.ts', 
          oldString: 'foo', 
          newString: 'bar' 
        }},
      ],
      [
        { kind: 'content', text: 'File has been updated successfully.' },
        { kind: 'done' },
      ],
    ],
  })
}

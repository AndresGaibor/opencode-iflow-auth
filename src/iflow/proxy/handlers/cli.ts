import { spawn, ChildProcess } from 'child_process'
import { log, buildPrompt } from '../utils.js'
import { isThinkingModel } from '../../models.js'
import { StreamParser } from '../stream-parser.js'
import type { ChatCompletionRequest } from '../types.js'

export async function callIFlowCLI(request: ChatCompletionRequest): Promise<{ content: string; promptTokens?: number; completionTokens?: number }> {
  return new Promise((resolve, reject) => {
    const prompt = buildPrompt(request.messages)
    
    const args = [
      '-m', request.model,
      '--no-stream'
    ]

    log(`Calling iflow with stdin, prompt length: ${prompt.length}`)

    const iflow: ChildProcess = spawn('iflow', args, {
      shell: true,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    })

    let stdout = ''
    let stderr = ''

    iflow.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    iflow.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    iflow.on('error', (err) => {
      log('Failed to start iflow:', err)
      reject(new Error(`Failed to start iflow: ${err.message}`))
    })

    iflow.on('close', (code) => {
      if (code !== 0) {
        log('iflow exited with code:', code, stderr)
        reject(new Error(`iflow exited with code ${code}`))
        return
      }

      const content = stdout.trim()
      log('iflow response length:', content.length)
      
      resolve({
        content,
        promptTokens: 1,
        completionTokens: 1
      })
    })

    iflow.stdin?.write(prompt)
    iflow.stdin?.end()
  })
}

export async function callIFlowCLIStream(
  request: ChatCompletionRequest,
  onChunk: (content: string, done: boolean, isReasoning?: boolean, toolCall?: any) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const prompt = buildPrompt(request.messages)
    
    const args = [
      '-m', request.model
    ]

    log(`Calling iflow (stream) with stdin, prompt length: ${prompt.length}`)

    const iflow: ChildProcess = spawn('iflow', args, {
      shell: true,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    })

    let resolved = false
    const parser = new StreamParser(isThinkingModel(request.model))

    iflow.stdout?.on('data', (data) => {
      const chunk = data.toString()
      parser.processToken(chunk, onChunk)
    })

    iflow.stderr?.on('data', (data) => {
      const chunk = data.toString()
      if (chunk.trim()) {
        onChunk(chunk, false, true)
      }
    })

    iflow.on('error', (err) => {
      log('Failed to start iflow:', err)
      if (!resolved) {
        resolved = true
        reject(new Error(`Failed to start iflow: ${err.message}`))
      }
    })

    iflow.on('close', (code) => {
      if (code !== 0 && !resolved) {
        log('iflow exited with code:', code)
        resolved = true
        reject(new Error(`iflow exited with code ${code}`))
        return
      }

      if (!resolved) {
        resolved = true
        onChunk('', true)
        resolve()
      }
    })

    iflow.stdin?.write(prompt)
    iflow.stdin?.end()
  })
}

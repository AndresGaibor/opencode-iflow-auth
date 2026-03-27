import { ServerResponse } from 'http'
import * as logger from '../../../plugin/logger.js'
import type { ChatCompletionRequest } from '../types.js'

export async function handleDirectAPIRequest(
  request: ChatCompletionRequest, 
  res: ServerResponse, 
  isStream: boolean, 
  apiKey: string,
  enableLog: boolean
): Promise<void> {
  try {
    const https = await import('https')
    
    const requestBody = JSON.stringify({
      ...request,
      model: request.model,
    })

    const options = {
      hostname: 'apis.iflow.cn',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        'Authorization': `Bearer ${apiKey}`
      }
    }

    const apiReq = https.request(options, (apiRes) => {
      res.writeHead(apiRes.statusCode || 200, apiRes.headers)
      
      if (isStream) {
        apiRes.on('data', (chunk) => {
          const chunkStr = chunk.toString()
          if (enableLog) {
            const lines = chunkStr.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                  const data = JSON.parse(line.substring(6))
                  const delta = data.choices?.[0]?.delta
                  if (delta) {
                    if (delta.reasoning_content) {
                      logger.log(`[IFlowProxy] [API Chunk] [Reasoning] ${delta.reasoning_content}`)
                    }
                    if (delta.content) {
                      logger.log(`[IFlowProxy] [API Chunk] [Content] ${delta.content}`)
                    }
                    if (delta.tool_calls) {
                      logger.log(`[IFlowProxy] [API Chunk] [Tool Calls] ${JSON.stringify(delta.tool_calls)}`)
                    }
                  }
                } catch {}
              }
            }
          }
          res.write(chunk)
        })
        apiRes.on('end', () => res.end())
      } else {
        apiRes.pipe(res)
      }
    })

    apiReq.on('error', (err) => {
      logger.log('[iflow-proxy] Direct API error:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    })

    apiReq.write(requestBody)
    apiReq.end()
  } catch (error: any) {
    logger.log('[iflow-proxy] Direct API error:', error)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: error.message }))
  }
}

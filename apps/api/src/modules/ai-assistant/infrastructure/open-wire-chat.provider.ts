import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { z } from 'zod'

import type { Env } from '@/app/config/env.schema'
import type {
  AiChatCompletionInput,
  AiChatProvider,
  AiChatProviderCompletion,
  AiChatProviderStreamChunk,
} from '@/modules/ai-assistant/application/ports/ai-chat-provider.port'

const modelsResponseSchema = z.object({
  object: z.literal('list'),
  data: z.array(
    z.object({
      id: z.string(),
    }),
  ),
})

const chatCompletionResponseSchema = z.object({
  model: z.string(),
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable().optional(),
        tool_calls: z.array(
          z.object({
            id: z.string(),
            type: z.literal('function').default('function'),
            function: z.object({
              name: z.string(),
              arguments: z.string(),
            }),
          }),
        ).optional(),
      }),
    }),
  ).min(1),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }).optional(),
})

@Injectable()
export class OpenWireChatProvider implements AiChatProvider {
  private readonly logger = new Logger(OpenWireChatProvider.name)

  constructor(private readonly configService: ConfigService<Env, true>) {}

  async listModels(): Promise<string[]> {
    const response = await this.request('/v1/models', {
      method: 'GET',
    })
    const parsed = modelsResponseSchema.parse(response)
    return parsed.data.map((model) => model.id)
  }

  async createChatCompletion(input: AiChatCompletionInput): Promise<AiChatProviderCompletion> {
    const requestBody = {
      model: input.model,
      messages: input.messages,
      tools: input.tools,
      tool_choice: input.toolChoice,
    }

    this.logger.debug(
      `OpenWire chat completion request: ${this.stringifyForLog(requestBody, 8000)}`,
    )

    const response = await this.request('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    this.logger.debug(
      `OpenWire raw chat completion response: ${this.stringifyForLog(response, 8000)}`,
    )

    const parsed = chatCompletionResponseSchema.parse(response)
    const toolCalls = parsed.choices[0]?.message.tool_calls
    const content = parsed.choices[0]?.message.content?.trim()

    if (!content && (!toolCalls || toolCalls.length === 0)) {
      throw new ServiceUnavailableException('OpenWire returned an empty response')
    }

    return {
      content: content ?? null,
      model: parsed.model,
      toolCalls,
      usage: parsed.usage
        ? {
            promptTokens: parsed.usage.prompt_tokens,
            completionTokens: parsed.usage.completion_tokens,
            totalTokens: parsed.usage.total_tokens,
          }
        : undefined,
    }
  }

  async *createStreamingChatCompletion(input: AiChatCompletionInput): AsyncIterable<AiChatProviderStreamChunk> {
    const requestBody = {
      model: input.model,
      messages: input.messages,
      tools: input.tools,
      tool_choice: input.toolChoice,
      stream: true,
    }

    this.logger.debug(
      `OpenWire streaming request: ${this.stringifyForLog(requestBody, 8000)}`,
    )

    const response = await this.requestRaw('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    const reader = response.body?.getReader()
    if (!reader) {
      throw new ServiceUnavailableException('OpenWire returned no readable stream')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let model = input.model ?? ''
    let usage: AiChatProviderStreamChunk & { type: 'done' } | undefined
    const toolCallBuilders = new Map<number, { id: string; name: string; arguments: string }>()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          let chunk: any
          try {
            chunk = JSON.parse(trimmed.slice(6))
          } catch {
            continue
          }

          if (chunk.model) model = chunk.model

          if (chunk.usage) {
            usage = {
              type: 'done',
              model,
              usage: {
                promptTokens: chunk.usage.prompt_tokens ?? 0,
                completionTokens: chunk.usage.completion_tokens ?? 0,
                totalTokens: chunk.usage.total_tokens ?? 0,
              },
            }
          }

          const delta = chunk.choices?.[0]?.delta
          if (!delta) continue

          if (delta.content) {
            yield { type: 'token', content: delta.content }
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              if (tc.id) {
                toolCallBuilders.set(idx, {
                  id: tc.id,
                  name: tc.function?.name ?? '',
                  arguments: tc.function?.arguments ?? '',
                })
                yield {
                  type: 'tool-call-start',
                  toolCall: { id: tc.id, name: tc.function?.name ?? '' },
                }
              } else {
                const builder = toolCallBuilders.get(idx)
                if (builder && tc.function?.arguments) {
                  builder.arguments += tc.function.arguments
                  yield {
                    type: 'tool-call-args',
                    toolCallId: builder.id,
                    argumentsDelta: tc.function.arguments,
                  }
                }
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    yield usage ?? { type: 'done', model }
  }

  private async requestRaw(path: string, init: RequestInit, maxRetries = 2): Promise<Response> {
    const baseUrl = this.configService.get('OPENWIRE_BASE_URL', { infer: true })
    const apiKey = this.configService.get('OPENWIRE_API_KEY', { infer: true })
    const timeoutMs = this.configService.get('OPENWIRE_TIMEOUT_MS', { infer: true })

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const headers = new Headers(init.headers)
      headers.set('Content-Type', 'application/json')
      if (apiKey) {
        headers.set('Authorization', `Bearer ${apiKey}`)
      }

      try {
        const response = await fetch(`${baseUrl}${path}`, {
          ...init,
          headers,
          signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
        })

        if (response.ok) {
          return response
        }

        const status = response.status
        const isRetryable = status === 429 || status >= 500

        if (!isRetryable || attempt >= maxRetries) {
          const errorText = await response.text().catch(() => '')
          throw new ServiceUnavailableException(
            `OpenWire request failed (${status}): ${errorText || response.statusText}`,
          )
        }

        lastError = new Error(`OpenWire returned ${status}`)
      } catch (error) {
        if (error instanceof ServiceUnavailableException) throw error

        lastError = error instanceof Error ? error : new Error('Unknown error')

        if (attempt >= maxRetries) {
          throw new ServiceUnavailableException(
            `Unable to reach OpenWire after ${attempt + 1} attempts: ${lastError.message}`,
          )
        }
      }

      const backoffMs = Math.min(1000 * 2 ** attempt, 8000)
      this.logger.warn(`OpenWire request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${backoffMs}ms: ${lastError?.message}`)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
    }

    throw new ServiceUnavailableException(
      `Unable to reach OpenWire: ${lastError?.message ?? 'Unknown error'}`,
    )
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const response = await this.requestRaw(path, init)
    return response.json()
  }

  private stringifyForLog(value: unknown, maxLength: number): string {
    const serialized = JSON.stringify(value)

    if (serialized.length <= maxLength) {
      return serialized
    }

    return `${serialized.slice(0, maxLength)}... [truncated]`
  }
}

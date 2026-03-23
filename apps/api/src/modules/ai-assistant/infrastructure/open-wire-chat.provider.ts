import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { z } from 'zod'

import type { Env } from '@/app/config/env.schema'
import type {
  AiChatProvider,
  AiChatProviderCompletion,
  AiChatProviderToolCall,
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

  async createChatCompletion(input: {
    model?: string
    messages: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool'
      content: string | null
      tool_call_id?: string
      tool_calls?: AiChatProviderToolCall[]
    }>
    tools?: Array<{
      type: 'function'
      function: {
        name: string
        description: string
        parameters: Record<string, unknown>
      }
    }>
    toolChoice?: 'auto' | 'required' | 'none'
  }): Promise<AiChatProviderCompletion> {
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

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const baseUrl = this.configService.get('OPENWIRE_BASE_URL', { infer: true })
    const apiKey = this.configService.get('OPENWIRE_API_KEY', { infer: true })
    const timeoutMs = this.configService.get('OPENWIRE_TIMEOUT_MS', { infer: true })
    const headers = new Headers(init.headers)

    headers.set('Content-Type', 'application/json')
    if (apiKey) {
      headers.set('Authorization', `Bearer ${apiKey}`)
    }

    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
        signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
      })
    } catch (error) {
      throw new ServiceUnavailableException(
        error instanceof Error
          ? `Unable to reach OpenWire: ${error.message}`
          : 'Unable to reach OpenWire',
      )
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new ServiceUnavailableException(
        `OpenWire request failed (${response.status}): ${errorText || response.statusText}`,
      )
    }

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

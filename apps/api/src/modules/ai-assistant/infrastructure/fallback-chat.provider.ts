import { Injectable, Logger } from '@nestjs/common'

import type {
  AiChatCompletionInput,
  AiChatProvider,
  AiChatProviderCompletion,
  AiChatProviderStreamChunk,
} from '@/modules/ai-assistant/application/ports/ai-chat-provider.port'

@Injectable()
export class FallbackChatProvider implements AiChatProvider {
  private readonly logger = new Logger(FallbackChatProvider.name)
  private providers: AiChatProvider[] = []

  setProviders(providers: AiChatProvider[]) {
    this.providers = providers
  }

  async listModels(): Promise<string[]> {
    const allModels: string[] = []
    for (const provider of this.providers) {
      try {
        const models = await provider.listModels()
        allModels.push(...models)
      } catch (error) {
        this.logger.warn(`Provider failed to list models: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    return [...new Set(allModels)]
  }

  async createChatCompletion(input: AiChatCompletionInput): Promise<AiChatProviderCompletion> {
    let lastError: Error | null = null

    for (const provider of this.providers) {
      try {
        return await provider.createChatCompletion(input)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        this.logger.warn(`Provider failed, trying next: ${lastError.message}`)
      }
    }

    throw lastError ?? new Error('No AI providers available')
  }

  async *createStreamingChatCompletion(input: AiChatCompletionInput): AsyncIterable<AiChatProviderStreamChunk> {
    let lastError: Error | null = null

    for (const provider of this.providers) {
      try {
        yield* provider.createStreamingChatCompletion(input)
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        this.logger.warn(`Streaming provider failed, trying next: ${lastError.message}`)
      }
    }

    throw lastError ?? new Error('No AI providers available')
  }
}

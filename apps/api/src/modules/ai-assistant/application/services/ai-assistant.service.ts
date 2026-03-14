import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AI_CHAT_PROVIDER } from '@/modules/ai-assistant/application/ports/ai-chat-provider.port'
import { AiToolRegistryService } from '@/modules/ai-assistant/application/services/ai-tool-registry.service'

import type { Env } from '@/app/config/env.schema'
import type {
  AiChatProvider,
  AiChatProviderMessage, AiChatProviderToolCall
} from '@/modules/ai-assistant/application/ports/ai-chat-provider.port'
import type { AiAssistantChatRequest } from '@/modules/ai-assistant/presentation/dtos/ai-assistant.schema'

const SYSTEM_PROMPT = [
  'You are an analytics assistant for a personal operations dashboard.',
  'You must reason from the conversation history, tool results, and your bounded general knowledge.',
  'When relevant tools are available, prefer calling them instead of guessing.',
  'Do not rely on frontend-provided page snapshots, widgets, or route-specific context. Use backend tools to discover the necessary evidence.',
  'Do more than restate visible cards or tables. Use backend tools to fetch broader evidence, compare results, and produce useful analysis.',
  'You may use your own general world knowledge for qualitative explanation, business context, sector tailwinds, and common risk factors even when that detail is not present in the user data.',
  'When you use general knowledge, label it clearly as general market context or qualitative reasoning, not as live portfolio data or fresh news.',
  'If tools return normalized or inferred concepts such as broker/platform roles, concentration, growth, or cross-domain relationships, use them explicitly in your answer.',
  'Do not claim to see hidden rows, raw records, or charts that are not included in the context payload or returned by tools.',
  'Do not imply access to real-time prices, current filings, breaking news, or post-training events unless a tool explicitly returned that information.',
  'Avoid redundant tool calls and only fetch the data necessary to answer the user well.',
  'When a question needs information from holdings, dividends, principal, expenses, flights, or hotels, use the relevant tools or the constrained analytics DSL before giving a shallow answer.',
  'Prefer concise, high-signal answers with concrete observations, anomalies, trends, risks, and next steps.',
  'If the user asks about a specific company or fund, first try to confirm the position with tools, then combine that portfolio evidence with your qualitative reasoning.',
  'If the data is incomplete, say what is missing and what additional context would improve the answer, but still provide the best bounded qualitative view you can when appropriate.',
  'Present conclusions as evidence followed by interpretation, especially for inferred relationships or classifications.',
  'When useful, format the response in short markdown sections or bullets.',
].join(' ')

const MAX_TOOL_ROUNDS = 4

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name)

  constructor(
    @Inject(AI_CHAT_PROVIDER)
    private readonly aiChatProvider: AiChatProvider,
    private readonly aiToolRegistry: AiToolRegistryService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  async getStatus() {
    const baseUrl = this.configService.get('OPENWIRE_BASE_URL', { infer: true })
    const defaultModel = this.configService.get('OPENWIRE_MODEL', { infer: true })

    try {
      const models = await this.aiChatProvider.listModels()
      return {
        available: true,
        baseUrl,
        defaultModel,
        models,
      }
    } catch (error) {
      return {
        available: false,
        baseUrl,
        defaultModel,
        models: [] as string[],
        error: error instanceof Error ? error.message : 'Failed to reach OpenWire',
      }
    }
  }

  async chat(input: AiAssistantChatRequest, userId: string) {
    const tools = this.aiToolRegistry.getTools()
    const prefetchedEvidence = await this.buildPrefetchedEvidence(input, userId)
    const messages = this.buildMessages(input, prefetchedEvidence.messages)
    const model = input.model || this.configService.get('OPENWIRE_MODEL', { infer: true })
    const toolsUsed: string[] = [...prefetchedEvidence.toolsUsed]

    this.logger.debug(
      `AI chat request: ${JSON.stringify({
        userId,
        model,
        availableTools: tools.map((tool) => tool.function.name),
        messages: input.messages.map((message) => ({
          role: message.role,
          content: this.truncate(message.content, 1000),
        })),
      })}`,
    )

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const completion = await this.aiChatProvider.createChatCompletion({
        model,
        messages,
        tools,
        toolChoice: tools.length > 0 ? 'auto' : 'none',
      })

      if (!completion.toolCalls || completion.toolCalls.length === 0) {
        this.logger.debug(
          `AI chat response: ${JSON.stringify({
            userId,
            model: completion.model,
            toolsUsed: [...new Set(toolsUsed)],
            usage: completion.usage,
            message: this.truncate(completion.content ?? 'No response generated.', 2000),
          })}`,
        )

        return {
          message: completion.content ?? 'No response generated.',
          model: completion.model,
          usage: completion.usage,
          toolsUsed: [...new Set(toolsUsed)],
        }
      }

      messages.push(this.createAssistantToolCallMessage(completion.toolCalls, completion.content))

      this.logger.debug(
        `AI tool call round: ${JSON.stringify({
          userId,
          round: round + 1,
          model: completion.model,
          toolCalls: completion.toolCalls.map((toolCall) => ({
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: this.truncate(toolCall.function.arguments, 1000),
          })),
          assistantMessage: this.truncate(completion.content ?? '', 1000),
        })}`,
      )

      for (const toolCall of completion.toolCalls) {
        toolsUsed.push(toolCall.function.name)
        const toolResult = await this.aiToolRegistry.executeTool(toolCall, {
          userId,
        })

        this.logger.debug(
          `AI tool result: ${JSON.stringify({
            userId,
            tool: toolCall.function.name,
            result: this.truncate(JSON.stringify(toolResult), 2000),
          })}`,
        )

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        })
      }
    }

    throw new ServiceUnavailableException('Assistant exceeded the maximum tool-call rounds.')
  }

  private buildMessages(
    input: AiAssistantChatRequest,
    prefetchedMessages: AiChatProviderMessage[] = [],
  ): AiChatProviderMessage[] {
    return [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      ...prefetchedMessages,
      ...input.messages,
    ]
  }

  private async buildPrefetchedEvidence(
    input: AiAssistantChatRequest,
    userId: string,
  ): Promise<{ messages: AiChatProviderMessage[], toolsUsed: string[] }> {
    const latestUserMessage = [...input.messages]
      .reverse()
      .find((message) => message.role === 'user')

    if (!latestUserMessage) {
      return { messages: [], toolsUsed: [] }
    }

    const holdingQuery = this.extractHoldingLookupQuery(latestUserMessage.content)
    if (!holdingQuery) {
      return { messages: [], toolsUsed: [] }
    }

    const toolResult = await this.aiToolRegistry.executeTool(
      {
        id: 'prefetch-getHoldingDetails',
        type: 'function',
        function: {
          name: 'getHoldingDetails',
          arguments: JSON.stringify({ query: holdingQuery }),
        },
      },
      {
        userId,
      },
    )

    this.logger.debug(
      `AI prefetch result: ${JSON.stringify({
        userId,
        tool: 'getHoldingDetails',
        query: holdingQuery,
        result: this.truncate(JSON.stringify(toolResult), 2000),
      })}`,
    )

    return {
      toolsUsed: ['getHoldingDetails'],
      messages: [
        {
          role: 'system',
          content: [
            'A portfolio lookup has already been executed for the latest company-style question.',
            'Do not ask the user for basic holding details that are already present below.',
            'Do not blame current page context if the lookup misses; say the holding was not confirmed in portfolio tools and then give bounded qualitative reasoning when prospects were requested.',
          ].join('\n\n'),
        },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'prefetch-getHoldingDetails',
              type: 'function',
              function: {
                name: 'getHoldingDetails',
                arguments: JSON.stringify({ query: holdingQuery }),
              },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'prefetch-getHoldingDetails',
          content: JSON.stringify(toolResult),
        },
      ],
    }
  }

  private extractHoldingLookupQuery(content: string): string | null {
    const normalized = content.replaceAll(/\s+/g, ' ').trim()

    const patterns = [
      /analy(?:s|z)e\s+(.+?)(?:,|\.|\?| as per| in my| for my| tell me| give me| what| prospects| outlook| thesis| view| opinion| should)/i,
      /(?:prospects|outlook|view|opinion|thesis)\s+(?:for|on)\s+(.+?)(?:,|\.|\?| as per| in my| for my| tell me| give me| what| should)/i,
      /about\s+(.+?)(?:,|\.|\?| as per| in my| for my| tell me| give me| what| prospects| outlook| thesis| view| opinion| should)/i,
    ]

    for (const pattern of patterns) {
      const match = normalized.match(pattern)
      const extracted = match?.[1]?.trim()
      if (extracted) {
        return extracted.replaceAll(/^['\"]|['\"]$/g, '').trim()
      }
    }

    return null
  }

  private createAssistantToolCallMessage(
    toolCalls: AiChatProviderToolCall[],
    content: string | null,
  ): AiChatProviderMessage {
    return {
      role: 'assistant',
      content,
      tool_calls: toolCalls,
    }
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value
    }

    return `${value.slice(0, maxLength)}... [truncated]`
  }
}

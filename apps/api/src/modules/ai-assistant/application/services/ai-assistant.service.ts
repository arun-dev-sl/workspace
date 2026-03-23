import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AI_CHAT_PROVIDER } from '@/modules/ai-assistant/application/ports/ai-chat-provider.port'
import { AiToolRegistryService } from '@/modules/ai-assistant/application/services/ai-tool-registry.service'

import type { Env } from '@/app/config/env.schema'
import type {
  AiChatProvider,
  AiChatProviderMessage,
  AiChatProviderToolCall,
  AiChatProviderToolDefinition,
} from '@/modules/ai-assistant/application/ports/ai-chat-provider.port'
import type { AiAssistantChatRequest } from '@/modules/ai-assistant/presentation/dtos/ai-assistant.schema'

export type AiAssistantAnalysisStep = {
  id: string
  type: 'prefetch' | 'observation' | 'tool-call' | 'final'
  title: string
  summary: string
  status: 'completed' | 'failed'
  toolName?: string
  toolArgs?: unknown
  resultData?: unknown
  resultPreview?: string
}

export type AiAssistantAnalysis = {
  status: 'completed'
  totalToolRounds: number
  toolsUsed: string[]
  steps: AiAssistantAnalysisStep[]
}

export type AiStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'tool-start'; toolName: string; toolCallId: string }
  | { type: 'tool-result'; toolCallId: string; toolName: string; ok: boolean; preview: string }
  | { type: 'step'; step: AiAssistantAnalysisStep }
  | { type: 'done'; message: string; model: string; toolsUsed: string[]; analysis: AiAssistantAnalysis; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }
  | { type: 'error'; message: string }

const SYSTEM_PROMPT = [
  'You are an analytics assistant for a personal operations dashboard.',
  'You must reason from the conversation history, tool results, and your bounded general knowledge.',
  'When relevant tools are available, prefer calling them instead of guessing.',
  'For analytical questions, work in stages: identify what needs to be tested, call the right tools, inspect the results, and only then conclude.',
  'If the first tool result is incomplete, refine the query or call another tool instead of giving a premature answer.',
  'When the question is broad or cross-domain, generate short working hypotheses, test them with tools, compare the evidence, and then synthesize.',
  'Use capability discovery tools when you are unsure which tool or analytics shape is best.',
  'Do not rely on frontend-provided page snapshots, widgets, or route-specific context. Use backend tools to discover the necessary evidence.',
  'Do more than restate visible cards or tables. Use backend tools to fetch broader evidence, compare results, and produce useful analysis.',
  'You may use your own general world knowledge for qualitative explanation, business context, sector tailwinds, and common risk factors even when that detail is not present in the user data.',
  'When you use general knowledge, label it clearly as general market context or qualitative reasoning, not as live portfolio data or fresh news.',
  'If tools return normalized or inferred concepts such as broker/platform roles, concentration, growth, or cross-domain relationships, use them explicitly in your answer.',
  'Do not claim to see hidden rows, raw records, or charts that are not included in the context payload or returned by tools.',
  'Do not imply access to real-time prices, current filings, breaking news, or post-training events unless a tool explicitly returned that information.',
  'Avoid redundant tool calls and only fetch the data necessary to answer the user well.',
  'When a question needs information from holdings, dividends, principal, expenses, flights, or hotels, use the relevant tools or the constrained analytics DSL before giving a shallow answer.',
  'Prefer multiple focused tool calls over one vague query when that will produce better evidence.',
  'Prefer concise, high-signal answers with concrete observations, anomalies, trends, risks, and next steps.',
  'If the user asks about a specific company or fund, first try to confirm the position with tools, then combine that portfolio evidence with your qualitative reasoning.',
  'If the data is incomplete, say what is missing and what additional context would improve the answer, but still provide the best bounded qualitative view you can when appropriate.',
  'Present conclusions as evidence followed by interpretation, especially for inferred relationships or classifications.',
  'When useful, format the response in short markdown sections or bullets.',
  '',
  'STRUCTURED OUTPUT GUIDELINES:',
  'At the end of your response, always suggest 2-4 follow-up questions the user might want to explore. Format them as a block:',
  ':::actions',
  'What is my expense trend over the last quarter?',
  'How does my dividend income compare year over year?',
  ':::',
  '',
  'When presenting key metrics, use this format for each metric:',
  ':::metric',
  '{"label":"Total Portfolio Value","value":"₹12,45,000","trend":"up","change":"+8.2%"}',
  ':::',
  '',
  'You may embed multiple metric blocks in a single response.',
].join('\n')

const DEFAULT_MAX_TOOL_ROUNDS = 6
const MAX_CONTEXT_TOKENS = 12_000
const SUMMARIZATION_THRESHOLD = 10

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

function estimateMessageTokens(messages: AiChatProviderMessage[]): number {
  let total = 0
  for (const msg of messages) {
    total += 4
    if (msg.content) total += estimateTokens(msg.content)
    if (msg.tool_calls) total += estimateTokens(JSON.stringify(msg.tool_calls))
  }
  return total
}

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name)
  private readonly maxToolRounds: number

  constructor(
    @Inject(AI_CHAT_PROVIDER)
    private readonly aiChatProvider: AiChatProvider,
    private readonly aiToolRegistry: AiToolRegistryService,
    private readonly configService: ConfigService<Env, true>,
  ) {
    const envRounds = this.configService.get('OPENWIRE_MAX_TOOL_ROUNDS', { infer: true })
    this.maxToolRounds = envRounds ?? DEFAULT_MAX_TOOL_ROUNDS
  }

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
    const analysisSteps: AiAssistantAnalysisStep[] = [...prefetchedEvidence.steps]

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

    for (let round = 0; round < this.maxToolRounds; round += 1) {
      const completion = await this.aiChatProvider.createChatCompletion({
        model,
        messages,
        tools,
        toolChoice: tools.length > 0 ? 'auto' : 'none',
      })

      if (!completion.toolCalls || completion.toolCalls.length === 0) {
        analysisSteps.push({
          id: `final-${round + 1}`,
          type: 'final',
          title: 'Synthesized response',
          summary: completion.content
            ? this.truncate(completion.content, 240)
            : 'No response generated.',
          status: 'completed',
        })

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
          analysis: {
            status: 'completed',
            totalToolRounds: round + 1,
            toolsUsed: [...new Set(toolsUsed)],
            steps: analysisSteps,
          } satisfies AiAssistantAnalysis,
        }
      }

      messages.push(this.createAssistantToolCallMessage(completion.toolCalls, completion.content))

      if (completion.content?.trim()) {
        analysisSteps.push({
          id: `observation-${round + 1}`,
          type: 'observation',
          title: `Planning step ${round + 1}`,
          summary: this.truncate(completion.content, 240),
          status: 'completed',
        })
      }

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

      const toolResults = await Promise.all(
        completion.toolCalls.map(async (toolCall) => {
          const result = await this.aiToolRegistry.executeTool(toolCall, { userId })
          return { toolCall, result }
        }),
      )

      for (const { toolCall, result: toolResult } of toolResults) {
        toolsUsed.push(toolCall.function.name)
        const parsedArguments = this.tryParseJson(toolCall.function.arguments)
        const resultPreview = toolResult.ok
          ? this.summarizeToolResult(toolResult.result)
          : toolResult.error

        analysisSteps.push({
          id: toolCall.id,
          type: 'tool-call',
          title: `Ran ${toolCall.function.name}`,
          summary: toolResult.ok
            ? `Executed ${toolCall.function.name} and captured structured evidence.`
            : `Attempted ${toolCall.function.name}, but the tool returned an error.`,
          status: toolResult.ok ? 'completed' : 'failed',
          toolName: toolCall.function.name,
          toolArgs: parsedArguments,
          resultData: toolResult.ok ? toolResult.result : { error: toolResult.error },
          resultPreview,
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

    this.logger.warn('AI assistant exceeded maximum tool-call rounds, returning partial result')

    return {
      message: 'I was unable to fully complete the analysis within the allowed number of tool-calling rounds. Here is what I gathered so far. Please try asking a more specific question.',
      model: input.model || this.configService.get('OPENWIRE_MODEL', { infer: true }),
      toolsUsed: [...new Set(toolsUsed)],
      analysis: {
        status: 'completed' as const,
        totalToolRounds: this.maxToolRounds,
        toolsUsed: [...new Set(toolsUsed)],
        steps: analysisSteps,
      },
    }
  }

  async *chatStream(input: AiAssistantChatRequest, userId: string): AsyncGenerator<AiStreamEvent> {
    const allTools = this.aiToolRegistry.getTools()
    const tools = this.filterToolsForPage(allTools, input.pageContext?.pageId)
    const prefetchedEvidence = await this.buildPrefetchedEvidence(input, userId)
    const messages = this.buildMessages(input, prefetchedEvidence.messages)
    const model: string = input.model || this.configService.get('OPENWIRE_MODEL', { infer: true })
    const toolsUsed: string[] = [...prefetchedEvidence.toolsUsed]
    const analysisSteps: AiAssistantAnalysisStep[] = [...prefetchedEvidence.steps]

    for (const step of prefetchedEvidence.steps) {
      yield { type: 'step', step }
    }

    let fullContent = ''
    let lastUsage: AiStreamEvent & { type: 'done' } | undefined

    for (let round = 0; round < this.maxToolRounds; round += 1) {
      let roundContent = ''
      const roundToolCalls: AiChatProviderToolCall[] = []
      const toolCallArgBuilders = new Map<string, { id: string; name: string; arguments: string }>()
      let roundModel = model

      for await (const chunk of this.aiChatProvider.createStreamingChatCompletion({
        model,
        messages,
        tools,
        toolChoice: tools.length > 0 ? 'auto' : 'none',
      })) {
        switch (chunk.type) {
          case 'token': {
            roundContent += chunk.content
            yield { type: 'token', content: chunk.content }
            break
          }
          case 'tool-call-start': {
            toolCallArgBuilders.set(chunk.toolCall.id, {
              id: chunk.toolCall.id,
              name: chunk.toolCall.name,
              arguments: '',
            })
            yield { type: 'tool-start', toolName: chunk.toolCall.name, toolCallId: chunk.toolCall.id }
            break
          }
          case 'tool-call-args': {
            const builder = toolCallArgBuilders.get(chunk.toolCallId)
            if (builder) {
              builder.arguments += chunk.argumentsDelta
            }
            break
          }
          case 'done': {
            roundModel = chunk.model
            lastUsage = {
              type: 'done',
              message: '',
              model: chunk.model,
              toolsUsed: [],
              analysis: { status: 'completed', totalToolRounds: 0, toolsUsed: [], steps: [] },
              usage: chunk.usage,
            }
            break
          }
        }
      }

      for (const builder of toolCallArgBuilders.values()) {
        roundToolCalls.push({
          id: builder.id,
          type: 'function',
          function: { name: builder.name, arguments: builder.arguments },
        })
      }

      if (roundToolCalls.length === 0) {
        fullContent += roundContent
        analysisSteps.push({
          id: `final-${round + 1}`,
          type: 'final',
          title: 'Synthesized response',
          summary: fullContent ? this.truncate(fullContent, 240) : 'No response generated.',
          status: 'completed',
        })

        yield {
          type: 'done',
          message: fullContent || 'No response generated.',
          model: roundModel,
          toolsUsed: [...new Set(toolsUsed)],
          analysis: {
            status: 'completed',
            totalToolRounds: round + 1,
            toolsUsed: [...new Set(toolsUsed)],
            steps: analysisSteps,
          },
          usage: lastUsage?.usage,
        }
        return
      }

      messages.push(this.createAssistantToolCallMessage(roundToolCalls, roundContent || null))

      if (roundContent.trim()) {
        const observationStep: AiAssistantAnalysisStep = {
          id: `observation-${round + 1}`,
          type: 'observation',
          title: `Planning step ${round + 1}`,
          summary: this.truncate(roundContent, 240),
          status: 'completed',
        }
        analysisSteps.push(observationStep)
        yield { type: 'step', step: observationStep }
      }

      const toolResults = await Promise.all(
        roundToolCalls.map(async (toolCall) => {
          const result = await this.aiToolRegistry.executeTool(toolCall, { userId })
          return { toolCall, result }
        }),
      )

      for (const { toolCall, result } of toolResults) {
        toolsUsed.push(toolCall.function.name)
        const parsedArguments = this.tryParseJson(toolCall.function.arguments)
        const resultPreview = result.ok ? this.summarizeToolResult(result.result) : result.error

        const toolStep: AiAssistantAnalysisStep = {
          id: toolCall.id,
          type: 'tool-call',
          title: `Ran ${toolCall.function.name}`,
          summary: result.ok
            ? `Executed ${toolCall.function.name} and captured structured evidence.`
            : `Attempted ${toolCall.function.name}, but the tool returned an error.`,
          status: result.ok ? 'completed' : 'failed',
          toolName: toolCall.function.name,
          toolArgs: parsedArguments,
          resultData: result.ok ? result.result : { error: result.error },
          resultPreview,
        }
        analysisSteps.push(toolStep)
        yield { type: 'tool-result', toolCallId: toolCall.id, toolName: toolCall.function.name, ok: result.ok, preview: resultPreview ?? '' }
        yield { type: 'step', step: toolStep }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        })
      }
    }

    yield {
      type: 'error',
      message: 'Assistant exceeded the maximum tool-call rounds.',
    }
  }

  private filterToolsForPage(
    tools: AiChatProviderToolDefinition[],
    _pageId?: string,
  ): AiChatProviderToolDefinition[] {
    return tools
  }

  private buildMessages(
    input: AiAssistantChatRequest,
    prefetchedMessages: AiChatProviderMessage[] = [],
  ): AiChatProviderMessage[] {
    const systemMessages: AiChatProviderMessage[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
    ]

    if (input.pageContext) {
      systemMessages.push({
        role: 'system',
        content: [
          `The user is currently viewing: "${input.pageContext.title}" (page: ${input.pageContext.pageId}, route: ${input.pageContext.route}).`,
          input.pageContext.description ? `Page description: ${input.pageContext.description}` : '',
          input.pageContext.filters ? `Active filters: ${JSON.stringify(input.pageContext.filters)}` : '',
          input.pageContext.dataSnapshot ? `Visible data snapshot: ${JSON.stringify(input.pageContext.dataSnapshot)}` : '',
          'Use this context to provide more relevant answers, but always verify with backend tools rather than relying solely on snapshot data.',
        ].filter(Boolean).join('\n'),
      })
    }

    const conversationMessages = this.manageConversationMemory(input.messages)

    return [
      ...systemMessages,
      ...prefetchedMessages,
      ...conversationMessages,
    ]
  }

  private manageConversationMemory(
    messages: AiChatProviderMessage[],
  ): AiChatProviderMessage[] {
    if (messages.length <= SUMMARIZATION_THRESHOLD) {
      return messages
    }

    const totalTokens = estimateMessageTokens(messages)
    if (totalTokens <= MAX_CONTEXT_TOKENS) {
      return messages
    }

    const recentCount = Math.min(6, messages.length)
    const recent = messages.slice(-recentCount)
    const older = messages.slice(0, -recentCount)

    const summaryParts: string[] = []
    for (const msg of older) {
      if (msg.role === 'user') {
        summaryParts.push(`User asked: ${this.truncate(msg.content ?? '', 120)}`)
      } else if (msg.role === 'assistant' && msg.content) {
        summaryParts.push(`Assistant answered: ${this.truncate(msg.content, 120)}`)
      }
    }

    const summaryMessage: AiChatProviderMessage = {
      role: 'system',
      content: `Summary of earlier conversation (${older.length} messages):\n${summaryParts.join('\n')}`,
    }

    this.logger.debug(
      `Conversation memory: compressed ${older.length} older messages into summary (${estimateTokens(summaryMessage.content!)} est. tokens). Keeping ${recentCount} recent messages.`,
    )

    return [summaryMessage, ...recent]
  }

  private async buildPrefetchedEvidence(
    input: AiAssistantChatRequest,
    userId: string,
  ): Promise<{ messages: AiChatProviderMessage[], toolsUsed: string[], steps: AiAssistantAnalysisStep[] }> {
    const latestUserMessage = [...input.messages]
      .reverse()
      .find((message) => message.role === 'user')

    if (!latestUserMessage) {
      return { messages: [], toolsUsed: [], steps: [] }
    }

    const intent = this.detectIntent(latestUserMessage.content)

    if (intent.type === 'holding-lookup' && intent.query) {
      return this.prefetchHolding(intent.query, userId)
    }

    if (intent.type === 'portfolio-overview') {
      return this.prefetchPortfolioSummary(userId)
    }

    if (intent.type === 'expense-summary') {
      return this.prefetchExpenseSummary(userId, intent.period)
    }

    return { messages: [], toolsUsed: [], steps: [] }
  }

  private detectIntent(content: string): {
    type: 'holding-lookup' | 'portfolio-overview' | 'expense-summary' | 'unknown'
    query?: string
    period?: string
  } {
    const normalized = content.replaceAll(/\s+/g, ' ').trim().toLowerCase()

    const holdingPatterns = [
      /analy(?:s|z)e\s+(.+?)(?:,|\.|\?| as per| in my| for my| tell me| give me| what| prospects| outlook| thesis| view| opinion| should)/i,
      /(?:prospects|outlook|view|opinion|thesis)\s+(?:for|on)\s+(.+?)(?:,|\.|\?| as per| in my| for my| tell me| give me| what| should)/i,
      /about\s+(.+?)(?:,|\.|\?| as per| in my| for my| tell me| give me| what| prospects| outlook| thesis| view| opinion| should)/i,
    ]

    for (const pattern of holdingPatterns) {
      const match = content.replaceAll(/\s+/g, ' ').trim().match(pattern)
      const extracted = match?.[1]?.trim()
      if (extracted) {
        return {
          type: 'holding-lookup',
          query: extracted.replaceAll(/^['"]|['"]$/g, '').trim(),
        }
      }
    }

    const portfolioKeywords = ['portfolio', 'allocation', 'holdings', 'invested', 'investment', 'net worth']
    if (portfolioKeywords.some((kw) => normalized.includes(kw))) {
      return { type: 'portfolio-overview' }
    }

    const expenseKeywords = ['expense', 'spending', 'spent', 'merchant', 'transaction', 'cost']
    if (expenseKeywords.some((kw) => normalized.includes(kw))) {
      const periodMatch = normalized.match(/\b(week|month|quarter|year)\b/)
      return { type: 'expense-summary', period: periodMatch?.[1] }
    }

    return { type: 'unknown' }
  }

  private async prefetchHolding(query: string, userId: string): Promise<{ messages: AiChatProviderMessage[], toolsUsed: string[], steps: AiAssistantAnalysisStep[] }> {
    const toolResult = await this.aiToolRegistry.executeTool(
      {
        id: 'prefetch-getHoldingDetails',
        type: 'function',
        function: {
          name: 'getHoldingDetails',
          arguments: JSON.stringify({ query }),
        },
      },
      { userId },
    )

    this.logger.debug(
      `AI prefetch holding result: ${JSON.stringify({
        userId, tool: 'getHoldingDetails', query,
        result: this.truncate(JSON.stringify(toolResult), 2000),
      })}`,
    )

    return {
      toolsUsed: ['getHoldingDetails'],
      steps: [{
        id: 'prefetch-getHoldingDetails',
        type: 'prefetch',
        title: 'Prefetched holding evidence',
        summary: `Ran getHoldingDetails before the main loop for "${query}".`,
        status: 'completed',
        toolName: 'getHoldingDetails',
        toolArgs: { query },
        resultData: toolResult,
        resultPreview: this.summarizeToolResult(toolResult),
      }],
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
          tool_calls: [{
            id: 'prefetch-getHoldingDetails',
            type: 'function',
            function: { name: 'getHoldingDetails', arguments: JSON.stringify({ query }) },
          }],
        },
        {
          role: 'tool',
          tool_call_id: 'prefetch-getHoldingDetails',
          content: JSON.stringify(toolResult),
        },
      ],
    }
  }

  private async prefetchPortfolioSummary(userId: string): Promise<{ messages: AiChatProviderMessage[], toolsUsed: string[], steps: AiAssistantAnalysisStep[] }> {
    const toolResult = await this.aiToolRegistry.executeTool(
      {
        id: 'prefetch-getPortfolioSummary',
        type: 'function',
        function: { name: 'getPortfolioSummary', arguments: '{}' },
      },
      { userId },
    )

    return {
      toolsUsed: ['getPortfolioSummary'],
      steps: [{
        id: 'prefetch-getPortfolioSummary',
        type: 'prefetch',
        title: 'Prefetched portfolio summary',
        summary: 'Ran getPortfolioSummary before the main loop.',
        status: 'completed',
        toolName: 'getPortfolioSummary',
        toolArgs: {},
        resultData: toolResult,
        resultPreview: this.summarizeToolResult(toolResult),
      }],
      messages: [
        {
          role: 'system',
          content: 'A portfolio summary has already been fetched. Use the data below as baseline evidence. Call additional tools only if deeper analysis is needed.',
        },
        {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'prefetch-getPortfolioSummary',
            type: 'function',
            function: { name: 'getPortfolioSummary', arguments: '{}' },
          }],
        },
        {
          role: 'tool',
          tool_call_id: 'prefetch-getPortfolioSummary',
          content: JSON.stringify(toolResult),
        },
      ],
    }
  }

  private async prefetchExpenseSummary(userId: string, period = 'month'): Promise<{ messages: AiChatProviderMessage[], toolsUsed: string[], steps: AiAssistantAnalysisStep[] }> {
    const resolvedPeriod = period
    const toolResult = await this.aiToolRegistry.executeTool(
      {
        id: 'prefetch-getExpenseSummary',
        type: 'function',
        function: { name: 'getExpenseSummary', arguments: JSON.stringify({ period: resolvedPeriod }) },
      },
      { userId },
    )

    return {
      toolsUsed: ['getExpenseSummary'],
      steps: [{
        id: 'prefetch-getExpenseSummary',
        type: 'prefetch',
        title: 'Prefetched expense summary',
        summary: `Ran getExpenseSummary for period "${resolvedPeriod}" before the main loop.`,
        status: 'completed',
        toolName: 'getExpenseSummary',
        toolArgs: { period: resolvedPeriod },
        resultData: toolResult,
        resultPreview: this.summarizeToolResult(toolResult),
      }],
      messages: [
        {
          role: 'system',
          content: `An expense summary for the "${resolvedPeriod}" period has already been fetched. Use the data below as baseline evidence.`,
        },
        {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'prefetch-getExpenseSummary',
            type: 'function',
            function: { name: 'getExpenseSummary', arguments: JSON.stringify({ period: resolvedPeriod }) },
          }],
        },
        {
          role: 'tool',
          tool_call_id: 'prefetch-getExpenseSummary',
          content: JSON.stringify(toolResult),
        },
      ],
    }
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

  private tryParseJson(value: string): unknown {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  private summarizeToolResult(value: unknown): string {
    return this.truncate(JSON.stringify(value), 320)
  }
}

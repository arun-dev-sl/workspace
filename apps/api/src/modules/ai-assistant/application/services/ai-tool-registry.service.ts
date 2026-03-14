import { Injectable } from '@nestjs/common'
import { addDays, getYear, isValid, parseISO, startOfDay } from 'date-fns'
import { z } from 'zod'

import { AiAnalyticsDslService } from '@/modules/ai-assistant/application/services/ai-analytics-dsl.service'
import { AiDomainIntelligenceService } from '@/modules/ai-assistant/application/services/ai-domain-intelligence.service'
import { DividendsService } from '@/modules/dividends/application/services/dividends.service'
import { ExpensesService } from '@/modules/expenses/application/services/expenses.service'
import { FlightAnalyticsService } from '@/modules/flights/application/services/flight-analytics.service'
import { HoldingsService } from '@/modules/holdings/application/services/holdings.service'
import { PrincipalService } from '@/modules/principal/application/services/principal.service'

import type {
  AiChatProviderToolCall,
  AiChatProviderToolDefinition,
} from '@/modules/ai-assistant/application/ports/ai-chat-provider.port'
import type { AnalyticsPeriod } from '@workspace/domain'

const analyticsPeriodSchema = z.enum(['week', 'month', 'quarter', 'year'])

const timeframeInputSchema = z.object({
  period: analyticsPeriodSchema.optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
}).superRefine((value, context) => {
  const hasPeriod = value.period !== undefined
  const hasDates = Boolean(value.startDate || value.endDate)

  if (hasPeriod && hasDates) {
    context.addIssue({
      code: 'custom',
      message: 'Provide either period or startDate/endDate, not both.',
      path: ['period'],
    })
  }

  if (!hasPeriod && !(value.startDate && value.endDate)) {
    context.addIssue({
      code: 'custom',
      message: 'Provide either period or both startDate and endDate.',
      path: ['startDate'],
    })
  }
})

const timeframeWithLimitInputSchema = timeframeInputSchema.extend({
  limit: z.number().int().min(1).max(20).default(10),
})

const periodOnlyInputSchema = z.object({
  period: analyticsPeriodSchema,
})

const investmentYearInputSchema = z.object({
  year: z.number().int().min(2000).max(2100).optional(),
})

const holdingLookupInputSchema = z.object({
  query: z.string().trim().min(1).max(120),
})

const analyticsDslQuerySchema = z.object({
  domain: z.enum(['expenses', 'holdings', 'dividends', 'principal', 'flights', 'hotels']),
  queryType: z.enum(['summary', 'breakdown', 'top-items', 'trend']).default('summary'),
  dimension: z.string().trim().min(1).max(60).optional(),
  metric: z.string().trim().min(1).max(60).optional(),
  period: analyticsPeriodSchema.optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  limit: z.number().int().min(1).max(25).default(10),
  includeArchived: z.boolean().optional(),
  filters: z.object({
    assetType: z.string().trim().min(1).max(40).optional(),
    platform: z.string().trim().min(1).max(80).optional(),
  }).optional(),
})

type AiToolExecutionContext = {
  userId: string
}

type AiToolDefinition<TArgs> = {
  name: string
  description: string
  parameters: Record<string, unknown>
  schema: z.ZodType<TArgs>
  pages: string[]
  execute: (arguments_: TArgs, context: AiToolExecutionContext) => Promise<unknown>
}

type StoredAiToolDefinition = {
  name: string
  description: string
  parameters: Record<string, unknown>
  schema: z.ZodTypeAny
  pages: string[]
  execute: (arguments_: any, context: AiToolExecutionContext) => Promise<unknown>
}

@Injectable()
export class AiToolRegistryService {
  private readonly toolDefinitions: StoredAiToolDefinition[]

  constructor(
    private readonly expensesService: ExpensesService,
    private readonly holdingsService: HoldingsService,
    private readonly dividendsService: DividendsService,
    private readonly principalService: PrincipalService,
    private readonly flightAnalyticsService: FlightAnalyticsService,
    private readonly analyticsDslService: AiAnalyticsDslService,
    private readonly domainIntelligenceService: AiDomainIntelligenceService,
  ) {
    this.toolDefinitions = [
      this.createExpenseSummaryTool(),
      this.createExpenseBreakdownTool(),
      this.createTopExpenseMerchantsTool(),
      this.createExpenseDailyTrendTool(),
      this.createLargestExpensesTool(),
      this.createExpensePeriodComparisonTool(),
      this.createPortfolioSummaryTool(),
      this.createHoldingLookupTool(),
      this.createDividendDashboardTool(),
      this.createInvestmentIntelligenceTool(),
      this.createPrincipalAnalyticsTool(),
      this.createFlightAnalyticsTool(),
      this.createHotelStaySummaryTool(),
      this.createAnalyticsDslTool(),
    ]
  }

  getTools(): AiChatProviderToolDefinition[] {
    return [...this.toolDefinitions]
      .map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }))
  }

  async executeTool(
    toolCall: AiChatProviderToolCall,
    context: AiToolExecutionContext,
  ): Promise<{ ok: true, tool: string, result: unknown } | { ok: false, tool: string, error: string }> {
    const tool = this.toolDefinitions.find((definition) => definition.name === toolCall.function.name)

    if (!tool) {
      return {
        ok: false,
        tool: toolCall.function.name,
        error: `Unknown tool: ${toolCall.function.name}`,
      }
    }

    try {
      const parsedArguments = this.parseToolArguments(toolCall.function.arguments)
      const validatedArguments = tool.schema.parse(parsedArguments)
      const result = await tool.execute(validatedArguments, context)

      return {
        ok: true,
        tool: tool.name,
        result,
      }
    } catch (error) {
      return {
        ok: false,
        tool: tool.name,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      }
    }
  }

  private parseToolArguments(rawArguments: string): unknown {
    if (!rawArguments.trim()) {
      return {}
    }

    return JSON.parse(rawArguments)
  }

  private resolveTimeframe(input: z.infer<typeof timeframeInputSchema>):
    | { kind: 'period', period: AnalyticsPeriod }
    | { kind: 'date-range', startDate: string, endDate: string } {
    if (input.period) {
      return { kind: 'period', period: input.period }
    }

    const startDate = parseISO(input.startDate!)
    const endDate = parseISO(input.endDate!)

    if (!isValid(startDate) || !isValid(endDate)) {
      throw new Error('Dates must be valid ISO strings in YYYY-MM-DD format.')
    }

    const normalizedStart = startOfDay(startDate)
    const normalizedEnd = startOfDay(addDays(endDate, 1))

    if (normalizedStart >= normalizedEnd) {
      throw new Error('endDate must be on or after startDate.')
    }

    return {
      kind: 'date-range',
      startDate: input.startDate!,
      endDate: input.endDate!,
    }
  }

  private createExpenseSummaryTool(): AiToolDefinition<z.infer<typeof timeframeInputSchema>> {
    return {
      name: 'getExpenseSummary',
      description: 'Get the overall expense summary for a period or explicit date range.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['week', 'month', 'quarter', 'year'],
            description: 'Use this when the user asks for a standard dashboard period.',
          },
          startDate: {
            type: 'string',
            description: 'Inclusive start date in YYYY-MM-DD format.',
          },
          endDate: {
            type: 'string',
            description: 'Inclusive end date in YYYY-MM-DD format.',
          },
        },
      },
      schema: timeframeInputSchema,
      pages: ['expenses-analytics'],
      execute: async (arguments_, context) => {
        const timeframe = this.resolveTimeframe(arguments_)
        if (timeframe.kind === 'period') {
          return this.expensesService.getSpendingSummary(context.userId, timeframe.period)
        }

        return this.expensesService.getSpendingSummaryForDateRange(
          context.userId,
          timeframe.startDate,
          timeframe.endDate,
        )
      },
    }
  }

  private createExpenseBreakdownTool(): AiToolDefinition<z.infer<typeof timeframeInputSchema>> {
    return {
      name: 'getExpenseBreakdown',
      description: 'Get expense totals grouped by category for a standard period or explicit date range.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['week', 'month', 'quarter', 'year'],
          },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
        },
      },
      schema: timeframeInputSchema,
      pages: ['expenses-analytics'],
      execute: async (arguments_, context) => {
        const timeframe = this.resolveTimeframe(arguments_)
        if (timeframe.kind === 'period') {
          return this.expensesService.getSpendingByCategory(context.userId, timeframe.period)
        }

        return this.expensesService.getSpendingByCategoryForDateRange(
          context.userId,
          timeframe.startDate,
          timeframe.endDate,
        )
      },
    }
  }

  private createTopExpenseMerchantsTool(): AiToolDefinition<z.infer<typeof timeframeWithLimitInputSchema>> {
    return {
      name: 'getTopExpenseMerchants',
      description: 'Get the top merchants by spend for a period or date range.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['week', 'month', 'quarter', 'year'],
          },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 20,
            default: 10,
          },
        },
      },
      schema: timeframeWithLimitInputSchema,
      pages: ['expenses-analytics'],
      execute: async (arguments_, context) => {
        const timeframe = this.resolveTimeframe(arguments_)
        if (timeframe.kind === 'period') {
          return this.expensesService.getTopMerchants(
            context.userId,
            timeframe.period,
            arguments_.limit,
          )
        }

        return this.expensesService.getTopMerchantsForDateRange(
          context.userId,
          timeframe.startDate,
          timeframe.endDate,
          arguments_.limit,
        )
      },
    }
  }

  private createExpenseDailyTrendTool(): AiToolDefinition<z.infer<typeof timeframeInputSchema>> {
    return {
      name: 'getExpenseDailyTrend',
      description: 'Get the daily credited and debited trend for a period or explicit date range.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['week', 'month', 'quarter', 'year'],
          },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
        },
      },
      schema: timeframeInputSchema,
      pages: ['expenses-analytics'],
      execute: async (arguments_, context) => {
        const timeframe = this.resolveTimeframe(arguments_)
        if (timeframe.kind === 'period') {
          return this.expensesService.getDailySpending(context.userId, timeframe.period)
        }

        return this.expensesService.getDailySpendingForDateRange(
          context.userId,
          timeframe.startDate,
          timeframe.endDate,
        )
      },
    }
  }

  private createLargestExpensesTool(): AiToolDefinition<z.infer<typeof timeframeWithLimitInputSchema>> {
    return {
      name: 'getLargestExpenses',
      description: 'Get the largest transactions for a period or date range.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['week', 'month', 'quarter', 'year'],
          },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 20,
            default: 10,
          },
        },
      },
      schema: timeframeWithLimitInputSchema,
      pages: ['expenses-analytics'],
      execute: async (arguments_, context) => {
        const timeframe = this.resolveTimeframe(arguments_)
        if (timeframe.kind === 'period') {
          return this.expensesService.getLargestTransactions(
            context.userId,
            timeframe.period,
            arguments_.limit,
          )
        }

        return this.expensesService.getLargestTransactionsForDateRange(
          context.userId,
          timeframe.startDate,
          timeframe.endDate,
          arguments_.limit,
        )
      },
    }
  }

  private createExpensePeriodComparisonTool(): AiToolDefinition<z.infer<typeof periodOnlyInputSchema>> {
    return {
      name: 'getExpensePeriodComparison',
      description: 'Compare the current standard period with the previous equivalent period.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['week', 'month', 'quarter', 'year'],
          },
        },
        required: ['period'],
      },
      schema: periodOnlyInputSchema,
      pages: ['expenses-analytics'],
      execute: async (arguments_, context) => {
        return this.expensesService.getPeriodComparison(context.userId, arguments_.period)
      },
    }
  }

  private createPortfolioSummaryTool(): AiToolDefinition<Record<string, never>> {
    return {
      name: 'getPortfolioSummary',
      description: 'Get portfolio totals, asset allocation, and platform breakdown for the user investment portfolio.',
      parameters: {
        type: 'object',
        properties: {},
      },
      schema: z.object({}),
      pages: ['holdings-overview', 'dividends-overview', 'principal-overview'],
      execute: async (_arguments_, context) => {
        const summary = await this.holdingsService.getPortfolioSummary(context.userId)

        return {
          ...summary,
          platformIntelligence: summary.platformBreakdown.map((platform) => ({
            ...platform,
            normalizedPlatform: this.domainIntelligenceService.normalizePlatform(platform.platform),
          })),
          assetTypeIntelligence: summary.assetTypeBreakdown.map((assetType) => ({
            ...assetType,
            normalizedAssetType: this.domainIntelligenceService.normalizeAssetType(assetType.assetType),
          })),
        }
      },
    }
  }

  private createHoldingLookupTool(): AiToolDefinition<z.infer<typeof holdingLookupInputSchema>> {
    return {
      name: 'getHoldingDetails',
      description: 'Find a specific holding by company name or symbol and return position-level details, portfolio weight, and normalized classification. Use this for stock-specific questions.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Company name, fund name, or trading symbol to look up in the user portfolio.',
          },
        },
        required: ['query'],
      },
      schema: holdingLookupInputSchema,
      pages: ['holdings-overview', 'dividends-overview', 'principal-overview'],
      execute: async (arguments_, context) => {
        const [holdings, portfolioSummary] = await Promise.all([
          this.holdingsService.getHoldings(context.userId),
          this.holdingsService.getPortfolioSummary(context.userId),
        ])

        const normalizeLookupValue = (value: string) => value
          .toLowerCase()
          .replaceAll(/[^a-z0-9\s]/g, ' ')
          .replaceAll(/\b(ltd|limited|inc|corp|corporation|co|company|plc|llc)\b/g, ' ')
          .replaceAll(/\s+/g, ' ')
          .trim()

        const queryTokens = normalizeLookupValue(arguments_.query)
          .split(' ')
          .filter(Boolean)

        const rankedMatches = holdings
          .map((holding) => {
            const symbol = normalizeLookupValue(holding.symbol)
            const name = normalizeLookupValue(holding.name)
            const exactSymbolMatch = symbol === normalizeLookupValue(arguments_.query)
            const exactNameMatch = name === normalizeLookupValue(arguments_.query)
            const partialSymbolMatch = symbol.includes(normalizeLookupValue(arguments_.query))
            const partialNameMatch = name.includes(normalizeLookupValue(arguments_.query))
            const matchingTokenCount = queryTokens.filter(
              (token) => name.includes(token) || symbol.includes(token),
            ).length
            const tokenCoverage = queryTokens.length > 0
              ? matchingTokenCount / queryTokens.length
              : 0

            let score = 0
            if (exactSymbolMatch) score += 100
            if (exactNameMatch) score += 95
            if (partialSymbolMatch) score += 60
            if (partialNameMatch) score += 55
            score += matchingTokenCount * 12
            if (tokenCoverage >= 0.6) score += 25
            if (tokenCoverage >= 0.8) score += 20

            return {
              holding,
              score,
              tokenCoverage,
            }
          })
          .filter((match) => match.score > 0 && match.tokenCoverage >= 0.34)
          .sort((left, right) => right.score - left.score)

        const topMatch = rankedMatches[0]?.holding
        const candidates = rankedMatches.slice(0, 5).map((match) => match.holding)

        if (!topMatch) {
          return {
            found: false,
            query: arguments_.query,
            candidates: [],
          }
        }

        const investedValue = Number(topMatch.investedValue)
        const currentValue = Number(topMatch.currentValue ?? topMatch.investedValue)
        const totalReturns = Number(topMatch.totalReturns ?? 0)
        const returnsPercentage = Number(topMatch.returnsPercentage ?? 0)
        const portfolioWeightPercent = portfolioSummary.totalCurrentValue > 0
          ? (currentValue / portfolioSummary.totalCurrentValue) * 100
          : 0

        return {
          found: true,
          query: arguments_.query,
          holding: {
            id: topMatch.id,
            symbol: topMatch.symbol,
            name: topMatch.name,
            assetType: topMatch.assetType,
            platform: topMatch.platform,
            normalizedAssetType: this.domainIntelligenceService.normalizeAssetType(topMatch.assetType),
            normalizedPlatform: this.domainIntelligenceService.normalizePlatform(topMatch.platform ?? 'Unknown'),
            quantity: Number(topMatch.quantity),
            avgBuyPrice: Number(topMatch.avgBuyPrice),
            currentPrice: Number(topMatch.currentPrice ?? topMatch.avgBuyPrice),
            investedValue,
            currentValue,
            totalReturns,
            returnsPercentage,
            portfolioWeightPercent: Number(portfolioWeightPercent.toFixed(2)),
          },
          candidates: candidates.map((holding) => ({
            symbol: holding.symbol,
            name: holding.name,
            assetType: holding.assetType,
            platform: holding.platform,
          })),
        }
      },
    }
  }

  private createDividendDashboardTool(): AiToolDefinition<z.infer<typeof investmentYearInputSchema>> {
    return {
      name: 'getDividendDashboard',
      description: 'Get dividend growth, monthly trend, concentration, and yield analysis for a given year.',
      parameters: {
        type: 'object',
        properties: {
          year: {
            type: 'number',
            description: 'Calendar year to inspect. Defaults to the current year if omitted.',
          },
        },
      },
      schema: investmentYearInputSchema,
      pages: ['holdings-overview', 'dividends-overview', 'principal-overview'],
      execute: async (arguments_, context) => {
        return this.dividendsService.getDashboard(
          context.userId,
          arguments_.year ?? getYear(new Date()),
        )
      },
    }
  }

  private createInvestmentIntelligenceTool(): AiToolDefinition<z.infer<typeof investmentYearInputSchema>> {
    return {
      name: 'getInvestmentIntelligence',
      description: 'Synthesize holdings, dividends, and principal contribution data into higher-level investment insights, platform role inference, concentration signals, and growth observations.',
      parameters: {
        type: 'object',
        properties: {
          year: {
            type: 'number',
            description: 'Calendar year for dividend analysis. Defaults to the current year if omitted.',
          },
        },
      },
      schema: investmentYearInputSchema,
      pages: ['holdings-overview', 'dividends-overview', 'principal-overview'],
      execute: async (arguments_, context) => {
        const selectedYear = arguments_.year ?? getYear(new Date())
        const [portfolioSummary, holdings, dividendDashboard, principalAnalytics] = await Promise.all([
          this.holdingsService.getPortfolioSummary(context.userId),
          this.holdingsService.getHoldings(context.userId),
          this.dividendsService.getDashboard(context.userId, selectedYear),
          this.principalService.getAnalytics(context.userId),
        ])

        const platforms = portfolioSummary.platformBreakdown
          .map((platform) => ({
            platform: platform.platform,
            normalizedPlatform: this.domainIntelligenceService.normalizePlatform(platform.platform),
            inferredRole: this.domainIntelligenceService.normalizePlatform(platform.platform).role,
            investedValue: platform.investedValue,
            currentValue: platform.currentValue,
            returns: platform.returns,
            returnsPercentage: platform.returnsPercentage,
            count: platform.count,
          }))
          .sort((left, right) => right.investedValue - left.investedValue)

        const topHoldings = holdings
          .map((holding) => {
            const investedValue = Number(holding.investedValue)
            const currentValue = Number(holding.currentValue ?? holding.investedValue)
            const totalReturns = Number(holding.totalReturns ?? 0)

            return {
              symbol: holding.symbol,
              name: holding.name,
              assetType: holding.assetType,
              platform: holding.platform ?? 'Unknown',
              normalizedAssetType: this.domainIntelligenceService.normalizeAssetType(holding.assetType),
              normalizedPlatform: this.domainIntelligenceService.normalizePlatform(holding.platform ?? 'Unknown'),
              investedValue,
              currentValue,
              totalReturns,
              returnsPercentage: investedValue > 0 ? (totalReturns / investedValue) * 100 : 0,
            }
          })
          .sort((left, right) => right.currentValue - left.currentValue)
          .slice(0, 5)
          .map((holding) => ({
            ...holding,
            portfolioWeightPercent: portfolioSummary.totalCurrentValue > 0
              ? (holding.currentValue / portfolioSummary.totalCurrentValue) * 100
              : 0,
          }))

        const brokerPlatforms = platforms.filter((platform) => platform.inferredRole === 'broker')
        const topDividendCompany = dividendDashboard.perCompany[0]
        const highestAllocation = principalAnalytics?.distributionMetrics.allocations[0]
        const strongestAssetType = portfolioSummary.assetTypeBreakdown[0]

        const signals = [
          brokerPlatforms.length > 0
            ? {
                category: 'platform-classification',
                statement: `${brokerPlatforms.map((platform) => platform.platform).join(', ')} look like broker platforms in your investment stack.`,
                evidence: brokerPlatforms.map((platform) => ({
                  platform: platform.platform,
                  inferredRole: platform.inferredRole,
                  investedValue: platform.investedValue,
                })),
              }
            : null,
          topHoldings[0]
            ? {
                category: 'concentration',
                statement: `${topHoldings[0].name} is your largest visible holding at ${topHoldings[0].portfolioWeightPercent.toFixed(1)}% of current portfolio value.`,
                evidence: topHoldings.slice(0, 3).map((holding) => ({
                  symbol: holding.symbol,
                  portfolioWeightPercent: Number(holding.portfolioWeightPercent.toFixed(2)),
                  currentValue: holding.currentValue,
                })),
              }
            : null,
          topDividendCompany
            ? {
                category: 'dividend-concentration',
                statement: `${topDividendCompany.companyName} is the top dividend contributor for ${selectedYear}.`,
                evidence: {
                  companyName: topDividendCompany.companyName,
                  normalizedIssuer: this.domainIntelligenceService.normalizeIssuer(topDividendCompany.companyName),
                  totalAmount: topDividendCompany.totalAmount,
                  payoutCount: topDividendCompany.payoutCount,
                },
              }
            : null,
          principalAnalytics
            ? {
                category: 'contribution-discipline',
                statement: `Principal contribution consistency is ${principalAnalytics.contributionMetrics.consistencyScore.toFixed(1)} out of 100.`,
                evidence: {
                  averageMonthlyLakhs: principalAnalytics.contributionMetrics.averageMonthlyLakhs,
                  trendIncreasing: principalAnalytics.contributionMetrics.trendIncreasing,
                  largestIncrease: principalAnalytics.contributionMetrics.largestIncrease,
                  largestDrop: principalAnalytics.contributionMetrics.largestDrop,
                },
              }
            : null,
          highestAllocation
            ? {
                category: 'allocation-bias',
                statement: `${highestAllocation.name} is the biggest principal allocation bucket right now.`,
                evidence: highestAllocation,
              }
            : null,
          strongestAssetType
            ? {
                category: 'asset-mix',
                statement: `${strongestAssetType.assetType} is the largest asset bucket in the current portfolio mix.`,
                evidence: strongestAssetType,
              }
            : null,
        ].filter((signal): signal is NonNullable<typeof signal> => signal !== null)

        return {
          selectedYear,
          portfolioSummary,
          platformIntelligence: platforms,
          topHoldings,
          dividendSnapshot: {
            currentYearTotal: dividendDashboard.yearlyGrowth.currentYearTotal,
            previousYearTotal: dividendDashboard.yearlyGrowth.previousYearTotal,
            growthPercent: dividendDashboard.yearlyGrowth.growthPercent,
            topCompanies: dividendDashboard.perCompany.slice(0, 5),
            repeatPayouts: dividendDashboard.repeatPayouts.slice(0, 5),
            yieldCoverageCount: dividendDashboard.yieldAnalysis.length,
          },
          principalSnapshot: principalAnalytics
            ? {
                contributionMetrics: principalAnalytics.contributionMetrics,
                distributionMetrics: principalAnalytics.distributionMetrics,
                milestones: principalAnalytics.milestones.slice(0, 5),
              }
            : null,
          signals,
        }
      },
    }
  }

  private createPrincipalAnalyticsTool(): AiToolDefinition<Record<string, never>> {
    return {
      name: 'getPrincipalAnalytics',
      description: 'Get contribution, allocation, and milestone analytics for principal investments.',
      parameters: {
        type: 'object',
        properties: {},
      },
      schema: z.object({}),
      pages: ['principal-overview', 'holdings-overview', 'dividends-overview'],
      execute: async (_arguments_, context) => {
        return this.principalService.getAnalytics(context.userId)
      },
    }
  }

  private createFlightAnalyticsTool(): AiToolDefinition<Record<string, never>> {
    return {
      name: 'getFlightAnalytics',
      description: 'Get high-level travel analytics including airline, route, airport, and timeline insights.',
      parameters: {
        type: 'object',
        properties: {},
      },
      schema: z.object({}),
      pages: ['flights-overview'],
      execute: async (_arguments_, context) => {
        const analytics = await this.flightAnalyticsService.getAnalytics(context.userId)

        return {
          ...analytics,
          breakdowns: {
            ...analytics.breakdowns,
            airlineDistribution: analytics.breakdowns.airlineDistribution.map((item) => ({
              ...item,
              normalizedAirline: this.domainIntelligenceService.normalizeAirline(item.airline),
            })),
          },
        }
      },
    }
  }

  private createHotelStaySummaryTool(): AiToolDefinition<{ includeArchived?: boolean }> {
    return {
      name: 'getHotelStaySummary',
      description: 'Summarize hotel stays, locations, upcoming reservations, and provider patterns.',
      parameters: {
        type: 'object',
        properties: {
          includeArchived: {
            type: 'boolean',
            description: 'Whether archived hotel stays should be included in the summary.',
          },
        },
      },
      schema: z.object({ includeArchived: z.boolean().optional() }),
      pages: ['hotels-overview'],
      execute: async (arguments_, context) => {
        const result = await this.analyticsDslService.execute({
          domain: 'hotels',
          queryType: 'summary',
          includeArchived: arguments_.includeArchived,
        }, context.userId)

        return result
      },
    }
  }

  private createAnalyticsDslTool(): AiToolDefinition<z.infer<typeof analyticsDslQuerySchema>> {
    return {
      name: 'runAnalyticsQuery',
      description: 'Run a constrained analytics DSL query for long-tail questions. Supported domains are expenses, holdings, dividends, principal, flights, and hotels. Use this when curated tools do not cover the question directly.',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            enum: ['expenses', 'holdings', 'dividends', 'principal', 'flights', 'hotels'],
          },
          queryType: {
            type: 'string',
            enum: ['summary', 'breakdown', 'top-items', 'trend'],
          },
          dimension: { type: 'string' },
          metric: { type: 'string' },
          period: {
            type: 'string',
            enum: ['week', 'month', 'quarter', 'year'],
          },
          year: { type: 'number' },
          limit: { type: 'number', minimum: 1, maximum: 25, default: 10 },
          includeArchived: { type: 'boolean' },
          filters: {
            type: 'object',
            properties: {
              assetType: { type: 'string' },
              platform: { type: 'string' },
            },
          },
        },
        required: ['domain'],
      },
      schema: analyticsDslQuerySchema,
      pages: ['expenses-analytics', 'holdings-overview', 'dividends-overview', 'principal-overview', 'flights-overview', 'hotels-overview'],
      execute: async (arguments_, context) => {
        return this.analyticsDslService.execute(arguments_, context.userId)
      },
    }
  }
}

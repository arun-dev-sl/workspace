import type { AiAssistantPageContext } from '@/features/ai-assistant/api/assistant'
import type { PrincipalAnalytics } from '@workspace/domain'

type PrincipalPageContextInput = {
  analytics: PrincipalAnalytics
}

export function buildPrincipalPageContext(
  input: PrincipalPageContextInput,
): AiAssistantPageContext {
  return {
    pageId: 'principal-overview',
    title: 'Principal Investments',
    route: '/expenses/patterns',
    description:
      'Principal investment analytics covering contribution cadence, allocation mix, and milestone projections.',
    filters: {
      tab: 'principal',
    },
    dataSnapshot: {
      visibleWidgets: ['contribution-kpis', 'monthly-trend', 'cumulative-series', 'allocation-donut', 'milestones'],
      summary: {
        totalLakhs: input.analytics.contributionMetrics.totalLakhs,
        averageMonthlyLakhs: input.analytics.contributionMetrics.averageMonthlyLakhs,
        consistencyScore: input.analytics.contributionMetrics.consistencyScore,
        totalPortfolioValue: input.analytics.distributionMetrics.totalPortfolioValue,
        topAllocation: input.analytics.distributionMetrics.allocations[0] ?? null,
        nextMilestone: input.analytics.milestones.find((milestone) => !milestone.achieved) ?? null,
      },
    },
  }
}
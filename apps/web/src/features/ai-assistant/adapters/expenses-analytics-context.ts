import { fetchSpendingSummary } from '@/features/expenses/api/analytics'

import type { AiAssistantPageContext } from '@/features/ai-assistant/api/assistant'
import type { AnalyticsPeriod } from '@workspace/domain'

type ExpensesAnalyticsContextInput = {
  period: AnalyticsPeriod
  summary?: Awaited<ReturnType<typeof fetchSpendingSummary>>
}

export function buildExpensesAnalyticsPageContext(
  input: ExpensesAnalyticsContextInput,
): AiAssistantPageContext {
  return {
    pageId: 'expenses-analytics',
    title: 'Expenses Analytics',
    route: "/analytics",
    description:
      'Aggregated spending dashboard with KPIs, trend charts, category breakdowns, merchant analysis, and milestone projections.',
    filters: {
      period: input.period,
    },
    dataSnapshot: {
      summary: input.summary
        ? {
            totalSpent: input.summary.totalSpent,
            totalReceived: input.summary.totalReceived,
            netFlow: input.summary.netFlow,
            transactionCount: input.summary.transactionCount,
            topCategory: input.summary.topCategory,
            topMerchant: input.summary.topMerchant,
          }
        : null,
      visibleWidgets: [
        'summary',
        'category-breakdown',
        'mode-breakdown',
        'top-merchants',
        'daily-trend',
        'monthly-trend',
        'by-card',
        'period-comparison',
        'largest-transactions',
        'velocity',
        'milestone-etas',
      ],
    },
  }
}
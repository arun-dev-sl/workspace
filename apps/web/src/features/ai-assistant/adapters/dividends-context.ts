import type { AiAssistantPageContext } from '@/features/ai-assistant/api/assistant'
import type { DividendDashboard } from '@workspace/domain'

type DividendsPageContextInput = {
  activeTab: string
  selectedYear: number
  dashboard?: DividendDashboard
}

export function buildDividendsPageContext(
  input: DividendsPageContextInput,
): AiAssistantPageContext {
  return {
    pageId: 'dividends-overview',
    title: 'Dividend Income',
    route: '/dividends',
    description:
      'Dividend dashboard with yearly growth, company concentration, monthly trend, repeat payouts, and yield analysis.',
    filters: {
      activeTab: input.activeTab,
      selectedYear: input.selectedYear,
    },
    dataSnapshot: {
      selectedYear: input.selectedYear,
      visibleWidgets: ['yearly-growth', 'monthly-trend', 'per-company', 'repeat-payouts', 'yield-analysis'],
      summary: input.dashboard
        ? {
            currentYearTotal: input.dashboard.yearlyGrowth.currentYearTotal,
            previousYearTotal: input.dashboard.yearlyGrowth.previousYearTotal,
            growthPercent: input.dashboard.yearlyGrowth.growthPercent,
            distinctCompanies: input.dashboard.distinctCompanies,
            totalPayouts: input.dashboard.totalPayouts,
            topCompany: input.dashboard.perCompany[0] ?? null,
          }
        : null,
    },
  }
}
import type { AiAssistantPageContext } from '@/features/ai-assistant/api/assistant'
import type { PortfolioSummary, Holding } from '@workspace/domain'

type HoldingsPageContextInput = {
  activeTab: string
  holdings: Holding[]
  portfolioSummary?: PortfolioSummary
}

export function buildHoldingsPageContext(
  input: HoldingsPageContextInput,
): AiAssistantPageContext {
  return {
    pageId: 'holdings-overview',
    title: 'Investment Allocation',
    route: '/holdings',
    description:
      'Portfolio view covering holdings, allocation, returns, and platform usage across investment accounts.',
    filters: {
      activeTab: input.activeTab,
    },
    dataSnapshot: {
      holdingsCount: input.holdings.length,
      activeAssetType: input.activeTab,
      visibleWidgets: ['portfolio-summary', 'asset-type-tabs', 'holdings-table'],
      portfolioSummary: input.portfolioSummary
        ? {
            totalInvestedValue: input.portfolioSummary.totalInvestedValue,
            totalCurrentValue: input.portfolioSummary.totalCurrentValue,
            totalReturns: input.portfolioSummary.totalReturns,
            totalReturnsPercentage: input.portfolioSummary.totalReturnsPercentage,
            topAssetType: input.portfolioSummary.assetTypeBreakdown[0] ?? null,
            topPlatform: input.portfolioSummary.platformBreakdown[0] ?? null,
          }
        : null,
    },
  }
}
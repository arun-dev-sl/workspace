import { Wallet, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@workspace/ui/components/ui/card'
import { useMemo } from 'react'

import { useAiPageContext } from '@/features/ai-assistant/ai-assistant-context'
import { buildPrincipalPageContext } from '@/features/ai-assistant/adapters/principal-context'
import { usePrincipalAnalytics } from '../api/principal'

import { ImportPrincipalDialog } from './import-principal-dialog'
import { PrincipalKpiCards } from './principal-kpi-cards'
import { MonthlyInvestmentChart } from './monthly-investment-chart'
import { CumulativeInvestmentChart } from './cumulative-investment-chart'
import { AssetDonutChart } from './asset-donut-chart'
import { MilestoneProjectionsTable } from './milestone-projections-table'
import { InvestmentInsights } from './investment-insights'
import { ContributionsTable } from './contributions-table'
import { DistributionTable } from './distribution-table'

// ── Empty State ──

function PrincipalEmptyState() {
  return (
    <Card className="py-16">
      <CardContent className="flex flex-col items-center justify-center text-center">
        <Wallet className="text-muted-foreground mb-4 h-12 w-12" />
        <h3 className="text-lg font-semibold">
          No principal investment data yet
        </h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          Paste your monthly investment contributions and asset distribution to
          see analytics, charts, and milestone projections.
        </p>
        <div className="mt-6">
          <ImportPrincipalDialog />
        </div>
      </CardContent>
    </Card>
  )
}

// ── Loading State ──

function PrincipalLoadingState() {
  return (
    <Card className="py-16">
      <CardContent className="flex flex-col items-center justify-center text-center">
        <Loader2 className="text-muted-foreground mb-4 h-10 w-10 animate-spin" />
        <p className="text-muted-foreground text-sm">
          Loading investment data…
        </p>
      </CardContent>
    </Card>
  )
}

// ── Main Tab Component ──

export function PrincipalInvestmentTab() {
  const { data: analytics, isLoading } = usePrincipalAnalytics()
  const aiPageContext = useMemo(
    () => (analytics ? buildPrincipalPageContext({ analytics }) : null),
    [analytics],
  )

  // @ts-ignore
  useAiPageContext(aiPageContext)

  if (isLoading) {
    return <PrincipalLoadingState />
  }

  if (!analytics) {
    return <PrincipalEmptyState />
  }

  const { data, contributionMetrics, distributionMetrics, milestones } =
    analytics

  const hasContributions = data.contributions.length > 0
  const hasDistribution = data.distribution.length > 0

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Last updated:{' '}
          {new Date(data.updatedAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <ImportPrincipalDialog />
      </div>

      {/* KPI Cards */}
      {hasContributions && (
        <PrincipalKpiCards
          metrics={contributionMetrics}
          contributions={data.contributions}
        />
      )}

      {/* Charts Row 1: Monthly + Cumulative */}
      {hasContributions && (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <MonthlyInvestmentChart
            contributions={data.contributions}
            metrics={contributionMetrics}
          />
          <CumulativeInvestmentChart
            cumulativeSeries={contributionMetrics.cumulativeSeries}
          />
        </div>
      )}

      {/* Charts Row 2: Donut + Insights */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {hasDistribution && (
          <AssetDonutChart distribution={distributionMetrics} />
        )}
        {hasContributions && (
          <InvestmentInsights metrics={contributionMetrics} />
        )}
      </div>

      {/* Contributions Table (inline editable) */}
      <ContributionsTable contributions={data.contributions} />

      {/* Distribution Table (inline editable) */}
      <DistributionTable distribution={data.distribution} />

      {/* Milestone Projections */}
      {(hasContributions || hasDistribution) && (
        <MilestoneProjectionsTable
          milestones={milestones}
          currentPortfolio={distributionMetrics.totalPortfolioValue}
        />
      )}
    </div>
  )
}

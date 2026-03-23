import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Activity,
  Award,
} from 'lucide-react'
import { MetricTrendCard } from '@/components/metric-trend-card'
import { takeLastMetricTrendPoints } from '@/lib/metric-trends'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/ui/card'
import type {
  ContributionMetrics,
  PrincipalContributionRow,
} from '@workspace/domain'

const LAKHS = 100_000

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)

interface PrincipalKpiCardsProps {
  metrics: ContributionMetrics
  contributions: PrincipalContributionRow[]
}

export function PrincipalKpiCards({
  metrics,
  contributions,
}: PrincipalKpiCardsProps) {
  const cumulativeTrend = takeLastMetricTrendPoints(
    metrics.cumulativeSeries.map((item) => ({
      label: item.label,
      value: item.cumulative,
    })),
  )
  const contributionTrend = takeLastMetricTrendPoints(
    contributions.map((item) => ({
      label: item.label,
      value: item.amountLakhs,
    })),
  )

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Principal */}
      <MetricTrendCard
        title="Total Principal Invested"
        value={fmtCurrency(metrics.totalINR)}
        icon={<IndianRupee className="text-primary h-4 w-4" />}
        description={`${metrics.totalLakhs.toFixed(2)}L across ${metrics.cumulativeSeries.length} months`}
        descriptionClassName="text-muted-foreground text-xs"
        valueClassName="text-2xl font-bold"
        trendData={cumulativeTrend}
        trendLabel="Recent cumulative"
        formatTrendValue={(value) => `${value.toFixed(2)}L`}
      />

      {/* Average Monthly */}
      <MetricTrendCard
        title="Avg Monthly Contribution"
        value={fmtCurrency(metrics.averageMonthlyLakhs * LAKHS)}
        icon={
          metrics.trendIncreasing ? (
            <TrendingUp className="text-primary h-4 w-4" />
          ) : (
            <TrendingDown className="text-primary h-4 w-4" />
          )
        }
        description={`${metrics.averageMonthlyLakhs.toFixed(2)}L per month`}
        descriptionClassName="text-muted-foreground text-xs"
        valueClassName="text-2xl font-bold"
        trendData={contributionTrend}
        trendLabel="Recent contributions"
        formatTrendValue={(value) => `${value.toFixed(2)}L`}
      />

      {/* Best Month */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Best Month</CardTitle>
          <span data-slot="badge">
            <Award className="text-primary h-4 w-4" />
          </span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {fmtCurrency(metrics.highestMonth.amountLakhs * LAKHS)}
          </div>
          <p className="text-muted-foreground text-xs">
            {metrics.highestMonth.label} — worst: {metrics.lowestMonth.label} (
            {metrics.lowestMonth.amountLakhs.toFixed(2)}L)
          </p>
        </CardContent>
      </Card>

      {/* Consistency Score */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Consistency Score
          </CardTitle>
          <span data-slot="badge">
            <Activity className="text-primary h-4 w-4" />
          </span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(metrics.consistencyScore * 100).toFixed(0)}%
          </div>
          <p className="text-muted-foreground text-xs">
            {metrics.consistencyScore >= 0.7
              ? 'Great consistency!'
              : metrics.consistencyScore >= 0.4
                ? 'Moderate consistency'
                : 'Highly variable'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

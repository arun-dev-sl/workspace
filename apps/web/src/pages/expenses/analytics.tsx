import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'

import { MainLayout } from '@/components/layouts'
import { useAiPageContext } from '@/features/ai-assistant/ai-assistant-context'
import { buildExpensesAnalyticsPageContext } from '@/features/ai-assistant/adapters/expenses-analytics-context'
import {
  fetchSpendingSummary,
  fetchSpendingByCategory,
  fetchSpendingByMode,
  fetchTopMerchants,
  fetchDailySpending,
  fetchMonthlyTrend,
  fetchSpendingByCard,
  fetchDayOfWeekSpending,
  fetchCategoryTrend,
  fetchPeriodComparison,
  fetchCumulativeSpend,
  fetchSavingsRate,
  fetchCardCategories,
  fetchTopVpas,
  fetchSpendingVelocity,
  fetchMilestoneEtas,
  fetchLargestTransactions,
} from '@/features/expenses/api/analytics'
import { useSyncJob } from '@/features/expenses/hooks/use-sync-job'

import type {
  AnalyticsPeriod,
  CardCategoryItem,
  MilestoneEta,
  MilestoneProgress,
  PeriodComparison,
} from '@workspace/domain'

import { Badge } from '@workspace/ui/components/ui/badge'
import { Button } from '@workspace/ui/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@workspace/ui/components/ui/chart'
import { Skeleton } from '@workspace/ui/components/ui/skeleton'
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CreditCard,
  Gauge,
  Layers,
  PiggyBank,
  Receipt,
  RotateCw,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { Separator } from '@workspace/ui/components/ui/separator'

// ── Helpers ──

const PERIODS: { label: string; value: AnalyticsPeriod }[] = [
  { label: '7 days', value: 'week' },
  { label: '30 days', value: 'month' },
  { label: '90 days', value: 'quarter' },
  { label: '1 year', value: 'year' },
]

const CHART_TOKEN_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

const getChartTokenColor = (index: number) =>
  CHART_TOKEN_COLORS[index % CHART_TOKEN_COLORS.length]!

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)

const fmtCompact = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)

// ── Component ──

const AnalyticsPage = () => {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')
  const queryClient = useQueryClient()

  const { startReprocess, job, isSyncing } = useSyncJob({
    onComplete: () => {
      // Refresh all analytics queries after reprocess
      queryClient.invalidateQueries({ queryKey: ['expenses', 'analytics'] })
    },
  })

  const summaryQ = useQuery({
    queryKey: ['expenses', 'analytics', 'summary', period],
    queryFn: () => fetchSpendingSummary(period),
  })

  const categoryQ = useQuery({
    queryKey: ['expenses', 'analytics', 'by-category', period],
    queryFn: () => fetchSpendingByCategory(period),
  })

  const modeQ = useQuery({
    queryKey: ['expenses', 'analytics', 'by-mode', period],
    queryFn: () => fetchSpendingByMode(period),
  })

  const merchantQ = useQuery({
    queryKey: ['expenses', 'analytics', 'top-merchants', period],
    queryFn: () => fetchTopMerchants(period),
  })

  const dailyQ = useQuery({
    queryKey: ['expenses', 'analytics', 'daily', period],
    queryFn: () => fetchDailySpending(period),
  })

  const trendQ = useQuery({
    queryKey: ['expenses', 'analytics', 'monthly-trend'],
    queryFn: () => fetchMonthlyTrend(12),
  })

  const cardQ = useQuery({
    queryKey: ['expenses', 'analytics', 'by-card', period],
    queryFn: () => fetchSpendingByCard(period),
  })

  // ── Extended analytics queries ──

  const dayOfWeekQ = useQuery({
    queryKey: ['expenses', 'analytics', 'day-of-week', period],
    queryFn: () => fetchDayOfWeekSpending(period),
  })

  const categoryTrendQ = useQuery({
    queryKey: ['expenses', 'analytics', 'category-trend'],
    queryFn: () => fetchCategoryTrend(6),
  })

  const periodComparisonQ = useQuery({
    queryKey: ['expenses', 'analytics', 'period-comparison', period],
    queryFn: () => fetchPeriodComparison(period),
  })

  const cumulativeQ = useQuery({
    queryKey: ['expenses', 'analytics', 'cumulative', period],
    queryFn: () => fetchCumulativeSpend(period),
  })

  const savingsRateQ = useQuery({
    queryKey: ['expenses', 'analytics', 'savings-rate'],
    queryFn: () => fetchSavingsRate(6),
  })

  const cardCategoriesQ = useQuery({
    queryKey: ['expenses', 'analytics', 'card-categories', period],
    queryFn: () => fetchCardCategories(period),
  })

  const topVpasQ = useQuery({
    queryKey: ['expenses', 'analytics', 'top-vpas', period],
    queryFn: () => fetchTopVpas(period, 10),
  })

  const velocityQ = useQuery({
    queryKey: ['expenses', 'analytics', 'velocity', period],
    queryFn: () => fetchSpendingVelocity(period),
  })

  const milestoneEtaQ = useQuery({
    queryKey: ['expenses', 'analytics', 'milestone-etas'],
    queryFn: () => fetchMilestoneEtas(),
  })

  const largestQ = useQuery({
    queryKey: ['expenses', 'analytics', 'largest', period],
    queryFn: () => fetchLargestTransactions(period, 10),
  })

  const aiPageContext = useMemo(
    () =>
      buildExpensesAnalyticsPageContext({
        period,
        summary: summaryQ.data,
      }),
    [period, summaryQ.data],
  )

  useAiPageContext(aiPageContext)

  const summary = summaryQ.data

  const categoryChartData = (categoryQ.data ?? []).map((category, index) => ({
    ...category,
    chartColor: getChartTokenColor(index),
  }))

  const modeChartData = (modeQ.data ?? []).map((mode, index) => ({
    ...mode,
    chartColor: getChartTokenColor(index),
  }))

  const cardChartData = (cardQ.data ?? []).map((card, index) => ({
    ...card,
    chartColor: getChartTokenColor(index),
  }))

  // ── Chart configs ──

  const dailyChartConfig: ChartConfig = {
    debited: { label: 'Spent', color: 'var(--color-chart-1)' },
    credited: { label: 'Received', color: 'var(--color-chart-2)' },
  }

  const trendChartConfig: ChartConfig = {
    debited: { label: 'Spent', color: 'var(--color-chart-1)' },
    credited: { label: 'Received', color: 'var(--color-chart-2)' },
    net: { label: 'Net', color: 'var(--color-chart-3)' },
  }

  // Build category pie chart config
  const categoryChartConfig: ChartConfig = Object.fromEntries(
    categoryChartData.map((c) => [
      c.category,
      { label: c.displayName, color: c.chartColor },
    ]),
  )

  const modeChartConfig: ChartConfig = Object.fromEntries(
    modeChartData.map((m) => [
      m.mode,
      {
        label: m.mode.replace(/_/g, ' '),
        color: m.chartColor,
      },
    ]),
  )

  // ── Extended chart configs ──

  const dayOfWeekConfig: ChartConfig = {
    amount: { label: 'Spent', color: 'var(--color-chart-1)' },
  }

  const cumulativeConfig: ChartConfig = {
    cumulative: { label: 'Cumulative Spend', color: 'var(--color-chart-1)' },
  }

  const savingsRateConfig: ChartConfig = {
    income: { label: 'Income', color: 'var(--color-chart-2)' },
    expenses: { label: 'Expenses', color: 'var(--color-chart-1)' },
    savingsRate: { label: 'Savings Rate %', color: 'var(--color-chart-3)' },
  }

  const velocityConfig: ChartConfig = {
    velocity: { label: '₹/day (7d avg)', color: 'var(--color-chart-4)' },
  }

  // Build category trend config from the data
  const trendCategories = [
    ...new Set((categoryTrendQ.data ?? []).map((d) => d.category)),
  ]
  const categoryTrendConfig: ChartConfig = Object.fromEntries(
    trendCategories.map((cat, i) => [
      cat,
      {
        label: cat.replace(/_/g, ' '),
        color: getChartTokenColor(i),
      },
    ]),
  )

  // Pivot category trend data for multi-line chart: { month, cat1: amount, cat2: amount, ... }
  const categoryTrendPivoted = (() => {
    const byMonth = new Map<string, Record<string, number>>()
    for (const item of categoryTrendQ.data ?? []) {
      if (!byMonth.has(item.month)) byMonth.set(item.month, {})
      byMonth.get(item.month)![item.category] = item.amount
    }
    return [...byMonth.entries()]
      .map(([month, cats]) => ({ month, ...cats }))
      .sort((a, b) => a.month.localeCompare(b.month))
  })()

  return (
    <MainLayout>
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        {/* Header */}
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Expenses
            </p>
            <h1 className="text-2xl font-semibold text-foreground">
              Analytics
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Spending patterns, category breakdowns and trends.
            </p>
          </div>{' '}
          {/* Period selector */}
          <div className="flex flex-wrap items-center gap-2">
            {PERIODS.map((p) => (
              <Button
                key={p.value}
                variant={period === p.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}

            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={startReprocess}
                disabled={isSyncing}
              >
                <RotateCw className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing && job?.totalEmails
                  ? `Reprocessing (${job.processedEmails}/${job.totalEmails})`
                  : job?.status === 'completed'
                    ? 'Reprocessed ✓'
                    : 'Reprocess Emails'}
              </Button>
            </div>
          </div>
        </header>

        {/* ── Summary cards ── */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Spent"
            value={summary ? fmtCurrency(summary.totalSpent) : undefined}
            icon={<ArrowDownRight className="size-4 text-red-500" />}
            subtitle={
              summary ? `${summary.transactionCount} transactions` : undefined
            }
            loading={summaryQ.isLoading}
          />
          <SummaryCard
            title="Total Received"
            value={summary ? fmtCurrency(summary.totalReceived) : undefined}
            icon={<ArrowUpRight className="size-4 text-emerald-500" />}
            subtitle={
              summary ? `Net flow: ${fmtCurrency(summary.netFlow)}` : undefined
            }
            loading={summaryQ.isLoading}
          />
          <SummaryCard
            title="Avg Transaction"
            value={summary ? fmtCurrency(summary.avgTransaction) : undefined}
            icon={<Receipt className="size-4 text-blue-500" />}
            subtitle={summary ? `Top: ${summary.topMerchant}` : undefined}
            loading={summaryQ.isLoading}
          />
          <SummaryCard
            title="Pending Review"
            value={summary ? String(summary.reviewPending) : undefined}
            icon={<TrendingDown className="size-4 text-amber-500" />}
            subtitle={
              summary
                ? `Top category: ${summary.topCategory.replace(/_/g, ' ')}`
                : undefined
            }
            loading={summaryQ.isLoading}
          />
        </div>

        {/* ── Charts row 1: Daily spending + Category pie ── */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Daily spending bar chart — 2 cols */}
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Daily Spending</CardTitle>
              <CardDescription>Debits &amp; credits per day</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyQ.isLoading ? (
                <Skeleton className="h-75 w-full" />
              ) : dailyQ.data && dailyQ.data.length > 0 ? (
                <ChartContainer
                  config={dailyChartConfig}
                  className="h-75 w-full"
                >
                  <BarChart data={dailyQ.data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => {
                        try {
                          return format(parseISO(v), 'dd MMM')
                        } catch {
                          return v
                        }
                      }}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={fmtCompact}
                      tickLine={false}
                      axisLine={false}
                      width={50}
                      fontSize={12}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">
                                {name === 'debited' ? 'Spent' : 'Received'}
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {fmtCurrency(Number(value))}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      dataKey="debited"
                      fill="var(--color-debited)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="credited"
                      fill="var(--color-credited)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No data for this period.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Category pie — 1 col */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By Category</CardTitle>
              <CardDescription>Where your money goes</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryQ.isLoading ? (
                <Skeleton className="mx-auto size-55 rounded-full" />
              ) : categoryChartData.length > 0 ? (
                <ChartContainer
                  config={categoryChartConfig}
                  chartType="pie"
                  className="mx-auto aspect-square h-80"
                >
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">
                                {String(name).replace(/_/g, ' ')}
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {fmtCurrency(Number(value))}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Pie
                      data={categoryChartData}
                      dataKey="amount"
                      nameKey="category"
                      innerRadius={55}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {categoryChartData.map((entry) => (
                        <Cell key={entry.category} fill={entry.chartColor} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent />} />
                  </PieChart>
                </ChartContainer>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No spending data.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Charts row 2: Monthly trend + Payment modes ── */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Monthly trend line chart — 2 cols */}
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Monthly Trend</CardTitle>
              <CardDescription>Last 12 months overview</CardDescription>
            </CardHeader>
            <CardContent>
              {trendQ.isLoading ? (
                <Skeleton className="h-75 w-full" />
              ) : trendQ.data && trendQ.data.length > 0 ? (
                <ChartContainer
                  config={trendChartConfig}
                  className="h-75 w-full"
                >
                  <LineChart data={trendQ.data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(v: string) => {
                        try {
                          return format(parseISO(`${v}-01`), 'MMM yy')
                        } catch {
                          return v
                        }
                      }}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={fmtCompact}
                      tickLine={false}
                      axisLine={false}
                      width={50}
                      fontSize={12}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">
                                {name === 'debited'
                                  ? 'Spent'
                                  : name === 'credited'
                                    ? 'Received'
                                    : 'Net'}
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {fmtCurrency(Number(value))}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      type="monotone"
                      dataKey="debited"
                      stroke="var(--color-debited)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="credited"
                      stroke="var(--color-credited)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="net"
                      stroke="var(--color-net)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No trend data yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Payment mode pie — 1 col */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Modes</CardTitle>
              <CardDescription>How you pay</CardDescription>
            </CardHeader>
            <CardContent>
              {modeQ.isLoading ? (
                <Skeleton className="mx-auto size-55 rounded-full" />
              ) : modeChartData.length > 0 ? (
                <ChartContainer
                  config={modeChartConfig}
                  chartType="pie"
                  className="mx-auto aspect-square h-65"
                >
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">
                                {String(name).replace(/_/g, ' ')}
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {fmtCurrency(Number(value))}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Pie
                      data={modeChartData}
                      dataKey="amount"
                      nameKey="mode"
                      innerRadius={55}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {modeChartData.map((entry) => (
                        <Cell key={entry.mode} fill={entry.chartColor} />
                      ))}
                    </Pie>
                    <ChartLegend
                      content={<ChartLegendContent nameKey="mode" />}
                    />
                  </PieChart>
                </ChartContainer>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No mode data.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Spending by Card ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Spending by Card</CardTitle>
                <CardDescription>
                  Track spend across your credit cards
                </CardDescription>
              </div>
            </div>
            <Separator className="w-full mt-2" />
          </CardHeader>
          <CardContent>
            {cardQ.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : cardChartData.length > 0 ? (
              <div className="space-y-4">
                {cardChartData.map((card) => {
                  const maxAmount = cardChartData[0]!.amount
                  const pct =
                    maxAmount > 0 ? (card.amount / maxAmount) * 100 : 0
                  return (
                    <div key={card.cardLast4} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="size-3 rounded-full"
                            style={{ backgroundColor: card.chartColor }}
                          />
                          <span className="text-sm font-medium">
                            {card.cardName}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            ••{card.cardLast4}
                          </Badge>
                          {card.bank && (
                            <span className="text-xs text-muted-foreground">
                              {card.bank}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="tabular-nums">
                            {card.count} txns
                          </Badge>
                          <span className="min-w-25 text-right text-sm font-semibold tabular-nums">
                            {fmtCurrency(card.amount)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: card.chartColor,
                          }}
                        />
                      </div>

                      {/* Milestone progress */}
                      {card.milestones && card.milestones.length > 0 && (
                        <MilestoneProgressSection
                          milestones={card.milestones}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No card spending data. Card details are extracted from credit
                card transaction emails.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Top Merchants ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Merchants</CardTitle>
            <CardDescription>Where you spend the most</CardDescription>
            <Separator className="w-full mt-2" />
          </CardHeader>
          <CardContent>
            {merchantQ.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : merchantQ.data && merchantQ.data.length > 0 ? (
              <div className="space-y-3">
                {merchantQ.data.map((m, i) => {
                  const maxAmount = merchantQ.data![0]!.amount
                  const pct = maxAmount > 0 ? (m.amount / maxAmount) * 100 : 0
                  return (
                    <div
                      key={m.merchant}
                      className="flex items-center gap-3 py-2"
                    >
                      <span className="w-5 text-xs text-muted-foreground">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{m.merchant}</span>
                          <span className="tabular-nums">
                            {fmtCurrency(m.amount)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/70 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <Badge variant="secondary" className="tabular-nums">
                        {m.count}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No merchant data.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Category table breakdown ── */}
        {categoryChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Category Breakdown</CardTitle>
              <CardDescription>Detailed spending per category</CardDescription>
              <Separator className="w-full mt-2" />
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {categoryChartData.map((c) => (
                  <div
                    key={c.category}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="size-3 rounded-full"
                        style={{ backgroundColor: c.chartColor }}
                      />
                      <span className="text-sm font-medium capitalize">
                        {c.displayName}
                      </span>
                      {c.parent && (
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize"
                        >
                          {c.parent}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary" className="tabular-nums">
                        {c.count} txns
                      </Badge>
                      <span className="min-w-25 text-right text-sm font-semibold tabular-nums">
                        {fmtCurrency(c.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ━━━━━━━━ Extended Analytics ━━━━━━━━ */}

        {/* ── Period-over-Period Comparison ── */}
        <PeriodComparisonSection
          data={periodComparisonQ.data}
          loading={periodComparisonQ.isLoading}
          period={period}
        />

        {/* ── Day-of-Week + Cumulative Spend ── */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Day-of-Week bar chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">
                    Day-of-Week Spending
                  </CardTitle>
                  <CardDescription>When do you spend the most?</CardDescription>
                </div>
              </div>
              <Separator className="w-full mt-2" />
            </CardHeader>
            <CardContent>
              {dayOfWeekQ.isLoading ? (
                <Skeleton className="h-60 w-full" />
              ) : dayOfWeekQ.data && dayOfWeekQ.data.length > 0 ? (
                <ChartContainer
                  config={dayOfWeekConfig}
                  className="h-60 w-full"
                >
                  <BarChart data={dayOfWeekQ.data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="dayName"
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={fmtCompact}
                      tickLine={false}
                      axisLine={false}
                      width={50}
                      fontSize={12}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">
                                Amount Spent
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {fmtCurrency(Number(value))}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar
                      dataKey="amount"
                      fill="var(--color-chart-1)"
                      radius={[4, 4, 0, 0]}
                    >
                      {(dayOfWeekQ.data ?? []).map((entry) => {
                        const maxAmt = Math.max(
                          ...(dayOfWeekQ.data ?? []).map((d) => d.amount),
                        )
                        const opacity =
                          maxAmt > 0 ? 0.4 + (entry.amount / maxAmt) * 0.6 : 0.5
                        return (
                          <Cell
                            key={entry.dayName}
                            fill="var(--color-chart-1)"
                            fillOpacity={opacity}
                          />
                        )
                      })}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No data for this period.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Cumulative spend area chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Cumulative Spend</CardTitle>
                  <CardDescription>
                    Running total over the period
                  </CardDescription>
                </div>
              </div>
              <Separator className="w-full mt-2" />
            </CardHeader>
            <CardContent>
              {cumulativeQ.isLoading ? (
                <Skeleton className="h-60 w-full" />
              ) : cumulativeQ.data && cumulativeQ.data.length > 0 ? (
                <ChartContainer
                  config={cumulativeConfig}
                  className="h-60 w-full"
                >
                  <AreaChart data={cumulativeQ.data}>
                    <defs>
                      <linearGradient
                        id="cumulativeFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="var(--color-chart-1)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--color-chart-1)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => {
                        try {
                          return format(parseISO(v), 'dd MMM')
                        } catch {
                          return v
                        }
                      }}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={fmtCompact}
                      tickLine={false}
                      axisLine={false}
                      width={50}
                      fontSize={12}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">
                                Cumulative Spend
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {fmtCurrency(Number(value))}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke="var(--color-chart-1)"
                      fill="url(#cumulativeFill)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No data for this period.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Category Trend + Savings Rate ── */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Category trend multi-line — 2 cols */}
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">
                    Category Trend (6m)
                  </CardTitle>
                  <CardDescription>Category spending over time</CardDescription>
                </div>
              </div>
              <Separator className="w-full mt-2" />
            </CardHeader>
            <CardContent>
              {categoryTrendQ.isLoading ? (
                <Skeleton className="h-75 w-full" />
              ) : categoryTrendPivoted.length > 0 ? (
                <ChartContainer
                  config={categoryTrendConfig}
                  className="h-75 w-full"
                >
                  <LineChart data={categoryTrendPivoted}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(v: string) => {
                        try {
                          return format(parseISO(`${v}-01`), 'MMM yy')
                        } catch {
                          return v
                        }
                      }}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={fmtCompact}
                      tickLine={false}
                      axisLine={false}
                      width={50}
                      fontSize={12}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">
                                {String(name).replace(/_/g, ' ')}
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {fmtCurrency(Number(value))}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    {trendCategories.map((cat, i) => (
                      <Line
                        key={cat}
                        type="monotone"
                        dataKey={cat}
                        stroke={getChartTokenColor(i)}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ChartContainer>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Not enough data for trends.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Savings rate — 1 col */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PiggyBank className="size-4 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Savings Rate</CardTitle>
                  <CardDescription>
                    Income vs expenses over time
                  </CardDescription>
                </div>
              </div>
              <Separator className="w-full mt-2" />
            </CardHeader>
            <CardContent>
              {savingsRateQ.isLoading ? (
                <Skeleton className="h-75 w-full" />
              ) : savingsRateQ.data && savingsRateQ.data.length > 0 ? (
                <ChartContainer
                  config={savingsRateConfig}
                  className="h-75 w-full"
                >
                  <ComposedChart data={savingsRateQ.data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(v: string) => {
                        try {
                          return format(parseISO(`${v}-01`), 'MMM')
                        } catch {
                          return v
                        }
                      }}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                    />
                    <YAxis
                      yAxisId="left"
                      tickFormatter={fmtCompact}
                      tickLine={false}
                      axisLine={false}
                      width={50}
                      fontSize={12}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(v: number) => `${v}%`}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                      fontSize={12}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">
                                {name === 'savingsRate'
                                  ? 'Savings Rate'
                                  : name === 'income'
                                    ? 'Income'
                                    : 'Expenses'}
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {name === 'savingsRate'
                                  ? `${Number(value).toFixed(1)}%`
                                  : fmtCurrency(Number(value))}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      yAxisId="left"
                      dataKey="income"
                      fill="var(--color-chart-2)"
                      radius={[4, 4, 0, 0]}
                      fillOpacity={0.7}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="expenses"
                      fill="var(--color-chart-1)"
                      radius={[4, 4, 0, 0]}
                      fillOpacity={0.7}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="savingsRate"
                      stroke="var(--color-chart-3)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ChartContainer>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Not enough months of data.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Spending Velocity ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gauge className="size-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Spending Velocity</CardTitle>
                <CardDescription>
                  7-day rolling average spend per day
                </CardDescription>
              </div>
            </div>
            <Separator className="w-full mt-2" />
          </CardHeader>
          <CardContent>
            {velocityQ.isLoading ? (
              <Skeleton className="h-60 w-full" />
            ) : velocityQ.data && velocityQ.data.length > 0 ? (
              <ChartContainer config={velocityConfig} className="h-60 w-full">
                <AreaChart data={velocityQ.data}>
                  <defs>
                    <linearGradient
                      id="velocityFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--color-chart-4)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-chart-4)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => {
                      try {
                        return format(parseISO(v), 'dd MMM')
                      } catch {
                        return v
                      }
                    }}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <YAxis
                    tickFormatter={fmtCompact}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                    fontSize={12}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                              Avg. Spend
                            </span>
                            <span className="font-mono font-medium tabular-nums">
                              {fmtCurrency(Number(value))}/day
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="velocity"
                    stroke="var(--color-chart-4)"
                    fill="url(#velocityFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Not enough data for velocity.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Top VPA Payees + Card Category Breakdown ── */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Top VPA Payees */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Top UPI Payees</CardTitle>
                  <CardDescription>Most-paid VPA addresses</CardDescription>
                </div>
              </div>
              <Separator className="w-full mt-2" />
            </CardHeader>
            <CardContent>
              {topVpasQ.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : topVpasQ.data && topVpasQ.data.length > 0 ? (
                <div className="space-y-3">
                  {topVpasQ.data.map((v, i) => {
                    const maxAmt = topVpasQ.data![0]!.amount
                    const pct = maxAmt > 0 ? (v.amount / maxAmt) * 100 : 0
                    return (
                      <div key={v.vpa} className="flex items-center gap-3">
                        <span className="w-5 text-xs text-muted-foreground">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="min-w-0 flex-1">
                              <span className="font-medium">{v.merchant}</span>
                              <p className="truncate text-xs text-muted-foreground">
                                {v.vpa}
                              </p>
                            </div>
                            <span className="ml-2 tabular-nums">
                              {fmtCurrency(v.amount)}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-muted">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: 'var(--color-chart-3)',
                              }}
                            />
                          </div>
                        </div>
                        <Badge variant="secondary" className="tabular-nums">
                          {v.count}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No UPI data available.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card Category Breakdown */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Card × Category</CardTitle>
                  <CardDescription>What you spend on per card</CardDescription>
                </div>
              </div>
              <Separator className="w-full mt-2" />
            </CardHeader>
            <CardContent>
              {cardCategoriesQ.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : cardCategoriesQ.data && cardCategoriesQ.data.length > 0 ? (
                <CardCategoryBreakdown data={cardCategoriesQ.data} />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No card category data.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Milestone ETAs ── */}
        {milestoneEtaQ.data && milestoneEtaQ.data.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="size-4 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">
                    Milestone ETA Forecast
                  </CardTitle>
                  <CardDescription>
                    Predicted completion based on current spend rate
                  </CardDescription>
                </div>
              </div>
              <Separator className="w-full mt-2" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {milestoneEtaQ.data.map((eta) => (
                  <MilestoneEtaCard key={eta.id} eta={eta} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Largest Transactions ── */}
        <Card className="gap-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="size-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">
                  Largest Transactions
                </CardTitle>
                <CardDescription>Biggest spends this period</CardDescription>
              </div>
            </div>
            <Separator className="w-full mt-2" />
          </CardHeader>
          <CardContent>
            {largestQ.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : largestQ.data && largestQ.data.length > 0 ? (
              <div className="divide-y">
                {largestQ.data.map((txn, i) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{txn.merchant}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {(() => {
                              try {
                                return format(
                                  parseISO(txn.transactionDate),
                                  'dd MMM yyyy',
                                )
                              } catch {
                                return txn.transactionDate
                              }
                            })()}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] capitalize"
                          >
                            {txn.displayName}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase"
                          >
                            {txn.transactionMode.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-red-500">
                      {fmtCurrency(txn.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No transactions for this period.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

// ── Subcomponents ──

function SummaryCard({
  title,
  value,
  icon,
  subtitle,
  loading,
}: {
  title: string
  value?: string
  icon: React.ReactNode
  subtitle?: string
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <span data-slot="badge">{icon}</span>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-28" />
        ) : (
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        )}
        {loading ? (
          <Skeleton className="mt-1 h-4 w-36" />
        ) : (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function MilestoneProgressSection({
  milestones,
}: {
  milestones: MilestoneProgress[]
}) {
  const getMilestoneColor = (pct: number) => {
    if (pct >= 100) return 'var(--color-chart-2)' // green / success
    if (pct >= 50) return 'var(--color-chart-4)' // amber / in-progress
    return 'var(--color-chart-5)' // muted / low
  }

  return (
    <div className="mt-2 ml-5 space-y-2.5 border-l-2 border-muted pl-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Target className="size-3" />
        <span>Milestones</span>
      </div>

      {milestones.map((m) => {
        const color = getMilestoneColor(m.percentage)
        return (
          <div key={m.id} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-foreground/80">
                  {m.description}
                </span>
                <Badge variant="outline" className="text-[9px] capitalize">
                  {m.type}
                </Badge>
              </div>
              <span
                className="text-xs font-semibold tabular-nums"
                style={{ color }}
              >
                {m.percentage.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, m.percentage)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <span className="min-w-20 text-right text-[10px] tabular-nums text-muted-foreground">
                {fmtCurrency(m.currentSpend)} / {fmtCurrency(m.targetAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{m.periodLabel}</span>
              {m.remaining > 0 ? (
                <span>{fmtCurrency(m.remaining)} remaining</span>
              ) : (
                <span
                  className="font-medium"
                  style={{ color: 'var(--color-chart-2)' }}
                >
                  ✓ Milestone reached!
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Period Comparison ──

function PeriodComparisonSection({
  data,
  loading,
  period,
}: {
  data?: PeriodComparison
  loading: boolean
  period: AnalyticsPeriod
}) {
  const metrics = data
    ? [
        {
          label: 'Total Spent',
          current: data.currentPeriod.totalSpent,
          change: data.changes.spentChange,
          invert: true, // negative change is good
        },
        {
          label: 'Total Received',
          current: data.currentPeriod.totalReceived,
          change: data.changes.receivedChange,
          invert: false,
        },
        {
          label: 'Transaction Count',
          current: data.currentPeriod.transactionCount,
          change: data.changes.countChange,
          invert: false,
          isCurrency: false,
        },
        {
          label: 'Avg Transaction',
          current: data.currentPeriod.avgTransaction,
          change: data.changes.avgChange,
          invert: true,
        },
      ]
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Period Comparison</CardTitle>
        <CardDescription>
          Current {period} vs previous {period}
        </CardDescription>
        <Separator className="w-full mt-2" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : data ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m) => {
              const isPositive = m.change > 0
              const isGood = m.invert ? !isPositive : isPositive
              const isCurrency = m.isCurrency !== false
              return (
                <div
                  data-slot="badge"
                  key={m.label}
                  className="rounded-lg border p-4 space-y-1"
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    {m.label}
                  </p>
                  <p className="text-xl font-bold tabular-nums">
                    {isCurrency
                      ? fmtCurrency(m.current)
                      : m.current.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1">
                    {isPositive ? (
                      <ArrowUpRight
                        className={`size-3 ${isGood ? 'text-emerald-500' : 'text-red-500'}`}
                      />
                    ) : (
                      <ArrowDownRight
                        className={`size-3 ${isGood ? 'text-emerald-500' : 'text-red-500'}`}
                      />
                    )}
                    <span
                      className={`text-xs font-medium tabular-nums ${isGood ? 'text-emerald-500' : 'text-red-500'}`}
                    >
                      {Math.abs(m.change).toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      vs prev
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No comparison data.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Card × Category Breakdown ──

function CardCategoryBreakdown({ data }: { data: CardCategoryItem[] }) {
  // Group by card
  const byCard = new Map<
    string,
    { cardName: string; items: CardCategoryItem[] }
  >()
  for (const item of data) {
    if (!byCard.has(item.cardLast4)) {
      byCard.set(item.cardLast4, { cardName: item.cardName, items: [] })
    }
    byCard.get(item.cardLast4)!.items.push(item)
  }

  return (
    <div className="space-y-4">
      {[...byCard.entries()].map(([last4, { cardName, items }]) => {
        const total = items.reduce((s, i) => s + i.amount, 0)
        return (
          <div key={last4} className="space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="size-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{cardName}</span>
              <Badge variant="outline" className="text-[10px]">
                ••{last4}
              </Badge>
              <span className="ml-auto text-sm font-semibold tabular-nums">
                {fmtCurrency(total)}
              </span>
            </div>
            <div className="ml-5 space-y-1.5">
              {items.map((item) => {
                const pct = total > 0 ? (item.amount / total) * 100 : 0
                return (
                  <div key={item.category} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-foreground/80">
                        {item.displayName}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="text-[10px] tabular-nums"
                        >
                          {item.count}
                        </Badge>
                        <span className="min-w-16 text-right tabular-nums font-medium">
                          {fmtCurrency(item.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Milestone ETA Card ──

function MilestoneEtaCard({ eta }: { eta: MilestoneEta }) {
  const pctColor =
    eta.percentage >= 100
      ? 'var(--color-chart-2)'
      : eta.onTrack
        ? 'var(--color-chart-4)'
        : 'var(--color-chart-1)'

  return (
    <div data-slot="badge" className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{eta.description}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-[10px]">
              ••{eta.cardLast4}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {eta.cardName}
            </span>
          </div>
        </div>
        <span
          className="text-lg font-bold tabular-nums"
          style={{ color: pctColor }}
        >
          {eta.percentage.toFixed(0)}%
        </span>
      </div>

      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, eta.percentage)}%`,
            backgroundColor: pctColor,
          }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {fmtCurrency(eta.currentSpend)} / {fmtCurrency(eta.targetAmount)}
        </span>
        <span className="tabular-nums">{fmtCurrency(eta.dailyRate)}/day</span>
      </div>

      <div className="flex items-center justify-between text-xs">
        {eta.percentage >= 100 ? (
          <span
            className="font-medium"
            style={{ color: 'var(--color-chart-2)' }}
          >
            ✓ Milestone reached!
          </span>
        ) : eta.estimatedCompletionDate ? (
          <span className="text-muted-foreground">
            ETA:{' '}
            {(() => {
              try {
                return format(
                  parseISO(eta.estimatedCompletionDate),
                  'dd MMM yyyy',
                )
              } catch {
                return eta.estimatedCompletionDate
              }
            })()}
          </span>
        ) : (
          <span className="text-muted-foreground">No activity yet</span>
        )}
        {eta.daysRemaining !== null && eta.percentage < 100 && (
          <Badge
            variant={eta.onTrack ? 'secondary' : 'destructive'}
            className="text-[10px]"
          >
            {eta.onTrack ? `${eta.daysRemaining}d left` : 'Behind schedule'}
          </Badge>
        )}
      </div>
    </div>
  )
}

export default AnalyticsPage

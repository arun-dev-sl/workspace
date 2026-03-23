import type { ReactNode } from 'react'
import { Area, AreaChart, XAxis, YAxis } from 'recharts'

import type { MetricTrendPoint } from '@/lib/metric-trends'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@workspace/ui/components/ui/chart'
import { Skeleton } from '@workspace/ui/components/ui/skeleton'

interface MetricTrendCardProps {
  title: string
  value?: ReactNode
  icon: ReactNode
  description?: string
  descriptionClassName?: string
  loading?: boolean
  trendData?: MetricTrendPoint[]
  trendLabel?: string
  trendColor?: string
  formatTrendValue?: (value: number) => string
  className?: string
  valueClassName?: string
}

export function MetricTrendCard({
  title,
  value,
  icon,
  description,
  descriptionClassName = 'mt-2 text-sm text-muted-foreground',
  loading = false,
  trendData,
  trendLabel = 'Recent trend',
  trendColor = 'var(--color-chart-1)',
  formatTrendValue = (nextValue) => nextValue.toLocaleString(),
  className,
  valueClassName = 'text-2xl font-semibold text-foreground',
}: MetricTrendCardProps) {
  const chartConfig = {
    value: {
      label: trendLabel,
      color: trendColor,
    },
  } satisfies ChartConfig

  const hasTrend = Boolean(trendData && trendData.length > 0)

  return (
    <Card data-slot="badge" className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <span data-slot="badge">{icon}</span>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <div className={valueClassName}>{value}</div>
        )}

        {loading ? (
          <Skeleton className="mt-2 h-4 w-36" />
        ) : description ? (
          <p className={descriptionClassName}>{description}</p>
        ) : null}

        {loading ? (
          <Skeleton className="mt-4 h-16 w-full" />
        ) : hasTrend ? (
          <ChartContainer config={chartConfig} className="mt-4 h-16 w-full">
            <AreaChart
              data={trendData}
              margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
            >
              <XAxis dataKey="label" hide />
              <YAxis hide />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(label) => String(label)}
                    formatter={(nextValue) =>
                      formatTrendValue(Number(nextValue))
                    }
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                fill="var(--color-value)"
                fillOpacity={0.14}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        ) : null}
      </CardContent>
    </Card>
  )
}

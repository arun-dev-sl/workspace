import { ArrowDown, ArrowUp, Minus } from 'lucide-react'

interface MetricData {
  label: string
  value: string
  trend?: 'up' | 'down' | 'flat'
  change?: string
}

interface AssistantMetricCardProps {
  metric: MetricData
}

export function AssistantMetricCard({ metric }: AssistantMetricCardProps) {
  const TrendIcon = metric.trend === 'up' ? ArrowUp : metric.trend === 'down' ? ArrowDown : Minus
  const trendColor = metric.trend === 'up'
    ? 'text-emerald-600 dark:text-emerald-400'
    : metric.trend === 'down'
      ? 'text-red-600 dark:text-red-400'
      : 'text-muted-foreground'

  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{metric.label}</p>
        <p className="text-sm font-semibold text-foreground">{metric.value}</p>
      </div>
      {(metric.trend || metric.change) && (
        <div className={`flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
          {metric.trend && <TrendIcon className="size-3" />}
          {metric.change && <span>{metric.change}</span>}
        </div>
      )}
    </div>
  )
}

export function parseMetricBlock(raw: string): MetricData | null {
  try {
    const parsed = JSON.parse(raw.trim())
    if (parsed.label && parsed.value) return parsed as MetricData
  } catch {
    // not valid JSON
  }
  return null
}

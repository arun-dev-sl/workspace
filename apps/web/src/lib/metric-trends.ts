import { format, parse, subMonths } from 'date-fns'

export interface MetricTrendPoint {
  label: string
  value: number
}

export function normalizeRecentMonthlySeries<T>({
  entries,
  getMonthKey,
  getValue,
  months = 3,
  anchorMonthKey,
}: {
  entries: T[]
  getMonthKey: (entry: T) => string
  getValue: (entry: T) => number
  months?: number
  anchorMonthKey?: string
}): MetricTrendPoint[] {
  if (entries.length === 0) {
    return []
  }

  const monthlyTotals = new Map<string, number>()

  for (const entry of entries) {
    const monthKey = getMonthKey(entry)
    monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) ?? 0) + getValue(entry))
  }

  const latestMonthKey = anchorMonthKey ?? [...monthlyTotals.keys()].sort().at(-1)
  if (!latestMonthKey) {
    return []
  }

  const latestMonth = parse(latestMonthKey, 'yyyy-MM', new Date())

  return Array.from({ length: months }, (_, index) => {
    const month = subMonths(latestMonth, months - index - 1)
    const monthKey = format(month, 'yyyy-MM')

    return {
      label: format(month, 'MMM'),
      value: monthlyTotals.get(monthKey) ?? 0,
    }
  })
}

export function takeLastMetricTrendPoints(
  points: MetricTrendPoint[],
  count = 3,
): MetricTrendPoint[] {
  return points.slice(Math.max(points.length - count, 0))
}
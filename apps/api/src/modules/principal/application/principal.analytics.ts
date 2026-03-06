import type {
  PrincipalContributionDto,
  ContributionMetrics,
  DistributionMetrics,
  MilestoneProjection,
} from '@workspace/domain'

const LAKHS = 100_000

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stdDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const squaredDiffs = values.map((v) => (v - avg) ** 2)
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length)
}

export function computeContributionMetrics(
  contributions: PrincipalContributionDto[],
): ContributionMetrics {
  if (contributions.length === 0) {
    return {
      totalLakhs: 0,
      totalINR: 0,
      averageMonthlyLakhs: 0,
      highestMonth: { label: '—', amountLakhs: 0 },
      lowestMonth: { label: '—', amountLakhs: 0 },
      momChanges: [],
      consistencyScore: 0,
      cumulativeSeries: [],
      trendIncreasing: false,
      largestIncrease: null,
      largestDrop: null,
    }
  }

  const amounts = contributions.map((c) => c.amountLakhs)
  const totalLakhs = amounts.reduce((a, b) => a + b, 0)
  const avg = mean(amounts)

  let highest = contributions[0]!
  let lowest = contributions[0]!
  for (const c of contributions) {
    if (c.amountLakhs > highest.amountLakhs) highest = c
    if (c.amountLakhs < lowest.amountLakhs) lowest = c
  }

  const momChanges = contributions.map((c, i) => {
    if (i === 0) return { label: c.label, change: 0 }
    const prev = contributions[i - 1]!.amountLakhs
    const change = prev === 0 ? 0 : ((c.amountLakhs - prev) / prev) * 100
    return { label: c.label, change }
  })

  const sd = stdDeviation(amounts)
  const consistencyScore = avg === 0 ? 0 : Math.max(0, Math.min(1, 1 - sd / avg))

  let cumulative = 0
  const cumulativeSeries = contributions.map((c) => {
    cumulative += c.amountLakhs
    return { label: c.label, cumulative: Math.round(cumulative * 100) / 100 }
  })

  const mid = Math.floor(contributions.length / 2)
  const firstHalfAvg = mean(amounts.slice(0, mid))
  const secondHalfAvg = mean(amounts.slice(mid))
  const trendIncreasing = secondHalfAvg >= firstHalfAvg

  let largestIncrease: ContributionMetrics['largestIncrease'] = null
  let largestDrop: ContributionMetrics['largestDrop'] = null

  for (let i = 1; i < contributions.length; i++) {
    const diff = contributions[i]!.amountLakhs - contributions[i - 1]!.amountLakhs
    if (largestIncrease === null || diff > largestIncrease.change) {
      largestIncrease = { label: contributions[i]!.label, change: diff }
    }
    if (largestDrop === null || diff < largestDrop.change) {
      largestDrop = { label: contributions[i]!.label, change: diff }
    }
  }

  return {
    totalLakhs,
    totalINR: totalLakhs * LAKHS,
    averageMonthlyLakhs: Math.round(avg * 100) / 100,
    highestMonth: { label: highest.label, amountLakhs: highest.amountLakhs },
    lowestMonth: { label: lowest.label, amountLakhs: lowest.amountLakhs },
    momChanges,
    consistencyScore,
    cumulativeSeries,
    trendIncreasing,
    largestIncrease,
    largestDrop,
  }
}

export function computeDistributionMetrics(
  distribution: { name: string, value: number }[],
): DistributionMetrics {
  const totalPortfolioValue = distribution.reduce((a, d) => a + d.value, 0)

  const allocations = distribution.map((d) => ({
    name: d.name,
    value: d.value,
    percentage:
      totalPortfolioValue === 0
        ? 0
        : Math.round((d.value / totalPortfolioValue) * 1000) / 10,
  }))

  return { totalPortfolioValue, allocations }
}

const MILESTONES: { label: string, targetINR: number }[] = [
  { label: '50L', targetINR: 5_000_000 },
  { label: '1 Cr', targetINR: 10_000_000 },
  { label: '2 Cr', targetINR: 20_000_000 },
  { label: '5 Cr', targetINR: 50_000_000 },
  { label: '10 Cr', targetINR: 100_000_000 },
]

const ANNUAL_RETURN = 0.12
const MONTHLY_RETURN = ANNUAL_RETURN / 12

export function computeMilestoneProjections(
  avgMonthlyINR: number,
  currentPortfolioINR: number,
): MilestoneProjection[] {
  return MILESTONES.map(({ label, targetINR }) => {
    if (currentPortfolioINR >= targetINR) {
      return { label, targetINR, monthsToTarget: 0, yearsToTarget: 0, achieved: true }
    }

    let portfolio = currentPortfolioINR
    let months = 0
    const maxMonths = 100 * 12

    while (portfolio < targetINR && months < maxMonths) {
      portfolio = portfolio * (1 + MONTHLY_RETURN) + avgMonthlyINR
      months++
    }

    return {
      label,
      targetINR,
      monthsToTarget: months,
      yearsToTarget: Math.round((months / 12) * 10) / 10,
      achieved: false,
    }
  })
}

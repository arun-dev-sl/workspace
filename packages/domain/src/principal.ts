// ── Principal Investment Domain Types ──

export interface PrincipalContributionDto {
  month: string
  year: number
  amountLakhs: number
  salaryLakhs: number | null
  label: string
}

/** Contribution with DB id — used for CRUD operations */
export interface PrincipalContributionRow extends PrincipalContributionDto {
  id: string
}

/** Payload for creating / updating a single contribution */
export interface UpsertContributionPayload {
  month: string
  year: number
  amountLakhs: number
  salaryLakhs?: number | null
}

export interface PrincipalDistributionDto {
  name: string
  value: number
}

/** Distribution with DB id — used for CRUD operations */
export interface PrincipalDistributionRow extends PrincipalDistributionDto {
  id: string
}

/** Payload for creating / updating a single distribution entry */
export interface UpsertDistributionPayload {
  name: string
  value: number
}

export interface PrincipalData {
  contributions: PrincipalContributionRow[]
  distribution: PrincipalDistributionRow[]
  updatedAt: string
}

export interface ContributionMetrics {
  totalLakhs: number
  totalINR: number
  averageMonthlyLakhs: number
  highestMonth: { label: string; amountLakhs: number }
  lowestMonth: { label: string; amountLakhs: number }
  momChanges: { label: string; change: number }[]
  consistencyScore: number
  cumulativeSeries: { label: string; cumulative: number }[]
  trendIncreasing: boolean
  largestIncrease: { label: string; change: number } | null
  largestDrop: { label: string; change: number } | null
}

export interface DistributionMetrics {
  totalPortfolioValue: number
  allocations: {
    name: string
    value: number
    percentage: number
  }[]
}

export interface MilestoneProjection {
  label: string
  targetINR: number
  monthsToTarget: number
  yearsToTarget: number
  achieved: boolean
}

export interface PrincipalAnalytics {
  data: PrincipalData
  contributionMetrics: ContributionMetrics
  distributionMetrics: DistributionMetrics
  milestones: MilestoneProjection[]
}

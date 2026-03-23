import { z } from 'zod'

import { apiRequest } from '@/lib/api-client'
import {
  SpendingSummarySchema,
  SpendingByCategoryItemSchema,
  SpendingByModeItemSchema,
  SpendingByMerchantItemSchema,
  DailySpendingItemSchema,
  MonthlyTrendItemSchema,
  SpendingByCardItemSchema,
  DayOfWeekSpendingItemSchema,
  CategoryTrendItemSchema,
  PeriodComparisonSchema,
  CumulativeSpendItemSchema,
  SavingsRateItemSchema,
  CardCategoryItemSchema,
  TopVpaItemSchema,
  SpendingVelocityItemSchema,
  MilestoneEtaSchema,
  LargestTransactionItemSchema,
  type AnalyticsPeriod,
} from '@workspace/domain'

// ── Fetchers ──

export async function fetchSpendingSummary(period: AnalyticsPeriod) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/summary?period=${period}`,
  })
  return SpendingSummarySchema.parse(json)
}

export async function fetchSpendingSummaryForDate(date: string) {
  const params = new URLSearchParams({
    startDate: date,
    endDate: date,
  })

  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/summary?${params.toString()}`,
  })

  return SpendingSummarySchema.parse(json)
}

export async function fetchSpendingByCategory(period: AnalyticsPeriod) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/by-category?period=${period}`,
  })
  return z.array(SpendingByCategoryItemSchema).parse(json)
}

export async function fetchSpendingByMode(period: AnalyticsPeriod) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/by-mode?period=${period}`,
  })
  return z.array(SpendingByModeItemSchema).parse(json)
}

export async function fetchTopMerchants(period: AnalyticsPeriod, limit = 10) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/top-merchants?period=${period}&limit=${limit}`,
  })
  return z.array(SpendingByMerchantItemSchema).parse(json)
}

export async function fetchDailySpending(period: AnalyticsPeriod) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/daily?period=${period}`,
  })
  return z.array(DailySpendingItemSchema).parse(json)
}

export async function fetchMonthlyTrend(months = 12) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/monthly-trend?months=${months}`,
  })
  return z.array(MonthlyTrendItemSchema).parse(json)
}

export async function fetchSpendingByCard(period: AnalyticsPeriod) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/by-card?period=${period}`,
  })
  return z.array(SpendingByCardItemSchema).parse(json)
}

// ── Extended Analytics ──

export async function fetchDayOfWeekSpending(period: AnalyticsPeriod) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/day-of-week?period=${period}`,
  })
  return z.array(DayOfWeekSpendingItemSchema).parse(json)
}

export async function fetchCategoryTrend(months = 6) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/category-trend?months=${months}`,
  })
  return z.array(CategoryTrendItemSchema).parse(json)
}

export async function fetchPeriodComparison(period: AnalyticsPeriod) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/period-comparison?period=${period}`,
  })
  return PeriodComparisonSchema.parse(json)
}

export async function fetchCumulativeSpend(period: AnalyticsPeriod) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/cumulative?period=${period}`,
  })
  return z.array(CumulativeSpendItemSchema).parse(json)
}

export async function fetchSavingsRate(months = 6) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/savings-rate?months=${months}`,
  })
  return z.array(SavingsRateItemSchema).parse(json)
}

export async function fetchCardCategories(period: AnalyticsPeriod) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/card-categories?period=${period}`,
  })
  return z.array(CardCategoryItemSchema).parse(json)
}

export async function fetchTopVpas(period: AnalyticsPeriod, limit = 10) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/top-vpas?period=${period}&limit=${limit}`,
  })
  return z.array(TopVpaItemSchema).parse(json)
}

export async function fetchSpendingVelocity(period: AnalyticsPeriod) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/velocity?period=${period}`,
  })
  return z.array(SpendingVelocityItemSchema).parse(json)
}

export async function fetchMilestoneEtas() {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/milestone-etas`,
  })
  return z.array(MilestoneEtaSchema).parse(json)
}

export async function fetchLargestTransactions(
  period: AnalyticsPeriod,
  limit = 10,
) {
  const json = await apiRequest({
    method: 'GET',
    url: `/api/expenses/analytics/largest-transactions?period=${period}&limit=${limit}`,
  })
  return z.array(LargestTransactionItemSchema).parse(json)
}

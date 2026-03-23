import { Injectable } from '@nestjs/common'
import { differenceInCalendarDays, getMonth, getYear, parseISO } from 'date-fns'

import { AiDomainIntelligenceService } from '@/modules/ai-assistant/application/services/ai-domain-intelligence.service'
import { DividendsService } from '@/modules/dividends/application/services/dividends.service'
import { ExpensesService } from '@/modules/expenses/application/services/expenses.service'
import { FlightAnalyticsService } from '@/modules/flights/application/services/flight-analytics.service'
import { HoldingsService } from '@/modules/holdings/application/services/holdings.service'
import { HotelsService } from '@/modules/hotels/application/services/hotels.service'
import { PrincipalService } from '@/modules/principal/application/services/principal.service'

import type { AnalyticsPeriod, HotelStay } from '@workspace/domain'

export type AnalyticsDslDomain = 'expenses' | 'holdings' | 'dividends' | 'principal' | 'flights' | 'hotels'
export type AnalyticsDslQueryType = 'summary' | 'breakdown' | 'top-items' | 'trend'
export type AnalyticsDslQuery = {
  domain: AnalyticsDslDomain
  queryType: AnalyticsDslQueryType
  dimension?: string
  metric?: string
  period?: AnalyticsPeriod
  year?: number
  limit?: number
  includeArchived?: boolean
  filters?: {
    assetType?: string
    platform?: string
  }
}

@Injectable()
export class AiAnalyticsDslService {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly holdingsService: HoldingsService,
    private readonly dividendsService: DividendsService,
    private readonly principalService: PrincipalService,
    private readonly flightAnalyticsService: FlightAnalyticsService,
    private readonly hotelsService: HotelsService,
    private readonly intelligenceService: AiDomainIntelligenceService,
  ) {}

  async execute(query: AnalyticsDslQuery, userId: string): Promise<unknown> {
    switch (query.domain) {
      case 'expenses': {
        return this.executeExpensesQuery(query, userId)
      }
      case 'holdings': {
        return this.executeHoldingsQuery(query, userId)
      }
      case 'dividends': {
        return this.executeDividendsQuery(query, userId)
      }
      case 'principal': {
        return this.executePrincipalQuery(userId)
      }
      case 'flights': {
        return this.executeFlightsQuery(query, userId)
      }
      case 'hotels': {
        return this.executeHotelsQuery(query, userId)
      }
    }
  }

  private async executeExpensesQuery(query: AnalyticsDslQuery, userId: string): Promise<unknown> {
    const period = query.period ?? 'month'
    const limit = query.limit ?? 10

    if (query.queryType === 'summary') {
      return {
        plan: { domain: 'expenses', queryType: 'summary', period },
        result: await this.expensesService.getSpendingSummary(userId, period),
      }
    }

    if (query.queryType === 'breakdown') {
      if (query.dimension === 'mode') {
        return {
          plan: { domain: 'expenses', queryType: 'breakdown', dimension: 'mode', period },
          result: await this.expensesService.getSpendingByMode(userId, period),
        }
      }

      return {
        plan: { domain: 'expenses', queryType: 'breakdown', dimension: 'category', period },
        result: await this.expensesService.getSpendingByCategory(userId, period),
      }
    }

    if (query.queryType === 'trend') {
      if (query.dimension === 'month') {
        return {
          plan: { domain: 'expenses', queryType: 'trend', dimension: 'month' },
          result: await this.expensesService.getMonthlyTrend(userId, 12),
        }
      }

      return {
        plan: { domain: 'expenses', queryType: 'trend', dimension: 'day', period },
        result: await this.expensesService.getDailySpending(userId, period),
      }
    }

    if (query.dimension === 'transaction') {
      return {
        plan: { domain: 'expenses', queryType: 'top-items', dimension: 'transaction', period, limit },
        result: await this.expensesService.getLargestTransactions(userId, period, limit),
      }
    }

    return {
      plan: { domain: 'expenses', queryType: 'top-items', dimension: 'merchant', period, limit },
      result: await this.expensesService.getTopMerchants(userId, period, limit),
    }
  }

  private async executeHoldingsQuery(query: AnalyticsDslQuery, userId: string): Promise<unknown> {
    const summary = await this.holdingsService.getPortfolioSummary(userId)

    if (query.queryType === 'summary') {
      return {
        plan: { domain: 'holdings', queryType: 'summary' },
        result: {
          ...summary,
          platformBreakdown: summary.platformBreakdown.map((item) => ({
            ...item,
            normalizedPlatform: this.intelligenceService.normalizePlatform(item.platform),
          })),
          assetTypeBreakdown: summary.assetTypeBreakdown.map((item) => ({
            ...item,
            normalizedAssetType: this.intelligenceService.normalizeAssetType(item.assetType),
          })),
        },
      }
    }

    if (query.queryType === 'breakdown') {
      if (query.dimension === 'assetType') {
        return {
          plan: { domain: 'holdings', queryType: 'breakdown', dimension: 'assetType' },
          result: summary.assetTypeBreakdown.map((item) => ({
            ...item,
            normalizedAssetType: this.intelligenceService.normalizeAssetType(item.assetType),
          })),
        }
      }

      return {
        plan: { domain: 'holdings', queryType: 'breakdown', dimension: 'platform' },
        result: summary.platformBreakdown.map((item) => ({
          ...item,
          normalizedPlatform: this.intelligenceService.normalizePlatform(item.platform),
        })),
      }
    }

    const holdings = await this.holdingsService.getHoldings(userId)
    const filtered = holdings.filter((holding) => {
      const assetTypeMatch = !query.filters?.assetType || holding.assetType === query.filters.assetType
      const platformMatch = !query.filters?.platform || (holding.platform ?? 'Unknown') === query.filters.platform
      return assetTypeMatch && platformMatch
    })

    const result = filtered
      .map((holding) => ({
        symbol: holding.symbol,
        name: holding.name,
        assetType: holding.assetType,
        platform: holding.platform ?? 'Unknown',
        currentValue: Number(holding.currentValue ?? holding.investedValue),
        investedValue: Number(holding.investedValue),
        totalReturns: Number(holding.totalReturns ?? 0),
        normalizedPlatform: this.intelligenceService.normalizePlatform(holding.platform ?? 'Unknown'),
        normalizedAssetType: this.intelligenceService.normalizeAssetType(holding.assetType),
      }))
      .sort((left, right) => right.currentValue - left.currentValue)
      .slice(0, query.limit ?? 10)

    return {
      plan: { domain: 'holdings', queryType: 'top-items', dimension: 'holding', limit: query.limit ?? 10 },
      result,
    }
  }

  private async executeDividendsQuery(query: AnalyticsDslQuery, userId: string): Promise<unknown> {
    const year = query.year ?? getYear(new Date())
    const dashboard = await this.dividendsService.getDashboard(userId, year)

    if (query.queryType === 'summary') {
      return {
        plan: { domain: 'dividends', queryType: 'summary', year },
        result: dashboard.yearlyGrowth,
      }
    }

    if (query.queryType === 'trend') {
      return {
        plan: { domain: 'dividends', queryType: 'trend', dimension: 'month', year },
        result: dashboard.monthlyTrend,
      }
    }

    if (query.dimension === 'yield') {
      return {
        plan: { domain: 'dividends', queryType: query.queryType, dimension: 'yield', year },
        result: dashboard.yieldAnalysis.slice(0, query.limit ?? 10),
      }
    }

    return {
      plan: { domain: 'dividends', queryType: query.queryType, dimension: 'company', year, limit: query.limit ?? 10 },
      result: dashboard.perCompany.slice(0, query.limit ?? 10).map((item) => ({
        ...item,
        normalizedIssuer: this.intelligenceService.normalizeIssuer(item.companyName),
      })),
    }
  }

  private async executePrincipalQuery(userId: string): Promise<unknown> {
    const analytics = await this.principalService.getAnalytics(userId)

    return {
      plan: { domain: 'principal', queryType: 'summary' },
      result: analytics,
    }
  }

  private async executeFlightsQuery(query: AnalyticsDslQuery, userId: string): Promise<unknown> {
    const analytics = await this.flightAnalyticsService.getAnalytics(userId)

    if (query.queryType === 'summary') {
      return {
        plan: { domain: 'flights', queryType: 'summary' },
        result: analytics.overview,
      }
    }

    if (query.queryType === 'trend') {
      if (query.dimension === 'timeline') {
        return {
          plan: { domain: 'flights', queryType: 'trend', dimension: 'timeline', limit: query.limit ?? 10 },
          result: analytics.timeline.slice(0, query.limit ?? 10).map((item) => ({
            ...item,
            normalizedAirline: this.intelligenceService.normalizeAirline(item.airline),
          })),
        }
      }

      return {
        plan: { domain: 'flights', queryType: 'trend', dimension: 'year' },
        result: analytics.breakdowns.flightsByYear,
      }
    }

    if (query.dimension === 'airport') {
      return {
        plan: { domain: 'flights', queryType: query.queryType, dimension: 'airport', limit: query.limit ?? 10 },
        result: analytics.breakdowns.airportFrequency.slice(0, query.limit ?? 10),
      }
    }

    return {
      plan: { domain: 'flights', queryType: query.queryType, dimension: 'airline', limit: query.limit ?? 10 },
      result: analytics.breakdowns.airlineDistribution.slice(0, query.limit ?? 10).map((item) => ({
        ...item,
        normalizedAirline: this.intelligenceService.normalizeAirline(item.airline),
      })),
    }
  }

  private async executeHotelsQuery(query: AnalyticsDslQuery, userId: string): Promise<unknown> {
    const response = await this.hotelsService.listHotelStays({
      userId,
      limit: 200,
      offset: 0,
      includeArchived: query.includeArchived,
    })

    const stays = response.data
    if (query.queryType === 'summary') {
      return {
        plan: { domain: 'hotels', queryType: 'summary', includeArchived: Boolean(query.includeArchived) },
        result: this.buildHotelSummary(stays),
      }
    }

    if (query.queryType === 'trend') {
      const monthMap = new Map<string, number>()
      for (const stay of stays) {
        if (!stay.checkInDate) {
          continue
        }

        const date = parseISO(stay.checkInDate)
        const key = `${getYear(date)}-${String(getMonth(date) + 1).padStart(2, '0')}`
        monthMap.set(key, (monthMap.get(key) ?? 0) + 1)
      }

      return {
        plan: { domain: 'hotels', queryType: 'trend', dimension: 'checkInMonth' },
        result: [...monthMap.entries()]
          .map(([month, count]) => ({ month, count }))
          .sort((left, right) => left.month.localeCompare(right.month)),
      }
    }

    const grouped = new Map<string, { key: string, count: number, totalNights: number }>()
    for (const stay of stays) {
      const key = query.dimension === 'country'
        ? (stay.country ?? 'Unknown')
        : (query.dimension === 'hotel'
          ? stay.hotelName
          : (stay.city ?? 'Unknown'))

      const record = grouped.get(key) ?? { key, count: 0, totalNights: 0 }
      record.count += 1
      record.totalNights += stay.nights ?? this.estimateNights(stay)
      grouped.set(key, record)
    }

    return {
      plan: { domain: 'hotels', queryType: query.queryType, dimension: query.dimension ?? 'city', limit: query.limit ?? 10 },
      result: [...grouped.values()]
        .sort((left, right) => right.count - left.count)
        .slice(0, query.limit ?? 10)
        .map((item) => ({
          ...item,
          normalizedProvider: query.dimension === 'hotel'
            ? this.intelligenceService.normalizeHotelProvider(item.key)
            : null,
        })),
    }
  }

  private buildHotelSummary(stays: HotelStay[]) {
    const cities = new Set<string>()
    const countries = new Set<string>()
    const distinctHotelNames = new Map<string, { name: string, stayCount: number, totalNights: number, city: string | null, country: string | null, looksLikeLocation: boolean }>()
    let archivedCount = 0
    let geocodedCount = 0
    let upcomingCount = 0
    let totalNights = 0

    const today = new Date()
    for (const stay of stays) {
      if (stay.city) {
        cities.add(stay.city)
      }
      if (stay.country) {
        countries.add(stay.country)
      }
      if (stay.archivedAt) {
        archivedCount += 1
      }
      if (stay.lat !== null && stay.lng !== null) {
        geocodedCount += 1
      }
      if (stay.checkInDate && parseISO(stay.checkInDate) >= today) {
        upcomingCount += 1
      }
      const stayNights = stay.nights ?? this.estimateNights(stay)
      totalNights += stayNights

      const normalizedHotelName = stay.hotelName.trim()
      if (normalizedHotelName.length > 0) {
        const locationSignals = [stay.city, stay.country]
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim().toLowerCase())
        const normalizedLowerName = normalizedHotelName.toLowerCase()
        const looksLikeLocation = locationSignals.includes(normalizedLowerName)
        const existing = distinctHotelNames.get(normalizedLowerName) ?? {
          name: normalizedHotelName,
          stayCount: 0,
          totalNights: 0,
          city: stay.city,
          country: stay.country,
          looksLikeLocation,
        }

        existing.stayCount += 1
        existing.totalNights += stayNights
        existing.city ??= stay.city
        existing.country ??= stay.country
        existing.looksLikeLocation = existing.looksLikeLocation || looksLikeLocation
        distinctHotelNames.set(normalizedLowerName, existing)
      }
    }

    const hotelNames = [...distinctHotelNames.values()]
      .sort((left, right) => {
        if (right.stayCount !== left.stayCount) {
          return right.stayCount - left.stayCount
        }

        return right.totalNights - left.totalNights
      })

    return {
      totalStays: stays.length,
      archivedCount,
      geocodedCount,
      upcomingCount,
      uniqueCities: cities.size,
      uniqueCountries: countries.size,
      totalNights,
      averageNightsPerStay: stays.length > 0 ? totalNights / stays.length : 0,
      distinctHotelCount: hotelNames.length,
      hotelNames,
      likelyLocationOnlyEntries: hotelNames.filter((item) => item.looksLikeLocation),
    }
  }

  private estimateNights(stay: HotelStay): number {
    if (!stay.checkInDate || !stay.checkOutDate) {
      return 0
    }

    try {
      return Math.max(0, differenceInCalendarDays(parseISO(stay.checkOutDate), parseISO(stay.checkInDate)))
    } catch {
      return 0
    }
  }
}

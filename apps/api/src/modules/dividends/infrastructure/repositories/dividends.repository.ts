import { Inject, Injectable } from '@nestjs/common'
import { dividendsTable } from '@workspace/database'
import { eq, and, sql, between, desc } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared/infrastructure/db/db.port'

import type { DividendsRepositoryPort } from '@/modules/dividends/application/ports/dividends.repository.port'
import type { DrizzleDb } from '@/shared/infrastructure/db/db.port'
import type { Dividend } from '@workspace/database'
import type { DividendDashboard, MonthlyDividend, CompanyDividend, YieldAnalysisItem, RepeatPayoutItem, LifetimeCompanyDividend } from '@workspace/domain'

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

@Injectable()
export class DividendsRepository implements DividendsRepositoryPort {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  async findByUserId(userId: string): Promise<Dividend[]> {
    return this.db
      .select()
      .from(dividendsTable)
      .where(eq(dividendsTable.userId, userId))
      .orderBy(desc(dividendsTable.exDate))
  }

  async findByPeriod(userId: string, from: string, to: string): Promise<Dividend[]> {
    return this.db
      .select()
      .from(dividendsTable)
      .where(
        and(
          eq(dividendsTable.userId, userId),
          between(dividendsTable.exDate, from, to),
        ),
      )
      .orderBy(desc(dividendsTable.exDate))
  }

  async upsertMany(
    userId: string,
    entries: {
      companyName: string
      isin: string
      exDate: string
      shares: number
      dividendPerShare: string
      amount: string
      reportPeriodFrom: string | null
      reportPeriodTo: string | null
    }[],
  ): Promise<{ imported: number, updated: number }> {
    let imported = 0
    let updated = 0

    for (const entry of entries) {
      const result = await this.db
        .insert(dividendsTable)
        .values({
          userId,
          companyName: entry.companyName,
          isin: entry.isin,
          exDate: entry.exDate,
          shares: entry.shares,
          dividendPerShare: entry.dividendPerShare,
          amount: entry.amount,
          reportPeriodFrom: entry.reportPeriodFrom,
          reportPeriodTo: entry.reportPeriodTo,
        })
        .onConflictDoUpdate({
          target: [dividendsTable.userId, dividendsTable.isin, dividendsTable.exDate],
          set: {
            companyName: sql`EXCLUDED.company_name`,
            shares: sql`EXCLUDED.shares`,
            dividendPerShare: sql`EXCLUDED.dividend_per_share`,
            amount: sql`EXCLUDED.amount`,
            reportPeriodFrom: sql`EXCLUDED.report_period_from`,
            reportPeriodTo: sql`EXCLUDED.report_period_to`,
          },
        })
        .returning({ id: dividendsTable.id, createdAt: dividendsTable.createdAt, updatedAt: dividendsTable.updatedAt })

      if (result[0]) {
        // If createdAt ≈ updatedAt (within 1s) it's a fresh insert, else update
        const r = result[0]
        const diff = Math.abs(new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime())
        if (diff < 1000) {
          imported++
        } else {
          updated++
        }
      }
    }

    return { imported, updated }
  }

  async updateInvestedValue(id: string, userId: string, investedValue: string): Promise<Dividend> {
    const [updated] = await this.db
      .update(dividendsTable)
      .set({ investedValue })
      .where(and(eq(dividendsTable.id, id), eq(dividendsTable.userId, userId)))
      .returning()

    if (!updated) {
      throw new Error('Dividend entry not found')
    }
    return updated
  }

  async deleteOne(id: string, userId: string): Promise<void> {
    await this.db
      .delete(dividendsTable)
      .where(and(eq(dividendsTable.id, id), eq(dividendsTable.userId, userId)))
  }

  async getDashboard(userId: string, year: number): Promise<DividendDashboard> {
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`
    const prevYearStart = `${year - 1}-01-01`
    const prevYearEnd = `${year - 1}-12-31`

    // ── Yearly totals ──
    const [currentYearRow] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${dividendsTable.amount} AS NUMERIC)), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(dividendsTable)
      .where(
        and(
          eq(dividendsTable.userId, userId),
          between(dividendsTable.exDate, yearStart, yearEnd),
        ),
      )

    const [prevYearRow] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${dividendsTable.amount} AS NUMERIC)), 0)`,
      })
      .from(dividendsTable)
      .where(
        and(
          eq(dividendsTable.userId, userId),
          between(dividendsTable.exDate, prevYearStart, prevYearEnd),
        ),
      )

    const currentYearTotal = Number(currentYearRow?.total ?? 0)
    const previousYearTotal = Number(prevYearRow?.total ?? 0)
    const absoluteIncrease = currentYearTotal - previousYearTotal
    const growthPercent = previousYearTotal > 0
      ? (absoluteIncrease / previousYearTotal) * 100
      : (currentYearTotal > 0 ? 100 : 0)

    // ── All-time stats ──
    const [allTimeRow] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${dividendsTable.amount} AS NUMERIC)), 0)`,
        companies: sql<number>`COUNT(DISTINCT ${dividendsTable.isin})`,
        payouts: sql<number>`COUNT(*)`,
      })
      .from(dividendsTable)
      .where(eq(dividendsTable.userId, userId))

    // ── Lifetime per-company totals (all-time) ──
    const lifetimePerCompanyRows = await this.db
      .select({
        companyName: dividendsTable.companyName,
        isin: dividendsTable.isin,
        totalAmount: sql<number>`COALESCE(SUM(CAST(${dividendsTable.amount} AS NUMERIC)), 0)`,
      })
      .from(dividendsTable)
      .where(eq(dividendsTable.userId, userId))
      .groupBy(dividendsTable.companyName, dividendsTable.isin)
      .orderBy(sql`SUM(CAST(${dividendsTable.amount} AS NUMERIC)) DESC`)

    const lifetimePerCompany: LifetimeCompanyDividend[] = lifetimePerCompanyRows.map((r) => ({
      companyName: r.companyName,
      isin: r.isin,
      totalAmount: Number(r.totalAmount),
    }))

    // ── Per-company totals (current year) ──
    const perCompanyRows = await this.db
      .select({
        companyName: dividendsTable.companyName,
        isin: dividendsTable.isin,
        totalAmount: sql<number>`COALESCE(SUM(CAST(${dividendsTable.amount} AS NUMERIC)), 0)`,
        payoutCount: sql<number>`COUNT(*)`,
        avgDividendPerShare: sql<number>`COALESCE(AVG(CAST(${dividendsTable.dividendPerShare} AS NUMERIC)), 0)`,
        totalShares: sql<number>`COALESCE(SUM(${dividendsTable.shares}), 0)`,
      })
      .from(dividendsTable)
      .where(
        and(
          eq(dividendsTable.userId, userId),
          between(dividendsTable.exDate, yearStart, yearEnd),
        ),
      )
      .groupBy(dividendsTable.companyName, dividendsTable.isin)
      .orderBy(sql`SUM(CAST(${dividendsTable.amount} AS NUMERIC)) DESC`)

    const perCompany: CompanyDividend[] = perCompanyRows.map((r) => ({
      companyName: r.companyName,
      isin: r.isin,
      totalAmount: Number(r.totalAmount),
      payoutCount: Number(r.payoutCount),
      avgDividendPerShare: Number(r.avgDividendPerShare),
      totalShares: Number(r.totalShares),
    }))

    // ── Monthly trend (current year) ──
    const monthlyRows = await this.db
      .select({
        month: sql<number>`EXTRACT(MONTH FROM ${dividendsTable.exDate})`,
        totalAmount: sql<number>`COALESCE(SUM(CAST(${dividendsTable.amount} AS NUMERIC)), 0)`,
        entryCount: sql<number>`COUNT(*)`,
      })
      .from(dividendsTable)
      .where(
        and(
          eq(dividendsTable.userId, userId),
          between(dividendsTable.exDate, yearStart, yearEnd),
        ),
      )
      .groupBy(sql`EXTRACT(MONTH FROM ${dividendsTable.exDate})`)
      .orderBy(sql`EXTRACT(MONTH FROM ${dividendsTable.exDate})`)

    // Fill all 12 months
    const monthlyMap = new Map(
      monthlyRows.map((r) => [Number(r.month), { totalAmount: Number(r.totalAmount), entryCount: Number(r.entryCount) }]),
    )
    const monthlyTrend: MonthlyDividend[] = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const data = monthlyMap.get(m)
      return {
        month: m,
        monthName: MONTH_NAMES[m]!,
        totalAmount: data?.totalAmount ?? 0,
        entryCount: data?.entryCount ?? 0,
      }
    })

    const monthsWithData = monthlyTrend.filter((m) => m.totalAmount > 0).length
    const monthlyAverage = monthsWithData > 0 ? currentYearTotal / monthsWithData : 0

    // ── Yield analysis (rows w/ invested_value) ──
    const yieldRows = await this.db
      .select({
        companyName: dividendsTable.companyName,
        isin: dividendsTable.isin,
        totalDividend: sql<number>`COALESCE(SUM(CAST(${dividendsTable.amount} AS NUMERIC)), 0)`,
        investedValue: sql<number>`COALESCE(SUM(CAST(${dividendsTable.investedValue} AS NUMERIC)), 0)`,
      })
      .from(dividendsTable)
      .where(
        and(
          eq(dividendsTable.userId, userId),
          between(dividendsTable.exDate, yearStart, yearEnd),
          sql`${dividendsTable.investedValue} IS NOT NULL`,
        ),
      )
      .groupBy(dividendsTable.companyName, dividendsTable.isin)
      .orderBy(sql`SUM(CAST(${dividendsTable.amount} AS NUMERIC)) DESC`)

    const yieldAnalysis: YieldAnalysisItem[] = yieldRows
      .filter((r) => Number(r.investedValue) > 0)
      .map((r) => ({
        companyName: r.companyName,
        isin: r.isin,
        totalDividend: Number(r.totalDividend),
        investedValue: Number(r.investedValue),
        yieldPercent: (Number(r.totalDividend) / Number(r.investedValue)) * 100,
      }))

    // ── Repeat payouts (companies w/ 2+ payouts, current year) ──
    const repeatRows = await this.db
      .select({
        companyName: dividendsTable.companyName,
        isin: dividendsTable.isin,
        payoutCount: sql<number>`COUNT(*)`,
        totalAmount: sql<number>`COALESCE(SUM(CAST(${dividendsTable.amount} AS NUMERIC)), 0)`,
        exDates: sql<string>`ARRAY_AGG(${dividendsTable.exDate}::TEXT ORDER BY ${dividendsTable.exDate})`,
      })
      .from(dividendsTable)
      .where(
        and(
          eq(dividendsTable.userId, userId),
          between(dividendsTable.exDate, yearStart, yearEnd),
        ),
      )
      .groupBy(dividendsTable.companyName, dividendsTable.isin)
      .having(sql`COUNT(*) >= 2`)
      .orderBy(sql`COUNT(*) DESC`)

    const repeatPayouts: RepeatPayoutItem[] = repeatRows.map((r) => ({
      companyName: r.companyName,
      isin: r.isin,
      payoutCount: Number(r.payoutCount),
      totalAmount: Number(r.totalAmount),
      exDates: typeof r.exDates === 'string'
        ? r.exDates.replaceAll(/[{}]/g, '').split(',')
        : (Array.isArray(r.exDates)
            ? (r.exDates as string[])
            : []),
    }))

    // ── Top stocks (top 10 by amount, current year) ──
    const topStocks = perCompany.slice(0, 10)

    return {
      yearlyGrowth: {
        currentYear: year,
        currentYearTotal,
        previousYearTotal,
        growthPercent: Math.round(growthPercent * 100) / 100,
        absoluteIncrease: Math.round(absoluteIncrease * 100) / 100,
      },
      perCompany,
      monthlyTrend,
      monthlyAverage: Math.round(monthlyAverage * 100) / 100,
      yieldAnalysis,
      repeatPayouts,
      topStocks,
      totalDividendAllTime: Number(allTimeRow?.total ?? 0),
      distinctCompanies: Number(allTimeRow?.companies ?? 0),
      totalPayouts: Number(allTimeRow?.payouts ?? 0),
      lifetimePerCompany,
    }
  }
}

import type { Dividend } from '@workspace/database'
import type { DividendDashboard } from '@workspace/domain'

export interface DividendsRepositoryPort {
  findByUserId(userId: string): Promise<Dividend[]>
  findByPeriod(userId: string, from: string, to: string): Promise<Dividend[]>
  upsertMany(
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
  ): Promise<{ imported: number, updated: number }>
  updateInvestedValue(id: string, userId: string, investedValue: string): Promise<Dividend>
  deleteOne(id: string, userId: string): Promise<void>
  getDashboard(userId: string, year: number): Promise<DividendDashboard>
}

export const DIVIDENDS_REPOSITORY = Symbol('DIVIDENDS_REPOSITORY')

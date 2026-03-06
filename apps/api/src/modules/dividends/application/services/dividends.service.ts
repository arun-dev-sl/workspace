import { Inject, Injectable, BadRequestException } from '@nestjs/common'
import { DividendReportSchema } from '@workspace/domain'

import { DIVIDENDS_REPOSITORY } from '@/modules/dividends/application/ports/dividends.repository.port'

import type { DividendsRepositoryPort } from '@/modules/dividends/application/ports/dividends.repository.port'
import type { Dividend } from '@workspace/database'
import type { DividendDashboard } from '@workspace/domain'

@Injectable()
export class DividendsService {
  constructor(
    @Inject(DIVIDENDS_REPOSITORY)
    private readonly dividendsRepository: DividendsRepositoryPort,
  ) {}

  async getDividends(userId: string): Promise<Dividend[]> {
    return this.dividendsRepository.findByUserId(userId)
  }

  async getDashboard(userId: string, year?: number): Promise<DividendDashboard> {
    const resolvedYear = year ?? new Date().getFullYear()
    return this.dividendsRepository.getDashboard(userId, resolvedYear)
  }

  async importReport(
    userId: string,
    jsonString: string,
  ): Promise<{ imported: number, updated: number, errors: string[] }> {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonString)
    } catch {
      throw new BadRequestException('Invalid JSON')
    }

    const result = DividendReportSchema.safeParse(parsed)
    if (!result.success) {
      const messages = result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`,
      )
      throw new BadRequestException(messages)
    }

    const report = result.data

    const entries = report.entries.map((e) => ({
      companyName: e.companyName,
      isin: e.isin,
      exDate: e.exDate,
      shares: e.shares,
      dividendPerShare: e.dividendPerShare.toFixed(4),
      amount: e.amount.toFixed(2),
      reportPeriodFrom: report.reportPeriod.from,
      reportPeriodTo: report.reportPeriod.to,
    }))

    const { imported, updated } = await this.dividendsRepository.upsertMany(userId, entries)

    return { imported, updated, errors: [] }
  }

  async enrichYield(
    id: string,
    userId: string,
    investedValue: number,
  ): Promise<Dividend> {
    return this.dividendsRepository.updateInvestedValue(
      id,
      userId,
      investedValue.toFixed(2),
    )
  }

  async deleteDividend(id: string, userId: string): Promise<void> {
    await this.dividendsRepository.deleteOne(id, userId)
  }
}

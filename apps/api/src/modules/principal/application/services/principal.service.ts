import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common'

import { PRINCIPAL_REPOSITORY } from '@/modules/principal/application/ports/principal.repository.port'
import {
  computeContributionMetrics,
  computeDistributionMetrics,
  computeMilestoneProjections,
} from '@/modules/principal/application/principal.analytics'
import { parseContributions, parseDistribution } from '@/modules/principal/application/principal.parser'

import type { PrincipalRepositoryPort } from '@/modules/principal/application/ports/principal.repository.port'
import type { PrincipalAnalytics } from '@workspace/domain'

const LAKHS = 100_000

@Injectable()
export class PrincipalService {
  constructor(
    @Inject(PRINCIPAL_REPOSITORY)
    private readonly principalRepository: PrincipalRepositoryPort,
  ) {}

  /**
   * Get full principal analytics for a user.
   */
  async getAnalytics(userId: string): Promise<PrincipalAnalytics | null> {
    const [contributions, distribution] = await Promise.all([
      this.principalRepository.findContributionsByUserId(userId),
      this.principalRepository.findDistributionByUserId(userId),
    ])

    if (contributions.length === 0 && distribution.length === 0) {
      return null
    }

    const contributionDtos = contributions.map((c) => ({
      id: c.id,
      month: c.month,
      year: c.year,
      amountLakhs: Number(c.amountLakhs),
      label: c.label,
    }))

    const distributionDtos = distribution.map((d) => ({
      id: d.id,
      name: d.name,
      value: Number(d.value),
    }))

    const contributionMetrics = computeContributionMetrics(contributionDtos)
    const distributionMetrics = computeDistributionMetrics(distributionDtos)

    const avgMonthlyINR = contributionMetrics.averageMonthlyLakhs * LAKHS
    const currentPortfolio = distributionMetrics.totalPortfolioValue

    const milestones = computeMilestoneProjections(avgMonthlyINR, currentPortfolio)

    // Find latest updatedAt across both tables
    const allUpdatedAt = [
      ...contributions.map((c) => c.updatedAt),
      ...distribution.map((d) => d.updatedAt),
    ]
    const latestUpdate = allUpdatedAt.length > 0
      ? new Date(Math.max(...allUpdatedAt.map((d) => new Date(d).getTime()))).toISOString()
      : new Date().toISOString()

    return {
      data: {
        contributions: contributionDtos,
        distribution: distributionDtos,
        updatedAt: latestUpdate,
      },
      contributionMetrics,
      distributionMetrics,
      milestones,
    }
  }

  /**
   * Import contributions from pasted text. Upserts by month+year.
   */
  async importContributions(
    userId: string,
    text: string,
  ): Promise<{ imported: number, updated: number, parsed: number }> {
    const parsed = parseContributions(text)
    if (parsed.length === 0) {
      throw new BadRequestException('No valid contribution data found. Expected format: "Jan 25 1.14" per line.')
    }

    const entries = parsed.map((c) => ({
      month: c.month,
      year: c.year,
      label: c.label,
      amountLakhs: c.amountLakhs.toString(),
    }))

    const { imported, updated } = await this.principalRepository.upsertContributions(userId, entries)

    return { imported, updated, parsed: parsed.length }
  }

  /**
   * Import distribution from pasted text. Upserts by asset name.
   */
  async importDistribution(
    userId: string,
    text: string,
  ): Promise<{ imported: number, updated: number, parsed: number }> {
    const parsed = parseDistribution(text)
    if (parsed.length === 0) {
      throw new BadRequestException('No valid distribution data found. Expected format: "Stocks 2,024,203.00" per line.')
    }

    // Clear old distribution and replace with new
    await this.principalRepository.deleteAllDistribution(userId)

    const entries = parsed.map((d) => ({
      name: d.name,
      value: d.value.toFixed(2),
    }))

    const { imported, updated } = await this.principalRepository.upsertDistribution(userId, entries)

    return { imported, updated, parsed: parsed.length }
  }

  /**
   * Import both contributions and distribution in one call.
   */
  async importAll(
    userId: string,
    contributionsText: string,
    distributionText: string,
  ): Promise<{
    contributions: { imported: number, updated: number, parsed: number }
    distribution: { imported: number, updated: number, parsed: number }
  }> {
    const results = {
      contributions: { imported: 0, updated: 0, parsed: 0 },
      distribution: { imported: 0, updated: 0, parsed: 0 },
    }

    if (contributionsText.trim()) {
      results.contributions = await this.importContributions(userId, contributionsText)
    }

    if (distributionText.trim()) {
      results.distribution = await this.importDistribution(userId, distributionText)
    }

    if (results.contributions.parsed === 0 && results.distribution.parsed === 0) {
      throw new BadRequestException('No valid data found in either input.')
    }

    return results
  }

  // ── Single-row CRUD ──

  private static readonly MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]

  /**
   * Create a single contribution.
   */
  async createContribution(
    userId: string,
    data: { month: string, year: number, amountLakhs: number },
  ) {
    const month = PrincipalService.MONTHS.find(
      (m) => m.toLowerCase() === data.month.toLowerCase(),
    )
    if (!month) {
      throw new BadRequestException(`Invalid month: ${data.month}`)
    }

    const label = `${month} ${String(data.year).slice(-2)}`
    const record = await this.principalRepository.createContribution(userId, {
      month,
      year: data.year,
      label,
      amountLakhs: data.amountLakhs.toString(),
    })

    return {
      id: record.id,
      month: record.month,
      year: record.year,
      amountLakhs: Number(record.amountLakhs),
      label: record.label,
    }
  }

  /**
   * Update a single contribution's amount (and optionally month/year).
   */
  async updateContribution(
    id: string,
    userId: string,
    data: { month?: string, year?: number, amountLakhs?: number },
  ) {
    const updateData: Record<string, unknown> = {}

    if (data.amountLakhs !== undefined) {
      updateData.amountLakhs = data.amountLakhs.toString()
    }

    if (data.month !== undefined || data.year !== undefined) {
      const existing = (await this.principalRepository.findContributionsByUserId(userId))
        .find((c) => c.id === id)
      if (!existing) throw new NotFoundException('Contribution not found')

      const month = data.month ?? existing.month
      const year = data.year ?? existing.year
      updateData.month = month
      updateData.year = year
      updateData.label = `${month} ${String(year).slice(-2)}`
    }

    const record = await this.principalRepository.updateContribution(
      id,
      userId,
      updateData as { month?: string, year?: number, label?: string, amountLakhs?: string },
    )
    if (!record) throw new NotFoundException('Contribution not found')

    return {
      id: record.id,
      month: record.month,
      year: record.year,
      amountLakhs: Number(record.amountLakhs),
      label: record.label,
    }
  }

  /**
   * Delete a single contribution.
   */
  async deleteContribution(id: string, userId: string) {
    const deleted = await this.principalRepository.deleteContribution(id, userId)
    if (!deleted) throw new NotFoundException('Contribution not found')
    return { success: true }
  }

  // ── Distribution single-row CRUD ──

  /**
   * Create a single distribution entry.
   */
  async createDistribution(
    userId: string,
    data: { name: string, value: number },
  ) {
    if (!data.name.trim()) {
      throw new BadRequestException('Asset name is required')
    }

    const record = await this.principalRepository.createDistribution(userId, {
      name: data.name.trim(),
      value: data.value.toFixed(2),
    })

    return {
      id: record.id,
      name: record.name,
      value: Number(record.value),
    }
  }

  /**
   * Update a single distribution entry's value or name.
   */
  async updateDistribution(
    id: string,
    userId: string,
    data: { name?: string, value?: number },
  ) {
    const updateData: Record<string, unknown> = {}

    if (data.name !== undefined) {
      updateData.name = data.name.trim()
    }
    if (data.value !== undefined) {
      updateData.value = data.value.toFixed(2)
    }

    const record = await this.principalRepository.updateDistribution(
      id,
      userId,
      updateData as { name?: string, value?: string },
    )
    if (!record) throw new NotFoundException('Distribution entry not found')

    return {
      id: record.id,
      name: record.name,
      value: Number(record.value),
    }
  }

  /**
   * Delete a single distribution entry.
   */
  async deleteDistribution(id: string, userId: string) {
    const deleted = await this.principalRepository.deleteDistribution(id, userId)
    if (!deleted) throw new NotFoundException('Distribution entry not found')
    return { success: true }
  }
}

import { Inject, Injectable } from '@nestjs/common'
import {
  principalContributionsTable,
  principalDistributionTable,
} from '@workspace/database'
import { and, eq, sql } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared/infrastructure/db/db.port'

import type { PrincipalRepositoryPort } from '@/modules/principal/application/ports/principal.repository.port'
import type { DrizzleDb } from '@/shared/infrastructure/db/db.port'
import type { PrincipalContribution, PrincipalDistribution } from '@workspace/database'

const UPSERT_BATCH_SIZE = 250

@Injectable()
export class PrincipalRepository implements PrincipalRepositoryPort {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  async findContributionsByUserId(userId: string): Promise<PrincipalContribution[]> {
    return this.db
      .select()
      .from(principalContributionsTable)
      .where(eq(principalContributionsTable.userId, userId))
      .orderBy(
        principalContributionsTable.year,
        principalContributionsTable.month,
      )
  }

  async findDistributionByUserId(userId: string): Promise<PrincipalDistribution[]> {
    return this.db
      .select()
      .from(principalDistributionTable)
      .where(eq(principalDistributionTable.userId, userId))
      .orderBy(principalDistributionTable.name)
  }

  async upsertContributions(
    userId: string,
    entries: {
      month: string
      year: number
      label: string
      amountLakhs: string
      salaryLakhs?: string | null
    }[],
  ): Promise<{ imported: number, updated: number }> {
    if (entries.length === 0) {
      return { imported: 0, updated: 0 }
    }

    let imported = 0
    let updated = 0

    for (let i = 0; i < entries.length; i += UPSERT_BATCH_SIZE) {
      const chunk = entries.slice(i, i + UPSERT_BATCH_SIZE)

      const results = await this.db
        .insert(principalContributionsTable)
        .values(
          chunk.map((entry) => ({
            userId,
            month: entry.month,
            year: entry.year,
            label: entry.label,
            amountLakhs: entry.amountLakhs,
            salaryLakhs: entry.salaryLakhs ?? null,
          })),
        )
        .onConflictDoUpdate({
          target: [
            principalContributionsTable.userId,
            principalContributionsTable.month,
            principalContributionsTable.year,
          ],
          set: {
            label: sql`EXCLUDED.label`,
            amountLakhs: sql`EXCLUDED.amount_lakhs`,
            salaryLakhs: sql`EXCLUDED.salary_lakhs`,
            updatedAt: new Date(),
          },
        })
        .returning({
          id: principalContributionsTable.id,
          createdAt: principalContributionsTable.createdAt,
          updatedAt: principalContributionsTable.updatedAt,
        })

      for (const r of results) {
        const diff = Math.abs(
          new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime(),
        )
        if (diff < 1000) {
          imported++
        } else {
          updated++
        }
      }
    }

    return { imported, updated }
  }

  async upsertDistribution(
    userId: string,
    entries: {
      name: string
      value: string
    }[],
  ): Promise<{ imported: number, updated: number }> {
    if (entries.length === 0) {
      return { imported: 0, updated: 0 }
    }

    let imported = 0
    let updated = 0

    for (let i = 0; i < entries.length; i += UPSERT_BATCH_SIZE) {
      const chunk = entries.slice(i, i + UPSERT_BATCH_SIZE)

      const results = await this.db
        .insert(principalDistributionTable)
        .values(
          chunk.map((entry) => ({
            userId,
            name: entry.name,
            value: entry.value,
          })),
        )
        .onConflictDoUpdate({
          target: [
            principalDistributionTable.userId,
            principalDistributionTable.name,
          ],
          set: {
            value: sql`EXCLUDED.value`,
            updatedAt: new Date(),
          },
        })
        .returning({
          id: principalDistributionTable.id,
          createdAt: principalDistributionTable.createdAt,
          updatedAt: principalDistributionTable.updatedAt,
        })

      for (const r of results) {
        const diff = Math.abs(
          new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime(),
        )
        if (diff < 1000) {
          imported++
        } else {
          updated++
        }
      }
    }

    return { imported, updated }
  }

  async createContribution(
    userId: string,
    entry: { month: string, year: number, label: string, amountLakhs: string, salaryLakhs?: string | null },
  ): Promise<PrincipalContribution> {
    const result = await this.db
      .insert(principalContributionsTable)
      .values({
        userId,
        month: entry.month,
        year: entry.year,
        label: entry.label,
        amountLakhs: entry.amountLakhs,
        salaryLakhs: entry.salaryLakhs ?? null,
      })
      .onConflictDoUpdate({
        target: [
          principalContributionsTable.userId,
          principalContributionsTable.month,
          principalContributionsTable.year,
        ],
        set: {
          label: entry.label,
          amountLakhs: entry.amountLakhs,
          salaryLakhs: entry.salaryLakhs ?? null,
          updatedAt: new Date(),
        },
      })
      .returning()

    return result[0]!
  }

  async updateContribution(
    id: string,
    userId: string,
    data: { month?: string, year?: number, label?: string, amountLakhs?: string, salaryLakhs?: string | null },
  ): Promise<PrincipalContribution | null> {
    const result = await this.db
      .update(principalContributionsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(principalContributionsTable.id, id),
          eq(principalContributionsTable.userId, userId),
        ),
      )
      .returning()

    return result[0] ?? null
  }

  async deleteContribution(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(principalContributionsTable)
      .where(
        and(
          eq(principalContributionsTable.id, id),
          eq(principalContributionsTable.userId, userId),
        ),
      )
      .returning({ id: principalContributionsTable.id })

    return result.length > 0
  }

  async createDistribution(
    userId: string,
    entry: { name: string, value: string },
  ): Promise<PrincipalDistribution> {
    const result = await this.db
      .insert(principalDistributionTable)
      .values({
        userId,
        name: entry.name,
        value: entry.value,
      })
      .onConflictDoUpdate({
        target: [
          principalDistributionTable.userId,
          principalDistributionTable.name,
        ],
        set: {
          value: entry.value,
          updatedAt: new Date(),
        },
      })
      .returning()

    return result[0]!
  }

  async updateDistribution(
    id: string,
    userId: string,
    data: { name?: string, value?: string },
  ): Promise<PrincipalDistribution | null> {
    const result = await this.db
      .update(principalDistributionTable)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(principalDistributionTable.id, id),
          eq(principalDistributionTable.userId, userId),
        ),
      )
      .returning()

    return result[0] ?? null
  }

  async deleteDistribution(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(principalDistributionTable)
      .where(
        and(
          eq(principalDistributionTable.id, id),
          eq(principalDistributionTable.userId, userId),
        ),
      )
      .returning({ id: principalDistributionTable.id })

    return result.length > 0
  }

  async deleteAllContributions(userId: string): Promise<void> {
    await this.db
      .delete(principalContributionsTable)
      .where(eq(principalContributionsTable.userId, userId))
  }

  async deleteAllDistribution(userId: string): Promise<void> {
    await this.db
      .delete(principalDistributionTable)
      .where(eq(principalDistributionTable.userId, userId))
  }
}

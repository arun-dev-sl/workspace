import { Inject, Injectable } from '@nestjs/common'
import { flightEmailProcessingTable, rawEmailsTable } from '@workspace/database'
import { and, desc, eq, isNull, or } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared/infrastructure/db/db.port'

import type { FlightEmailProcessingRepository, UpsertFlightEmailProcessingParams } from '@/modules/flights/application/ports/flight-email-processing.repository.port'
import type { DrizzleDb } from '@/shared/infrastructure/db/db.port'
import type { FlightEmailProcessing, RawEmail } from '@workspace/domain'

@Injectable()
export class FlightEmailProcessingRepositoryImpl
implements FlightEmailProcessingRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  async findBySourceEmailId(params: {
    userId: string
    sourceEmailId: string
  }): Promise<FlightEmailProcessing | null> {
    const [row] = await this.db
      .select()
      .from(flightEmailProcessingTable)
      .where(
        and(
          eq(flightEmailProcessingTable.userId, params.userId),
          eq(flightEmailProcessingTable.sourceEmailId, params.sourceEmailId),
        ),
      )

    return row ? this.toDomain(row) : null
  }

  async upsert(
    params: UpsertFlightEmailProcessingParams,
  ): Promise<FlightEmailProcessing> {
    const [row] = await this.db
      .insert(flightEmailProcessingTable)
      .values({
        userId: params.userId,
        sourceEmailId: params.sourceEmailId,
        status: params.status,
        extractionMethod: params.extractionMethod,
        matchedActivities: params.matchedActivities,
        llmAttempts: params.llmAttempts,
        lastError: params.lastError ?? null,
        processedAt: params.processedAt ?? new Date(),
      })
      .onConflictDoUpdate({
        target: [flightEmailProcessingTable.sourceEmailId],
        set: {
          status: params.status,
          extractionMethod: params.extractionMethod,
          matchedActivities: params.matchedActivities,
          llmAttempts: params.llmAttempts,
          lastError: params.lastError ?? null,
          processedAt: params.processedAt ?? new Date(),
          updatedAt: new Date(),
        },
      })
      .returning()

    return this.toDomain(row!)
  }

  async listEmailsForProcessing(params: {
    userId: string
    limit: number
    offset?: number
    forceProcessAll?: boolean
  }): Promise<RawEmail[]> {
    const baseQuery = this.db
      .select({
        id: rawEmailsTable.id,
        userId: rawEmailsTable.userId,
        provider: rawEmailsTable.provider,
        providerMessageId: rawEmailsTable.providerMessageId,
        from: rawEmailsTable.from,
        subject: rawEmailsTable.subject,
        snippet: rawEmailsTable.snippet,
        receivedAt: rawEmailsTable.receivedAt,
        bodyText: rawEmailsTable.bodyText,
        bodyHtml: rawEmailsTable.bodyHtml,
        rawHeaders: rawEmailsTable.rawHeaders,
        category: rawEmailsTable.category,
      })
      .from(rawEmailsTable)
      .leftJoin(
        flightEmailProcessingTable,
        eq(rawEmailsTable.id, flightEmailProcessingTable.sourceEmailId),
      )
      .where(
        and(
          eq(rawEmailsTable.userId, params.userId),
          eq(rawEmailsTable.category, 'flights'),
          ...(params.forceProcessAll
            ? []
            : [
                or(
                  isNull(flightEmailProcessingTable.id),
                  eq(flightEmailProcessingTable.status, 'failed'),
                ),
              ]),
        ),
      )
      .orderBy(desc(rawEmailsTable.receivedAt))
      .limit(params.limit)

    const rows = params.offset === undefined
      ? await baseQuery
      : await baseQuery.offset(params.offset)

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      provider: row.provider as RawEmail['provider'],
      providerMessageId: row.providerMessageId,
      from: row.from,
      subject: row.subject,
      snippet: row.snippet,
      receivedAt: row.receivedAt.toISOString(),
      bodyText: row.bodyText,
      bodyHtml: row.bodyHtml ?? undefined,
      rawHeaders: row.rawHeaders,
      category: row.category,
    }))
  }

  private toDomain(row: typeof flightEmailProcessingTable.$inferSelect): FlightEmailProcessing {
    return {
      id: row.id,
      userId: row.userId,
      sourceEmailId: row.sourceEmailId,
      status: row.status as FlightEmailProcessing['status'],
      extractionMethod: row.extractionMethod as FlightEmailProcessing['extractionMethod'],
      matchedActivities: row.matchedActivities,
      llmAttempts: row.llmAttempts,
      lastError: row.lastError,
      processedAt: row.processedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}

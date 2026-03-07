import { Inject, Injectable } from '@nestjs/common'
import {
  flightActivitiesTable,
  flightEmailProcessingTable,
  rawEmailsTable,
} from '@workspace/database'
import { and, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared/infrastructure/db/db.port'

import type {
  FlightEmailProcessingRepository,
  UpsertFlightEmailProcessingParams,
} from '@/modules/flights/application/ports/flight-email-processing.repository.port'
import type { DrizzleDb } from '@/shared/infrastructure/db/db.port'
import type { FlightEmailProcessing, FlightLlmReviewCandidate, RawEmail } from '@workspace/domain'

interface RawEmailRow {
  id: string
  userId: string
  provider: string
  providerMessageId: string
  from: string
  subject: string
  snippet: string
  receivedAt: Date
  bodyText: string
  bodyHtml: string | null
  rawHeaders: Record<string, string>
  category: string
}

@Injectable()
export class FlightEmailProcessingRepositoryImpl implements FlightEmailProcessingRepository {
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

  async upsert(params: UpsertFlightEmailProcessingParams): Promise<FlightEmailProcessing> {
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
    receivedAfter?: Date
  }): Promise<RawEmail[]> {
    const baseQuery = this.db
      .select(this.rawEmailSelectFields())
      .from(rawEmailsTable)
      .leftJoin(
        flightEmailProcessingTable,
        eq(rawEmailsTable.id, flightEmailProcessingTable.sourceEmailId),
      )
      .where(
        and(
          eq(rawEmailsTable.userId, params.userId),
          eq(rawEmailsTable.category, 'flights'),
          ...(params.receivedAfter
            ? [gte(rawEmailsTable.receivedAt, params.receivedAfter)]
            : []),
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

    const rows
      = params.offset === undefined ? await baseQuery : await baseQuery.offset(params.offset)

    return rows.map((row) => this.toRawEmail(row))
  }

  async listEmailsBySourceEmailIds(params: {
    userId: string
    sourceEmailIds: string[]
  }): Promise<RawEmail[]> {
    if (params.sourceEmailIds.length === 0) {
      return []
    }

    const rows = await this.db
      .select(this.rawEmailSelectFields())
      .from(rawEmailsTable)
      .where(
        and(
          eq(rawEmailsTable.userId, params.userId),
          inArray(rawEmailsTable.id, params.sourceEmailIds),
          eq(rawEmailsTable.category, 'flights'),
        ),
      )
      .orderBy(desc(rawEmailsTable.receivedAt))

    return rows.map((row) => this.toRawEmail(row))
  }

  async listLlmReviewCandidates(params: {
    userId: string
    receivedAfter: Date
    limit: number
  }): Promise<FlightLlmReviewCandidate[]> {
    const rows = await this.db
      .select({
        ...this.rawEmailSelectFields(),
        processingStatus: flightEmailProcessingTable.status,
        processingExtractionMethod: flightEmailProcessingTable.extractionMethod,
        processingLlmAttempts: flightEmailProcessingTable.llmAttempts,
        processingLastError: flightEmailProcessingTable.lastError,
      })
      .from(rawEmailsTable)
      .leftJoin(
        flightEmailProcessingTable,
        eq(rawEmailsTable.id, flightEmailProcessingTable.sourceEmailId),
      )
      .leftJoin(
        flightActivitiesTable,
        eq(rawEmailsTable.id, flightActivitiesTable.sourceEmailId),
      )
      .where(
        and(
          eq(rawEmailsTable.userId, params.userId),
          eq(rawEmailsTable.category, 'flights'),
          gte(rawEmailsTable.receivedAt, params.receivedAfter),
          isNull(flightActivitiesTable.id),
          sql`COALESCE(${flightEmailProcessingTable.llmAttempts}, 0) = 0`,
          or(
            isNull(flightEmailProcessingTable.id),
            eq(flightEmailProcessingTable.status, 'no_match'),
            eq(flightEmailProcessingTable.status, 'failed'),
          ),
        ),
      )
      .orderBy(desc(rawEmailsTable.receivedAt))
      .limit(params.limit)

    return rows.map((row) => ({
      email: this.toRawEmail(row),
      status: (row.processingStatus ?? 'unprocessed') as FlightLlmReviewCandidate['status'],
      extractionMethod: (row.processingExtractionMethod
        ?? 'none') as FlightLlmReviewCandidate['extractionMethod'],
      llmAttempts: row.processingLlmAttempts ?? 0,
      lastError: row.processingLastError ?? null,
    }))
  }

  private rawEmailSelectFields() {
    return {
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
    }
  }

  private toRawEmail(row: RawEmailRow): RawEmail {
    return {
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
    }
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

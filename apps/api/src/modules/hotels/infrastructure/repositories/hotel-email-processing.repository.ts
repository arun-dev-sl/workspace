import { Inject, Injectable } from '@nestjs/common'
import {
  hotelEmailProcessingTable,
  hotelStaysTable,
  rawEmailsTable,
} from '@workspace/database'
import { and, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared/infrastructure/db/db.port'

import type {
  HotelEmailProcessingRepository,
  UpsertHotelEmailProcessingParams,
} from '@/modules/hotels/application/ports/hotel-email-processing.repository.port'
import type { DrizzleDb } from '@/shared/infrastructure/db/db.port'
import type {
  HotelEmailProcessing,
  HotelLlmReviewCandidate,
  HotelRecordedExtractionMethod,
  RawEmail,
} from '@workspace/domain'

type ReviewCandidateStatus = 'failed' | 'no_match' | 'unprocessed'

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

interface HotelLlmReviewCandidateRow extends RawEmailRow {
  processingStatus: string | null
  processingExtractionMethod: string[] | null
  processingLlmAttempts: number | null
  processingLastError: string | null
}

@Injectable()
export class HotelEmailProcessingRepositoryImpl implements HotelEmailProcessingRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  async findBySourceEmailId(params: {
    userId: string
    sourceEmailId: string
  }): Promise<HotelEmailProcessing | null> {
    const [row] = await this.db
      .select()
      .from(hotelEmailProcessingTable)
      .where(and(
        eq(hotelEmailProcessingTable.userId, params.userId),
        eq(hotelEmailProcessingTable.sourceEmailId, params.sourceEmailId),
      ))

    return row ? this.toDomain(row) : null
  }

  async upsert(params: UpsertHotelEmailProcessingParams): Promise<HotelEmailProcessing> {
    const [row] = await this.db
      .insert(hotelEmailProcessingTable)
      .values({
        userId: params.userId,
        sourceEmailId: params.sourceEmailId,
        status: params.status,
        extractionMethod: this.normalizeExtractionMethods(params.extractionMethod),
        matchedStays: params.matchedStays,
        llmAttempts: params.llmAttempts,
        lastError: params.lastError ?? null,
        processedAt: params.processedAt ?? new Date(),
      })
      .onConflictDoUpdate({
        target: [hotelEmailProcessingTable.sourceEmailId],
        set: {
          status: params.status,
          extractionMethod: this.normalizeExtractionMethods(params.extractionMethod),
          matchedStays: params.matchedStays,
          llmAttempts: params.llmAttempts,
          lastError: params.lastError ?? null,
          processedAt: params.processedAt ?? new Date(),
          updatedAt: new Date(),
        },
      })
      .returning()

    if (!row) {
      throw new Error('Failed to upsert hotel email processing state')
    }

    return this.toDomain(row)
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
      .where(and(
        eq(rawEmailsTable.userId, params.userId),
        inArray(rawEmailsTable.id, params.sourceEmailIds),
      ))
      .orderBy(desc(rawEmailsTable.receivedAt))

    return rows.map((row) => this.toRawEmail(row))
  }

  async listLlmReviewCandidates(params: {
    userId: string
    receivedFrom: Date
    receivedTo: Date
    limit: number
  }): Promise<HotelLlmReviewCandidate[]> {
    const rows: HotelLlmReviewCandidateRow[] = await this.db
      .select({
        ...this.rawEmailSelectFields(),
        processingStatus: hotelEmailProcessingTable.status,
        processingExtractionMethod: hotelEmailProcessingTable.extractionMethod,
        processingLlmAttempts: hotelEmailProcessingTable.llmAttempts,
        processingLastError: hotelEmailProcessingTable.lastError,
      })
      .from(rawEmailsTable)
      .leftJoin(
        hotelEmailProcessingTable,
        eq(rawEmailsTable.id, hotelEmailProcessingTable.sourceEmailId),
      )
      .leftJoin(
        hotelStaysTable,
        eq(rawEmailsTable.id, hotelStaysTable.sourceEmailId),
      )
      .where(and(
        eq(rawEmailsTable.userId, params.userId),
        gte(rawEmailsTable.receivedAt, params.receivedFrom),
        lt(rawEmailsTable.receivedAt, params.receivedTo),
        isNull(hotelStaysTable.id),
        sql`COALESCE(${hotelEmailProcessingTable.llmAttempts}, 0) = 0`,
        or(
          isNull(hotelEmailProcessingTable.id),
          eq(hotelEmailProcessingTable.status, 'no_match'),
          eq(hotelEmailProcessingTable.status, 'failed'),
        ),
        or(
          ilike(rawEmailsTable.subject, '%hotel%'),
          ilike(rawEmailsTable.subject, '%reservation%'),
          ilike(rawEmailsTable.subject, '%booking%'),
          ilike(rawEmailsTable.from, '%hotel%'),
          ilike(rawEmailsTable.from, '%booking%'),
          ilike(rawEmailsTable.bodyText, '%hotel%'),
          ilike(rawEmailsTable.bodyText, '%check-in%'),
          ilike(rawEmailsTable.bodyText, '%check in%'),
          ilike(rawEmailsTable.bodyText, '%check-out%'),
          ilike(rawEmailsTable.bodyText, '%check out%'),
        ),
      ))
      .orderBy(desc(rawEmailsTable.receivedAt))
      .limit(params.limit)

    return rows.map((row) => ({
      email: this.toRawEmail(row),
      status: this.toReviewCandidateStatus(row.processingStatus),
      extractionMethod: this.normalizeExtractionMethods(row.processingExtractionMethod ?? []),
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

  private toDomain(row: typeof hotelEmailProcessingTable.$inferSelect): HotelEmailProcessing {
    return {
      id: row.id,
      userId: row.userId,
      sourceEmailId: row.sourceEmailId,
      status: row.status as HotelEmailProcessing['status'],
      extractionMethod: this.normalizeExtractionMethods(row.extractionMethod ?? []),
      matchedStays: row.matchedStays,
      llmAttempts: row.llmAttempts,
      lastError: row.lastError,
      processedAt: row.processedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  private normalizeExtractionMethods(
    methods: readonly string[],
  ): HotelRecordedExtractionMethod[] {
    const uniqueMethods = new Set<HotelRecordedExtractionMethod>()

    for (const method of methods) {
      if (method === 'llm' || method === 'manual') {
        uniqueMethods.add(method)
      }
    }

    return [...uniqueMethods]
  }

  private toReviewCandidateStatus(status: string | null): ReviewCandidateStatus {
    if (status === 'failed' || status === 'no_match') {
      return status
    }

    return 'unprocessed'
  }
}

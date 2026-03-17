import { Inject, Injectable, Logger } from '@nestjs/common'
import { rawEmailsTable, transactionsTable } from '@workspace/database'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared/infrastructure/db/db.port'

import type { RawEmailRepository } from '@/shared/application/ports/raw-email.repository.port'
import type { DrizzleDb } from '@/shared/infrastructure/db/db.port'
import type { InsertRawEmail } from '@workspace/database'
import type { RawEmail } from '@workspace/domain'

interface RawEmailReadRecord {
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
export class RawEmailRepositoryImpl implements RawEmailRepository {
  private readonly logger = new Logger(RawEmailRepositoryImpl.name)

  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  async upsert(email: RawEmail): Promise<{ isNew: boolean, id: string }> {
    const insertData = this.toInsert(email)
    this.logger.debug(
      `Attempting to upsert email: userId=${email.userId}, provider=${email.provider}, providerMessageId=${email.providerMessageId}`,
    )

    try {
      // Try using the unique constraint (if it exists)
      const result = await this.db
        .insert(rawEmailsTable)
        .values(insertData)
        .onConflictDoUpdate({
          target: [
            rawEmailsTable.userId,
            rawEmailsTable.provider,
            rawEmailsTable.providerMessageId,
          ],
          set: {
            // Update snippet and body content on re-sync
            snippet: insertData.snippet,
            bodyText: insertData.bodyText,
            bodyHtml: insertData.bodyHtml,
            category: insertData.category,
            updatedAt: new Date(),
          },
        })
        .returning({
          id: rawEmailsTable.id,
          createdAt: rawEmailsTable.createdAt,
          updatedAt: rawEmailsTable.updatedAt,
        })

      const record = result[0]!
      // If createdAt equals updatedAt (within a small margin), it's a new record
      const isNew = Math.abs(record.createdAt.getTime() - record.updatedAt.getTime()) < 1000

      this.logger.debug(`Upsert with constraint successful: id=${record.id}, isNew=${isNew}`)
      return { isNew, id: record.id }
    } catch (error) {
      this.logger.warn(`Upsert with constraint failed, using fallback: ${String(error)}`)
      // Fallback: Check if email exists, then insert or return existing
      const existing = await this.findByProviderMessageId({
        userId: email.userId,
        provider: email.provider,
        providerMessageId: email.providerMessageId,
      })

      if (existing) {
        this.logger.debug(`Email already exists: id=${existing.id}`)
        return { isNew: false, id: existing.id }
      }

      // Insert new record
      this.logger.debug(`Inserting new email`)
      const result = await this.db
        .insert(rawEmailsTable)
        .values(insertData)
        .returning({ id: rawEmailsTable.id })

      const newId = result[0]!.id
      this.logger.debug(`Inserted new email: id=${newId}`)
      return { isNew: true, id: newId }
    }
  }

  async findById(params: { userId: string, id: string }): Promise<RawEmail | null> {
    const [record] = await this.db
      .select(this.selectFields())
      .from(rawEmailsTable)
      .where(and(eq(rawEmailsTable.userId, params.userId), eq(rawEmailsTable.id, params.id)))

    return record ? this.toDomain(record) : null
  }

  async findByProviderMessageId(params: {
    userId: string
    provider: 'gmail' | 'outlook'
    providerMessageId: string
  }): Promise<RawEmail | null> {
    const [record] = await this.db
      .select(this.selectFields())
      .from(rawEmailsTable)
      .where(
        and(
          eq(rawEmailsTable.userId, params.userId),
          eq(rawEmailsTable.provider, params.provider),
          eq(rawEmailsTable.providerMessageId, params.providerMessageId),
        ),
      )

    return record ? this.toDomain(record) : null
  }

  async listByUser(params: {
    userId: string
    limit: number
    offset: number
    category?: string
  }): Promise<RawEmail[]> {
    this.logger.debug(
      `Listing emails for user ${params.userId}, limit: ${params.limit}, offset: ${params.offset}, category: ${params.category}`,
    )
    const conditions = [eq(rawEmailsTable.userId, params.userId)]
    if (params.category) {
      conditions.push(eq(rawEmailsTable.category, params.category))
    }

    const records = await this.db
      .select(this.selectFields())
      .from(rawEmailsTable)
      .where(and(...conditions))
      .orderBy(desc(rawEmailsTable.receivedAt))
      .limit(params.limit)
      .offset(params.offset)

    this.logger.debug(`Found ${records.length} emails for user ${params.userId}`)
    return records.map((record) => this.toDomain(record))
  }

  async listAllByUser(
    userId: string,
    category?: string,
    options?: { limit?: number, offset?: number },
  ): Promise<RawEmail[]> {
    this.logger.debug(`Listing ALL emails for user ${userId} (reprocess), category: ${category}`)

    const conditions = [eq(rawEmailsTable.userId, userId)]
    if (category) {
      conditions.push(eq(rawEmailsTable.category, category))
    }

    const baseQuery = this.db
      .select(this.selectFields())
      .from(rawEmailsTable)
      .where(and(...conditions))
      .orderBy(desc(rawEmailsTable.receivedAt))

    if (options?.limit !== undefined && options?.offset !== undefined) {
      const records = await baseQuery.limit(options.limit).offset(options.offset)
      this.logger.debug(`Found ${records.length} total emails for user ${userId}, category: ${category}`)
      return records.map((record) => this.toDomain(record))
    }

    if (options?.limit !== undefined) {
      const records = await baseQuery.limit(options.limit)
      this.logger.debug(`Found ${records.length} total emails for user ${userId}, category: ${category}`)
      return records.map((record) => this.toDomain(record))
    }

    if (options?.offset !== undefined) {
      const records = await baseQuery.offset(options.offset)
      this.logger.debug(`Found ${records.length} total emails for user ${userId}, category: ${category}`)
      return records.map((record) => this.toDomain(record))
    }

    const records = await baseQuery

    this.logger.debug(`Found ${records.length} total emails for user ${userId}, category: ${category}`)
    return records.map((record) => this.toDomain(record))
  }

  async listUnprocessedByUser(
    userId: string,
    category?: string,
    options?: { limit?: number, offset?: number },
  ): Promise<RawEmail[]> {
    this.logger.debug(`Listing UNPROCESSED emails for user ${userId}, category: ${category}`)

    const conditions = [eq(rawEmailsTable.userId, userId)]
    if (category) {
      conditions.push(eq(rawEmailsTable.category, category))
    }

    // Find emails that don't have any transactions created from them
    const baseQuery = this.db
      .select(this.selectFields())
      .from(rawEmailsTable)
      .leftJoin(
        transactionsTable,
        eq(rawEmailsTable.id, transactionsTable.sourceEmailId),
      )
      .where(and(...conditions, isNull(transactionsTable.id)))
      .orderBy(desc(rawEmailsTable.receivedAt))

    if (options?.limit !== undefined && options?.offset !== undefined) {
      const records = await baseQuery.limit(options.limit).offset(options.offset)
      this.logger.debug(`Found ${records.length} unprocessed emails for user ${userId}`)
      return records.map((record) => this.toDomain(record))
    }

    if (options?.limit !== undefined) {
      const records = await baseQuery.limit(options.limit)
      this.logger.debug(`Found ${records.length} unprocessed emails for user ${userId}`)
      return records.map((record) => this.toDomain(record))
    }

    if (options?.offset !== undefined) {
      const records = await baseQuery.offset(options.offset)
      this.logger.debug(`Found ${records.length} unprocessed emails for user ${userId}`)
      return records.map((record) => this.toDomain(record))
    }

    const records = await baseQuery

    this.logger.debug(`Found ${records.length} unprocessed emails for user ${userId}`)
    return records.map((record) => this.toDomain(record))
  }

  async countByUser(userId: string, category?: string): Promise<number> {
    const conditions = [eq(rawEmailsTable.userId, userId)]
    if (category) {
      conditions.push(eq(rawEmailsTable.category, category))
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(rawEmailsTable)
      .where(and(...conditions))

    return result[0]?.count ?? 0
  }

  private toInsert(email: RawEmail): InsertRawEmail {
    return {
      id: email.id,
      userId: email.userId,
      provider: email.provider,
      providerMessageId: email.providerMessageId,
      from: email.from,
      subject: email.subject,
      snippet: email.snippet,
      receivedAt: new Date(email.receivedAt),
      bodyText: email.bodyText,
      bodyHtml: email.bodyHtml,
      rawHeaders: email.rawHeaders,
      category: email.category || 'expenses',
    }
  }

  private selectFields() {
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

  private toDomain(record: RawEmailReadRecord): RawEmail {
    return {
      id: record.id,
      userId: record.userId,
      provider: record.provider as 'gmail' | 'outlook',
      providerMessageId: record.providerMessageId,
      from: record.from,
      subject: record.subject,
      snippet: record.snippet || this.deriveSnippet(record.bodyText, record.bodyHtml),
      receivedAt: record.receivedAt.toISOString(),
      bodyText: record.bodyText,
      bodyHtml: record.bodyHtml ?? undefined,
      rawHeaders: record.rawHeaders,
      category: record.category,
    }
  }

  private deriveSnippet(bodyText: string, bodyHtml: string | null): string {
    if (bodyText.trim()) {
      return bodyText.replaceAll(/\s+/g, ' ').trim().slice(0, 180)
    }
    if (bodyHtml) {
      const stripped = bodyHtml
        .replaceAll(/<br\s*\/?>/gi, ' ')
        .replaceAll(/<\/(?:p|div|tr|li)>/gi, ' ')
        .replaceAll(/<[^>]+>/g, '')
        .replaceAll(/&nbsp;/gi, ' ')
        .replaceAll(/&amp;/gi, '&')
        .replaceAll(/\s+/g, ' ')
        .trim()
      return stripped.slice(0, 180)
    }
    return ''
  }
}

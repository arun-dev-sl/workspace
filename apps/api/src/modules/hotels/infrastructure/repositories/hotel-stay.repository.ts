import { Inject, Injectable } from '@nestjs/common'
import { hotelStaysTable } from '@workspace/database'
import { and, count, desc, eq, isNull } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared/infrastructure/db/db.port'

import type { HotelStayRepository } from '@/modules/hotels/application/ports/hotel-stay.repository.port'
import type { DrizzleDb } from '@/shared/infrastructure/db/db.port'
import type { HotelRecordedExtractionMethod, HotelStay } from '@workspace/domain'

@Injectable()
export class HotelStayRepositoryImpl implements HotelStayRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  async create(stay: HotelStay): Promise<HotelStay> {
    const [row] = await this.db
      .insert(hotelStaysTable)
      .values(this.toInsert(stay))
      .returning()

    if (!row) {
      throw new Error('Failed to create hotel stay')
    }

    return this.toDomain(row)
  }

  async update(stay: HotelStay): Promise<HotelStay> {
    const [row] = await this.db
      .update(hotelStaysTable)
      .set({
        sourceEmailId: stay.sourceEmailId,
        extractionMethod: this.normalizeExtractionMethods(stay.extractionMethod),
        canonicalHash: stay.canonicalHash,
        hotelName: stay.hotelName,
        latitude: this.toNumericString(stay.lat),
        longitude: this.toNumericString(stay.lng),
        city: stay.city,
        country: stay.country,
        timezone: stay.timezone,
        checkInDate: stay.checkInDate,
        checkOutDate: stay.checkOutDate,
        nights: stay.nights,
        extractionMetadata: stay.extractionMetadata,
        confidence: stay.confidence.toFixed(4),
        pricingCurrency: stay.pricing.currency,
        pricingTotal: this.toMoneyString(stay.pricing.total),
        pricingNightly: this.toMoneyString(stay.pricing.nightly),
        archivedAt: stay.archivedAt === null ? null : new Date(stay.archivedAt),
        updatedAt: new Date(),
      })
      .where(and(eq(hotelStaysTable.userId, stay.userId), eq(hotelStaysTable.id, stay.id)))
      .returning()

    if (!row) {
      throw new Error('Failed to update hotel stay')
    }

    return this.toDomain(row)
  }

  async upsertExtracted(stay: HotelStay): Promise<HotelStay> {
    const [existing] = await this.db
      .select()
      .from(hotelStaysTable)
      .where(
        and(
          eq(hotelStaysTable.userId, stay.userId),
          eq(hotelStaysTable.canonicalHash, stay.canonicalHash),
        ),
      )

    if (!existing) {
      return this.create(stay)
    }

    if ((existing.extractionMethod ?? []).includes('manual')) {
      return this.toDomain(existing)
    }

    const [row] = await this.db
      .update(hotelStaysTable)
      .set({
        sourceEmailId: stay.sourceEmailId,
        extractionMethod: this.mergeExtractionMethods(
          this.normalizeExtractionMethods(existing.extractionMethod ?? []),
          stay.extractionMethod,
        ),
        hotelName: stay.hotelName,
        latitude: this.toNumericString(stay.lat),
        longitude: this.toNumericString(stay.lng),
        city: stay.city,
        country: stay.country,
        timezone: stay.timezone,
        checkInDate: stay.checkInDate,
        checkOutDate: stay.checkOutDate,
        nights: stay.nights,
        extractionMetadata: stay.extractionMetadata,
        confidence: stay.confidence.toFixed(4),
        pricingCurrency: stay.pricing.currency,
        pricingTotal: this.toMoneyString(stay.pricing.total),
        pricingNightly: this.toMoneyString(stay.pricing.nightly),
        archivedAt: existing.archivedAt,
        updatedAt: new Date(),
      })
      .where(eq(hotelStaysTable.id, existing.id))
      .returning()

    if (!row) {
      throw new Error('Failed to upsert extracted hotel stay')
    }

    return this.toDomain(row)
  }

  async listByUser(params: {
    userId: string
    limit: number
    offset: number
    includeArchived?: boolean
  }): Promise<HotelStay[]> {
    const conditions = [eq(hotelStaysTable.userId, params.userId)]
    if (!params.includeArchived) {
      conditions.push(isNull(hotelStaysTable.archivedAt))
    }

    const rows = await this.db
      .select()
      .from(hotelStaysTable)
      .where(and(...conditions))
      .orderBy(desc(hotelStaysTable.checkInDate), desc(hotelStaysTable.createdAt))
      .limit(params.limit)
      .offset(params.offset)

    return rows.map((row) => this.toDomain(row))
  }

  async countByUser(userId: string, includeArchived = false): Promise<number> {
    const conditions = [eq(hotelStaysTable.userId, userId)]
    if (!includeArchived) {
      conditions.push(isNull(hotelStaysTable.archivedAt))
    }

    const result = await this.db
      .select({ count: count() })
      .from(hotelStaysTable)
      .where(and(...conditions))

    return result[0]?.count ?? 0
  }

  async findById(params: { userId: string, id: string }): Promise<HotelStay | null> {
    const [row] = await this.db
      .select()
      .from(hotelStaysTable)
      .where(and(eq(hotelStaysTable.userId, params.userId), eq(hotelStaysTable.id, params.id)))

    return row ? this.toDomain(row) : null
  }

  async archive(params: {
    userId: string
    id: string
    archivedAt: Date
  }): Promise<HotelStay | null> {
    const [row] = await this.db
      .update(hotelStaysTable)
      .set({
        archivedAt: params.archivedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(hotelStaysTable.userId, params.userId), eq(hotelStaysTable.id, params.id)))
      .returning()

    return row ? this.toDomain(row) : null
  }

  async unarchive(params: { userId: string, id: string }): Promise<HotelStay | null> {
    const [row] = await this.db
      .update(hotelStaysTable)
      .set({
        archivedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(hotelStaysTable.userId, params.userId), eq(hotelStaysTable.id, params.id)))
      .returning()

    return row ? this.toDomain(row) : null
  }

  async delete(params: { userId: string, id: string }): Promise<void> {
    await this.db
      .delete(hotelStaysTable)
      .where(and(eq(hotelStaysTable.userId, params.userId), eq(hotelStaysTable.id, params.id)))
  }

  private toInsert(stay: HotelStay): typeof hotelStaysTable.$inferInsert {
    return {
      id: stay.id,
      userId: stay.userId,
      sourceEmailId: stay.sourceEmailId,
      extractionMethod: this.normalizeExtractionMethods(stay.extractionMethod),
      canonicalHash: stay.canonicalHash,
      hotelName: stay.hotelName,
      latitude: this.toNumericString(stay.lat),
      longitude: this.toNumericString(stay.lng),
      city: stay.city,
      country: stay.country,
      timezone: stay.timezone,
      checkInDate: stay.checkInDate,
      checkOutDate: stay.checkOutDate,
      nights: stay.nights,
      extractionMetadata: stay.extractionMetadata,
      confidence: stay.confidence.toFixed(4),
      pricingCurrency: stay.pricing.currency,
      pricingTotal: this.toMoneyString(stay.pricing.total),
      pricingNightly: this.toMoneyString(stay.pricing.nightly),
      archivedAt: stay.archivedAt === null ? null : new Date(stay.archivedAt),
    }
  }

  private toDomain(row: typeof hotelStaysTable.$inferSelect): HotelStay {
    return {
      id: row.id,
      userId: row.userId,
      sourceEmailId: row.sourceEmailId,
      extractionMethod: this.normalizeExtractionMethods(row.extractionMethod ?? []),
      canonicalHash: row.canonicalHash,
      hotelName: row.hotelName,
      lat: row.latitude === null ? null : Number(row.latitude),
      lng: row.longitude === null ? null : Number(row.longitude),
      city: row.city,
      country: row.country,
      timezone: row.timezone,
      checkInDate: row.checkInDate,
      checkOutDate: row.checkOutDate,
      nights: row.nights,
      extractionMetadata: row.extractionMetadata ?? {},
      confidence: Number(row.confidence),
      pricing: {
        currency: row.pricingCurrency,
        total: row.pricingTotal === null ? null : Number(row.pricingTotal),
        nightly: row.pricingNightly === null ? null : Number(row.pricingNightly),
      },
      archivedAt: row.archivedAt?.toISOString() ?? null,
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

  private mergeExtractionMethods(
    existingMethods: readonly HotelRecordedExtractionMethod[],
    nextMethods: readonly HotelRecordedExtractionMethod[],
  ): HotelRecordedExtractionMethod[] {
    return [...new Set([...existingMethods, ...nextMethods])]
  }

  private toMoneyString(value: number | null): string | null {
    return value === null ? null : value.toFixed(2)
  }

  private toNumericString(value: number | null): string | null {
    return value === null ? null : value.toFixed(6)
  }
}

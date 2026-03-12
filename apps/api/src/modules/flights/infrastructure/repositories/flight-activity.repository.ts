import { Inject, Injectable } from '@nestjs/common'
import { flightActivitiesTable } from '@workspace/database'
import { and, asc, count, desc, eq, inArray, lt, or } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared/infrastructure/db/db.port'
import { decodeCursor, encodeCursor } from '@/shared/infrastructure/utils/cursor.utils'

import type { FlightActivityRepository } from '@/modules/flights/application/ports/flight-activity.repository.port'
import type { DrizzleDb } from '@/shared/infrastructure/db/db.port'
import type {
  FlightActivity,
  FlightActivityExtractionMethod,
} from '@workspace/domain'

const UPSERT_BATCH_SIZE = 250

@Injectable()
export class FlightActivityRepositoryImpl implements FlightActivityRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  async upsertMany(activities: FlightActivity[]): Promise<void> {
    if (activities.length === 0) {
      return
    }

    const canonicalHashes = activities.map((a) => a.canonicalHash)

    const existingRows = await this.db
      .select()
      .from(flightActivitiesTable)
      .where(
        and(
          eq(flightActivitiesTable.userId, activities[0]!.userId),
          inArray(flightActivitiesTable.canonicalHash, canonicalHashes),
        ),
      )

    const existingMap = new Map(
      existingRows.map((row) => [row.canonicalHash, row]),
    )

    const toInsert: (typeof flightActivitiesTable.$inferInsert)[] = []
    const toUpdate: { activity: FlightActivity, existing: typeof flightActivitiesTable.$inferSelect }[] = []

    for (const activity of activities) {
      const existing = existingMap.get(activity.canonicalHash)

      if (!existing) {
        toInsert.push(this.toInsert(activity))
        continue
      }

      if ((existing.extractionMethod ?? []).includes('manual')) {
        continue
      }

      toUpdate.push({ activity, existing })
    }

    for (let i = 0; i < toInsert.length; i += UPSERT_BATCH_SIZE) {
      const chunk = toInsert.slice(i, i + UPSERT_BATCH_SIZE)
      await this.db.insert(flightActivitiesTable).values(chunk)
    }

    for (const { activity, existing } of toUpdate) {
      await this.db
        .update(flightActivitiesTable)
        .set({
          sourceEmailId: activity.sourceEmailId,
          activityType: activity.activityType,
          extractionMethod: this.mergeExtractionMethods(
            this.normalizeExtractionMethods(existing.extractionMethod ?? []),
            activity.extractionMethod,
          ),
          segmentIndex: activity.segmentIndex,
          pnr: activity.pnr,
          airlineName: activity.airlineName,
          flightNumber: activity.flightNumber,
          fromAirport: activity.fromAirport,
          toAirport: activity.toAirport,
          departureDate: activity.departureDate,
          departureTime: activity.departureTime,
          arrivalDate: activity.arrivalDate,
          arrivalTime: activity.arrivalTime,
          departureAt: activity.departureAt ? new Date(activity.departureAt) : null,
          arrivalAt: activity.arrivalAt ? new Date(activity.arrivalAt) : null,
          departureTimezone: activity.departureTimezone,
          arrivalTimezone: activity.arrivalTimezone,
          travelClass: activity.travelClass,
          confidence: activity.confidence.toFixed(4),
          updatedAt: new Date(),
        })
        .where(eq(flightActivitiesTable.id, existing.id))
    }
  }

  async update(activity: FlightActivity): Promise<FlightActivity> {
    const [row] = await this.db
      .update(flightActivitiesTable)
      .set({
        sourceEmailId: activity.sourceEmailId,
        activityType: activity.activityType,
        extractionMethod: this.normalizeExtractionMethods(activity.extractionMethod),
        canonicalHash: activity.canonicalHash,
        segmentIndex: activity.segmentIndex,
        pnr: activity.pnr,
        airlineName: activity.airlineName,
        flightNumber: activity.flightNumber,
        fromAirport: activity.fromAirport,
        toAirport: activity.toAirport,
        departureDate: activity.departureDate,
        departureTime: activity.departureTime,
        arrivalDate: activity.arrivalDate,
        arrivalTime: activity.arrivalTime,
        departureAt: activity.departureAt ? new Date(activity.departureAt) : null,
        arrivalAt: activity.arrivalAt ? new Date(activity.arrivalAt) : null,
        departureTimezone: activity.departureTimezone,
        arrivalTimezone: activity.arrivalTimezone,
        travelClass: activity.travelClass,
        confidence: activity.confidence.toFixed(4),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(flightActivitiesTable.userId, activity.userId),
          eq(flightActivitiesTable.id, activity.id),
        ),
      )
      .returning()

    return this.toDomain(row!)
  }

  async listAllByUser(userId: string): Promise<FlightActivity[]> {
    const rows = await this.db
      .select()
      .from(flightActivitiesTable)
      .where(eq(flightActivitiesTable.userId, userId))
      .orderBy(
        asc(flightActivitiesTable.departureDate),
        asc(flightActivitiesTable.segmentIndex),
      )

    return rows.map((row) => this.toDomain(row))
  }

  async listByUser(params: {
    userId: string
    limit: number
    offset: number
  }): Promise<FlightActivity[]> {
    const rows = await this.db
      .select()
      .from(flightActivitiesTable)
      .where(eq(flightActivitiesTable.userId, params.userId))
      .orderBy(
        desc(flightActivitiesTable.departureDate),
        desc(flightActivitiesTable.segmentIndex),
      )
      .limit(params.limit)
      .offset(params.offset)

    return rows.map((row) => this.toDomain(row))
  }

  async countByUser(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(flightActivitiesTable)
      .where(eq(flightActivitiesTable.userId, userId))

    return result[0]?.count ?? 0
  }

  async listByUserCursor(params: {
    userId: string
    pageSize: number
    cursor?: string
  }): Promise<{ data: FlightActivity[], nextCursor?: string, hasMore: boolean }> {
    const conditions = [eq(flightActivitiesTable.userId, params.userId)]

    if (params.cursor) {
      const decoded = decodeCursor<{ d: string, si: number, id: string }>(params.cursor)
      if (decoded) {
        conditions.push(
          or(
            lt(flightActivitiesTable.departureDate, decoded.d),
            and(
              eq(flightActivitiesTable.departureDate, decoded.d),
              lt(flightActivitiesTable.segmentIndex, decoded.si),
            ),
            and(
              eq(flightActivitiesTable.departureDate, decoded.d),
              eq(flightActivitiesTable.segmentIndex, decoded.si),
              lt(flightActivitiesTable.id, decoded.id),
            ),
          )!,
        )
      }
    }

    const rows = await this.db
      .select()
      .from(flightActivitiesTable)
      .where(and(...conditions))
      .orderBy(
        desc(flightActivitiesTable.departureDate),
        desc(flightActivitiesTable.segmentIndex),
        desc(flightActivitiesTable.id),
      )
      .limit(params.pageSize + 1)

    const hasMore = rows.length > params.pageSize
    const page = hasMore ? rows.slice(0, params.pageSize) : rows
    const data = page.map((row) => this.toDomain(row))

    let nextCursor: string | undefined
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1]!
      nextCursor = encodeCursor({
        d: last.departureDate,
        si: last.segmentIndex,
        id: last.id,
      })
    }

    return { data, nextCursor, hasMore }
  }

  async listBySourceEmailId(params: {
    userId: string
    sourceEmailId: string
  }): Promise<FlightActivity[]> {
    const rows = await this.db
      .select()
      .from(flightActivitiesTable)
      .where(
        and(
          eq(flightActivitiesTable.userId, params.userId),
          eq(flightActivitiesTable.sourceEmailId, params.sourceEmailId),
        ),
      )
      .orderBy(asc(flightActivitiesTable.segmentIndex))

    return rows.map((row) => this.toDomain(row))
  }

  async findById(params: { userId: string, id: string }): Promise<FlightActivity | null> {
    const [row] = await this.db
      .select()
      .from(flightActivitiesTable)
      .where(
        and(
          eq(flightActivitiesTable.userId, params.userId),
          eq(flightActivitiesTable.id, params.id),
        ),
      )

    return row ? this.toDomain(row) : null
  }

  private toInsert(activity: FlightActivity): typeof flightActivitiesTable.$inferInsert {
    return {
      id: activity.id,
      userId: activity.userId,
      sourceEmailId: activity.sourceEmailId,
      activityType: activity.activityType,
      extractionMethod: this.normalizeExtractionMethods(activity.extractionMethod),
      canonicalHash: activity.canonicalHash,
      segmentIndex: activity.segmentIndex,
      pnr: activity.pnr,
      airlineName: activity.airlineName,
      flightNumber: activity.flightNumber,
      fromAirport: activity.fromAirport,
      toAirport: activity.toAirport,
      departureDate: activity.departureDate,
      departureTime: activity.departureTime,
      arrivalDate: activity.arrivalDate,
      arrivalTime: activity.arrivalTime,
      departureAt: activity.departureAt ? new Date(activity.departureAt) : null,
      arrivalAt: activity.arrivalAt ? new Date(activity.arrivalAt) : null,
      departureTimezone: activity.departureTimezone,
      arrivalTimezone: activity.arrivalTimezone,
      travelClass: activity.travelClass,
      confidence: activity.confidence.toFixed(4),
    }
  }

  private toDomain(row: typeof flightActivitiesTable.$inferSelect): FlightActivity {
    return {
      id: row.id,
      userId: row.userId,
      sourceEmailId: row.sourceEmailId,
      activityType: row.activityType as FlightActivity['activityType'],
      extractionMethod: this.normalizeExtractionMethods(row.extractionMethod ?? []),
      canonicalHash: row.canonicalHash,
      segmentIndex: row.segmentIndex,
      pnr: row.pnr,
      airlineName: row.airlineName,
      flightNumber: row.flightNumber,
      fromAirport: row.fromAirport,
      toAirport: row.toAirport,
      departureDate: row.departureDate,
      departureTime: row.departureTime,
      arrivalDate: row.arrivalDate,
      arrivalTime: row.arrivalTime,
      departureAt: row.departureAt?.toISOString() ?? null,
      arrivalAt: row.arrivalAt?.toISOString() ?? null,
      departureTimezone: row.departureTimezone,
      arrivalTimezone: row.arrivalTimezone,
      travelClass: row.travelClass,
      confidence: Number(row.confidence),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  private normalizeExtractionMethods(
    methods: readonly string[],
  ): FlightActivityExtractionMethod[] {
    const uniqueMethods = new Set<FlightActivityExtractionMethod>()

    for (const method of methods) {
      if (this.isFlightActivityExtractionMethod(method)) {
        uniqueMethods.add(method)
      }
    }

    return [...uniqueMethods]
  }

  private mergeExtractionMethods(
    existingMethods: readonly FlightActivityExtractionMethod[],
    nextMethods: readonly FlightActivityExtractionMethod[],
  ): FlightActivityExtractionMethod[] {
    const mergedMethods = new Set<FlightActivityExtractionMethod>()

    for (const method of existingMethods) {
      mergedMethods.add(method)
    }

    for (const method of nextMethods) {
      mergedMethods.add(method)
    }

    return [...mergedMethods]
  }

  private isFlightActivityExtractionMethod(
    method: string,
  ): method is FlightActivityExtractionMethod {
    return ['json_ld', 'heuristic', 'llm', 'manual'].includes(method)
  }
}

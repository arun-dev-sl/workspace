import { Inject, Injectable } from '@nestjs/common'
import { flightActivitiesTable } from '@workspace/database'
import { and, asc, count, desc, eq } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared/infrastructure/db/db.port'

import type { FlightActivityRepository } from '@/modules/flights/application/ports/flight-activity.repository.port'
import type { DrizzleDb } from '@/shared/infrastructure/db/db.port'
import type { FlightActivity } from '@workspace/domain'

@Injectable()
export class FlightActivityRepositoryImpl implements FlightActivityRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  async upsertMany(activities: FlightActivity[]): Promise<void> {
    if (activities.length === 0) {
      return
    }

    for (const activity of activities) {
      const [existing] = await this.db
        .select()
        .from(flightActivitiesTable)
        .where(
          and(
            eq(flightActivitiesTable.userId, activity.userId),
            eq(flightActivitiesTable.canonicalHash, activity.canonicalHash),
          ),
        )

      if (!existing) {
        await this.db.insert(flightActivitiesTable).values(this.toInsert(activity))
        continue
      }

      if (existing.extractionMethod === 'manual') {
        continue
      }

      await this.db
        .update(flightActivitiesTable)
        .set({
          sourceEmailId: activity.sourceEmailId,
          activityType: activity.activityType,
          extractionMethod: activity.extractionMethod,
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
        extractionMethod: activity.extractionMethod,
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
      extractionMethod: activity.extractionMethod,
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
      extractionMethod: row.extractionMethod as FlightActivity['extractionMethod'],
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
}

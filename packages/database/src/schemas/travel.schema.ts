import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { usersTable } from './auth/users.schema.js'
import { rawEmailsTable } from './finance.schema.js'

export const flightActivitiesTable = pgTable(
  'flight_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    sourceEmailId: uuid('source_email_id')
      .notNull()
      .references(() => rawEmailsTable.id, { onDelete: 'cascade' }),
    activityType: text('activity_type').notNull().default('booking_confirmation'),
    extractionMethod: text('extraction_method')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    canonicalHash: text('canonical_hash').notNull(),
    segmentIndex: integer('segment_index').notNull(),
    pnr: text('pnr'),
    airlineName: text('airline_name'),
    flightNumber: text('flight_number').notNull(),
    fromAirport: text('from_airport').notNull(),
    toAirport: text('to_airport').notNull(),
    departureDate: date('departure_date').notNull(),
    departureTime: text('departure_time'),
    arrivalDate: date('arrival_date'),
    arrivalTime: text('arrival_time'),
    departureAt: timestamp('departure_at', { withTimezone: true }),
    arrivalAt: timestamp('arrival_at', { withTimezone: true }),
    departureTimezone: text('departure_timezone'),
    arrivalTimezone: text('arrival_timezone'),
    travelClass: text('travel_class'),
    confidence: numeric('confidence', { precision: 5, scale: 4 })
      .notNull()
      .default('0'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('flight_activities_user_canonical_hash_idx').on(
      table.userId,
      table.canonicalHash,
    ),
    index('flight_activities_user_departure_date_idx').on(
      table.userId,
      table.departureDate,
    ),
    index('flight_activities_user_pnr_idx').on(table.userId, table.pnr),
  ],
)

export const flightEmailProcessingTable = pgTable(
  'flight_email_processing',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    sourceEmailId: uuid('source_email_id')
      .notNull()
      .references(() => rawEmailsTable.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    extractionMethod: text('extraction_method')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    matchedActivities: integer('matched_activities').notNull().default(0),
    llmAttempts: integer('llm_attempts').notNull().default(0),
    lastError: text('last_error'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('flight_email_processing_source_email_idx').on(table.sourceEmailId),
    index('flight_email_processing_user_status_idx').on(table.userId, table.status),
  ],
)

export const hotelStaysTable = pgTable(
  'hotel_stays',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    sourceEmailId: uuid('source_email_id').references(() => rawEmailsTable.id, {
      onDelete: 'set null',
    }),
    extractionMethod: text('extraction_method')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    canonicalHash: text('canonical_hash').notNull(),
    hotelName: text('hotel_name').notNull(),
    latitude: numeric('latitude', { precision: 10, scale: 6 }),
    longitude: numeric('longitude', { precision: 10, scale: 6 }),
    city: text('city'),
    country: text('country'),
    timezone: text('timezone'),
    checkInDate: date('check_in_date'),
    checkOutDate: date('check_out_date'),
    nights: integer('nights'),
    extractionMetadata: jsonb('extraction_metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    confidence: numeric('confidence', { precision: 5, scale: 4 })
      .notNull()
      .default('0'),
    pricingCurrency: text('pricing_currency'),
    pricingTotal: numeric('pricing_total', { precision: 12, scale: 2 }),
    pricingNightly: numeric('pricing_nightly', { precision: 12, scale: 2 }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('hotel_stays_user_canonical_hash_idx').on(
      table.userId,
      table.canonicalHash,
    ),
    index('hotel_stays_user_check_in_date_idx').on(table.userId, table.checkInDate),
    index('hotel_stays_user_archived_at_idx').on(table.userId, table.archivedAt),
    index('hotel_stays_source_email_idx').on(table.sourceEmailId),
  ],
)

export const hotelEmailProcessingTable = pgTable(
  'hotel_email_processing',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    sourceEmailId: uuid('source_email_id')
      .notNull()
      .references(() => rawEmailsTable.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    extractionMethod: text('extraction_method')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    matchedStays: integer('matched_stays').notNull().default(0),
    llmAttempts: integer('llm_attempts').notNull().default(0),
    lastError: text('last_error'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('hotel_email_processing_source_email_idx').on(table.sourceEmailId),
    index('hotel_email_processing_user_status_idx').on(table.userId, table.status),
  ],
)

export type FlightActivityRecord = typeof flightActivitiesTable.$inferSelect
export type InsertFlightActivity = typeof flightActivitiesTable.$inferInsert
export type FlightEmailProcessingRecord = typeof flightEmailProcessingTable.$inferSelect
export type InsertFlightEmailProcessing = typeof flightEmailProcessingTable.$inferInsert
export type HotelStayRecord = typeof hotelStaysTable.$inferSelect
export type InsertHotelStay = typeof hotelStaysTable.$inferInsert
export type HotelEmailProcessingRecord = typeof hotelEmailProcessingTable.$inferSelect
export type InsertHotelEmailProcessing = typeof hotelEmailProcessingTable.$inferInsert

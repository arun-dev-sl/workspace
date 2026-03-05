import {
  pgTable,
  uuid,
  varchar,
  numeric,
  smallint,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { usersTable } from './auth/users.schema.js'

/**
 * Monthly investment contributions.
 * Each row = one month's principal investment for a user.
 */
export const principalContributionsTable = pgTable(
  'principal_contributions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),

    /** Short month name: Jan, Feb, Mar, etc. */
    month: varchar('month', { length: 10 }).notNull(),
    /** 2-digit year: 25 = 2025 */
    year: smallint('year').notNull(),
    /** Display label: e.g. "Jan 25" */
    label: varchar('label', { length: 20 }).notNull(),
    /** Amount in Lakhs (e.g. 1.14 = ₹1,14,000) */
    amountLakhs: numeric('amount_lakhs', { precision: 12, scale: 4 }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('principal_contributions_user_id_idx').on(table.userId),
    /** Unique per user + month + year — enables upsert */
    userMonthYearUq: uniqueIndex('principal_contributions_user_month_year_uq').on(
      table.userId,
      table.month,
      table.year,
    ),
  }),
)

export type PrincipalContribution = typeof principalContributionsTable.$inferSelect
export type NewPrincipalContribution = typeof principalContributionsTable.$inferInsert

/**
 * Asset distribution / allocation snapshot.
 * Each row = one asset class for a user.
 */
export const principalDistributionTable = pgTable(
  'principal_distribution',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),

    /** Asset class name: Stocks, Mutual Funds, PF, Gold, etc. */
    name: varchar('name', { length: 100 }).notNull(),
    /** Absolute value in INR */
    value: numeric('value', { precision: 18, scale: 2 }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('principal_distribution_user_id_idx').on(table.userId),
    /** Unique per user + asset name — enables upsert */
    userNameUq: uniqueIndex('principal_distribution_user_name_uq').on(
      table.userId,
      table.name,
    ),
  }),
)

export type PrincipalDistribution = typeof principalDistributionTable.$inferSelect
export type NewPrincipalDistribution = typeof principalDistributionTable.$inferInsert

import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  date,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { usersTable } from './auth/users.schema.js'

export const dividendsTable = pgTable(
  'dividends',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),

    companyName: varchar('company_name', { length: 255 }).notNull(),
    isin: varchar('isin', { length: 20 }).notNull(),

    exDate: date('ex_date').notNull(),

    shares: integer('shares').notNull(),
    dividendPerShare: numeric('dividend_per_share', {
      precision: 18,
      scale: 4,
    }).notNull(),
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),

    /** Optional — user enriches later for yield analysis */
    investedValue: numeric('invested_value', { precision: 18, scale: 2 }),

    /** Metadata from the report envelope (nullable) */
    reportPeriodFrom: date('report_period_from'),
    reportPeriodTo: date('report_period_to'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('dividends_user_id_idx').on(table.userId),
    exDateIdx: index('dividends_ex_date_idx').on(table.exDate),
    /** Composite unique — enables upsert dedup */
    userIsinExDateUq: uniqueIndex('dividends_user_isin_exdate_uq').on(
      table.userId,
      table.isin,
      table.exDate,
    ),
  }),
)

export type Dividend = typeof dividendsTable.$inferSelect
export type NewDividend = typeof dividendsTable.$inferInsert

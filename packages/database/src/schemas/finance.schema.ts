import {
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { usersTable } from './auth/users.schema.js'

/**
 * Raw emails table definition
 *
 * Stores raw email payloads for reprocessing and auditability
 */
export const rawEmailsTable = pgTable(
  'raw_emails',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerMessageId: text('provider_message_id').notNull(),
    from: text('from').notNull(),
    subject: text('subject').notNull(),
    snippet: text('snippet').notNull().default(''),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    bodyText: text('body_text').notNull(),
    bodyHtml: text('body_html'),
    rawHeaders: jsonb('raw_headers').notNull().$type<Record<string, string>>(),
    category: text('category').notNull().default('expenses'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('raw_emails_user_provider_message_idx').on(
      table.userId,
      table.provider,
      table.providerMessageId,
    ),
    index('raw_emails_user_category_idx').on(table.userId, table.category),
  ],
)

/**
 * Statements table definition
 */
export const statementsTable = pgTable(
  'statements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    issuer: text('issuer').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    totalDue: numeric('total_due', { precision: 12, scale: 2 }).notNull(),
    sourceEmailId: uuid('source_email_id')
      .notNull()
      .references(() => rawEmailsTable.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('statements_user_id_idx').on(table.userId),
  ],
)

/**
 * Transactions table definition
 */
export const transactionsTable = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    dedupeHash: text('dedupe_hash').notNull(),
    merchant: text('merchant').notNull(),
    merchantRaw: text('merchant_raw').notNull(),
    vpa: text('vpa'),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').notNull(),
    transactionDate: timestamp('transaction_date', {
      withTimezone: true,
    }).notNull(),
    transactionType: text('transaction_type').notNull(),
    transactionMode: text('transaction_mode').notNull(),
    cardLast4: text('card_last4'),
    cardName: text('card_name'),
    category: text('category').notNull(),
    subcategory: text('subcategory').notNull(),
    confidence: numeric('confidence', { precision: 5, scale: 4 })
      .notNull()
      .default('0'),
    categorizationMethod: text('categorization_method')
      .notNull()
      .default('default'),
    requiresReview: boolean('requires_review').notNull().default(false),
    categoryMetadata: jsonb('category_metadata')
      .notNull()
      .$type<{ icon: string, color: string, parent: string | null }>()
      .default({ icon: 'question-circle', color: '#BDC3C7', parent: null }),
    statementId: uuid('statement_id').references(() => statementsTable.id, {
      onDelete: 'set null',
    }),
    sourceEmailId: uuid('source_email_id')
      .notNull()
      .references(() => rawEmailsTable.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('transactions_user_source_email_idx').on(
      table.userId,
      table.sourceEmailId,
    ),
    index('transactions_dedupe_hash_idx').on(table.dedupeHash),
    index('transactions_user_transaction_date_idx').on(
      table.userId,
      table.transactionDate,
    ),
    index('transactions_user_category_idx').on(table.userId, table.category),
    index('transactions_transaction_date_idx').on(table.transactionDate),
    index('transactions_card_last4_idx').on(table.cardLast4),
  ],
)

export type RawEmailRecord = typeof rawEmailsTable.$inferSelect
export type InsertRawEmail = typeof rawEmailsTable.$inferInsert
export type StatementRecord = typeof statementsTable.$inferSelect
export type InsertStatement = typeof statementsTable.$inferInsert
export type TransactionRecord = typeof transactionsTable.$inferSelect
export type InsertTransaction = typeof transactionsTable.$inferInsert

/**
 * Sync job status enum
 */
export const SyncJobStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type SyncJobStatus = (typeof SyncJobStatus)[keyof typeof SyncJobStatus]

/**
 * Sync jobs table definition
 *
 * Tracks async email sync jobs
 */
export const syncJobsTable = pgTable(
  'sync_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    status: text('status').notNull().$type<SyncJobStatus>().default('pending'),
    category: text('category').notNull().default('expenses'),
    query: text('query'),
    totalEmails: numeric('total_emails', { precision: 10, scale: 0 }),
    processedEmails: numeric('processed_emails', {
      precision: 10,
      scale: 0,
    }).default('0'),
    newEmails: numeric('new_emails', { precision: 10, scale: 0 }).default('0'),
    transactions: numeric('transactions', { precision: 10, scale: 0 }).default(
      '0',
    ),
    statements: numeric('statements', { precision: 10, scale: 0 }).default('0'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('sync_jobs_user_id_idx').on(table.userId),
    index('sync_jobs_user_status_category_idx').on(table.userId, table.status, table.category),
  ],
)

export type SyncJobRecord = typeof syncJobsTable.$inferSelect
export type InsertSyncJob = typeof syncJobsTable.$inferInsert

import { relations } from 'drizzle-orm'

import {
  usersTable,
  profilesTable,
  accountsTable,
  sessionsTable,
  rawEmailsTable,
  statementsTable,
  transactionsTable,
  merchantCategoryRulesTable,
  webauthnCredentialsTable,
} from './schemas/index.js'

/**
 * Users table relations
 */
export const usersRelations = relations(usersTable, ({ one, many }) => ({
  // 1:1 with profiles
  profile: one(profilesTable, {
    fields: [usersTable.id],
    references: [profilesTable.userId],
  }),
  // 1:N with auth_accounts
  accounts: many(accountsTable),
  // 1:N with auth_sessions
  sessions: many(sessionsTable),
  // 1:N with raw_emails
  rawEmails: many(rawEmailsTable),
  // 1:N with statements
  statements: many(statementsTable),
  // 1:N with transactions
  transactions: many(transactionsTable),
  // 1:N with merchant_category_rules
  merchantCategoryRules: many(merchantCategoryRulesTable),
  // 1:N with webauthn_credentials
  passkeys: many(webauthnCredentialsTable),
}))

/**
 * Profiles table relations
 */
export const profilesRelations = relations(profilesTable, ({ one }) => ({
  // N:1 with users
  user: one(usersTable, {
    fields: [profilesTable.userId],
    references: [usersTable.id],
  }),
}))

/**
 * Auth Accounts table relations
 */
export const accountsRelations = relations(accountsTable, ({ one }) => ({
  // N:1 with users
  user: one(usersTable, {
    fields: [accountsTable.userId],
    references: [usersTable.id],
  }),
}))

/**
 * Auth Sessions table relations
 */
export const sessionsRelations = relations(sessionsTable, ({ one }) => ({
  // N:1 with users
  user: one(usersTable, {
    fields: [sessionsTable.userId],
    references: [usersTable.id],
  }),
}))

/**
 * Raw Emails table relations
 */
export const rawEmailsRelations = relations(
  rawEmailsTable,
  ({ one, many }) => ({
    // N:1 with users
    user: one(usersTable, {
      fields: [rawEmailsTable.userId],
      references: [usersTable.id],
    }),
    // 1:N with transactions
    transactions: many(transactionsTable),
    // 1:N with statements
    statements: many(statementsTable),
  }),
)

/**
 * Statements table relations
 */
export const statementsRelations = relations(
  statementsTable,
  ({ one, many }) => ({
    // N:1 with users
    user: one(usersTable, {
      fields: [statementsTable.userId],
      references: [usersTable.id],
    }),
    // N:1 with raw_emails
    sourceEmail: one(rawEmailsTable, {
      fields: [statementsTable.sourceEmailId],
      references: [rawEmailsTable.id],
    }),
    // 1:N with transactions
    transactions: many(transactionsTable),
  }),
)

/**
 * Transactions table relations
 */
export const transactionsRelations = relations(
  transactionsTable,
  ({ one }) => ({
    // N:1 with users
    user: one(usersTable, {
      fields: [transactionsTable.userId],
      references: [usersTable.id],
    }),
    // N:1 with raw_emails
    sourceEmail: one(rawEmailsTable, {
      fields: [transactionsTable.sourceEmailId],
      references: [rawEmailsTable.id],
    }),
    // N:1 with statements
    statement: one(statementsTable, {
      fields: [transactionsTable.statementId],
      references: [statementsTable.id],
    }),
  }),
)

/**
 * Merchant category rules table relations
 */
export const merchantCategoryRulesRelations = relations(
  merchantCategoryRulesTable,
  ({ one }) => ({
    // N:1 with users
    user: one(usersTable, {
      fields: [merchantCategoryRulesTable.userId],
      references: [usersTable.id],
    }),
  }),
)

/**
 * WebAuthn credentials relations
 */
export const webauthnCredentialsRelations = relations(
  webauthnCredentialsTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [webauthnCredentialsTable.userId],
      references: [usersTable.id],
    }),
  }),
)

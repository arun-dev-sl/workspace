import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  bigint,
} from 'drizzle-orm/pg-core'

import { usersTable } from './users.schema.js'

/**
 * WebAuthn Credentials table definition
 *
 * Stores passkey metadata per user for WebAuthn authentication
 */
export const webauthnCredentialsTable = pgTable(
  'webauthn_credentials',
  {
    // Primary key
    id: text('id').primaryKey(),

    // Owner
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),

    // Credential identifiers
    credentialId: text('credential_id').notNull(),
    publicKey: text('public_key').notNull(),
    counter: bigint('counter', { mode: 'number' }).notNull().default(0),
    transports: text('transports').array(),
    deviceType: text('device_type'),
    backedUp: boolean('backed_up').notNull().default(false),
    aaguid: text('aaguid'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('webauthn_credentials_credential_id_idx').on(table.credentialId),
    index('webauthn_credentials_user_id_idx').on(table.userId),
  ],
)

export type WebauthnCredentialDatabase = typeof webauthnCredentialsTable.$inferSelect
export type InsertWebauthnCredentialDatabase = typeof webauthnCredentialsTable.$inferInsert

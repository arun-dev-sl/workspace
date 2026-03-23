import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { usersTable } from './auth/users.schema.js'

export const aiConversationsTable = pgTable('ai_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New conversation'),
  model: text('model'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const aiMessagesTable = pgTable('ai_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => aiConversationsTable.id, { onDelete: 'cascade' }),
  role: text('role').notNull().$type<'user' | 'assistant'>(),
  content: text('content').notNull(),
  toolCalls: jsonb('tool_calls'),
  analysis: jsonb('analysis'),
  usage: jsonb('usage'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const aiMessageFeedbackTable = pgTable('ai_message_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => aiMessagesTable.id, { onDelete: 'cascade' }),
  rating: text('rating').notNull().$type<'thumbs_up' | 'thumbs_down'>(),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type AiConversation = typeof aiConversationsTable.$inferSelect
export type InsertAiConversation = typeof aiConversationsTable.$inferInsert
export type AiMessage = typeof aiMessagesTable.$inferSelect
export type InsertAiMessage = typeof aiMessagesTable.$inferInsert
export type AiMessageFeedback = typeof aiMessageFeedbackTable.$inferSelect
export type InsertAiMessageFeedback = typeof aiMessageFeedbackTable.$inferInsert

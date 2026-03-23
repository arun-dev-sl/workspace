import { Inject, Injectable } from '@nestjs/common'
import { aiConversationsTable, aiMessagesTable, aiMessageFeedbackTable } from '@workspace/database'
import { and, count, desc, eq } from 'drizzle-orm'

import { DB_TOKEN } from '@/shared/infrastructure/db/db.port'

import type { AiConversationRepository } from '@/modules/ai-assistant/application/ports/ai-conversation.repository.port'
import type { DrizzleDb } from '@/shared/infrastructure/db/db.port'
import type {
  AiConversation,
  AiMessage,
  AiMessageFeedback,
  InsertAiConversation,
  InsertAiMessage,
} from '@workspace/database'

@Injectable()
export class AiConversationRepositoryImpl implements AiConversationRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDb) {}

  async createConversation(data: Omit<InsertAiConversation, 'id' | 'createdAt' | 'updatedAt'>): Promise<AiConversation> {
    const [conversation] = await this.db.insert(aiConversationsTable).values(data).returning()
    if (!conversation) throw new Error('Failed to create conversation')
    return conversation
  }

  async findConversationById(id: string, userId: string): Promise<AiConversation | null> {
    const [conversation] = await this.db
      .select()
      .from(aiConversationsTable)
      .where(and(eq(aiConversationsTable.id, id), eq(aiConversationsTable.userId, userId)))
    return conversation ?? null
  }

  async findConversationsByUserId(userId: string, limit: number, offset: number): Promise<{ data: AiConversation[]; total: number }> {
    const [data, [totalRow]] = await Promise.all([
      this.db
        .select()
        .from(aiConversationsTable)
        .where(eq(aiConversationsTable.userId, userId))
        .orderBy(desc(aiConversationsTable.updatedAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(aiConversationsTable)
        .where(eq(aiConversationsTable.userId, userId)),
    ])
    return { data, total: totalRow?.count ?? 0 }
  }

  async updateConversationTitle(id: string, userId: string, title: string): Promise<AiConversation | null> {
    const [conversation] = await this.db
      .update(aiConversationsTable)
      .set({ title })
      .where(and(eq(aiConversationsTable.id, id), eq(aiConversationsTable.userId, userId)))
      .returning()
    return conversation ?? null
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(aiConversationsTable)
      .where(and(eq(aiConversationsTable.id, id), eq(aiConversationsTable.userId, userId)))
      .returning()
    return result.length > 0
  }

  async addMessage(data: Omit<InsertAiMessage, 'id' | 'createdAt'>): Promise<AiMessage> {
    const [message] = await this.db.insert(aiMessagesTable).values(data).returning()
    if (!message) throw new Error('Failed to create message')
    return message
  }

  async getMessages(conversationId: string): Promise<AiMessage[]> {
    return this.db
      .select()
      .from(aiMessagesTable)
      .where(eq(aiMessagesTable.conversationId, conversationId))
      .orderBy(aiMessagesTable.createdAt)
  }

  async addFeedback(messageId: string, rating: 'thumbs_up' | 'thumbs_down', comment?: string): Promise<AiMessageFeedback> {
    const [feedback] = await this.db
      .insert(aiMessageFeedbackTable)
      .values({ messageId, rating, comment })
      .returning()
    if (!feedback) throw new Error('Failed to create feedback')
    return feedback
  }
}

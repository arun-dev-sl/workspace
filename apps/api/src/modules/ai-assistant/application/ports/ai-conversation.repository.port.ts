import type { AiConversation, AiMessage, InsertAiConversation, InsertAiMessage, AiMessageFeedback } from '@workspace/database'

export interface AiConversationRepository {
  createConversation(data: Omit<InsertAiConversation, 'id' | 'createdAt' | 'updatedAt'>): Promise<AiConversation>
  findConversationById(id: string, userId: string): Promise<AiConversation | null>
  findConversationsByUserId(userId: string, limit: number, offset: number): Promise<{ data: AiConversation[]; total: number }>
  updateConversationTitle(id: string, userId: string, title: string): Promise<AiConversation | null>
  deleteConversation(id: string, userId: string): Promise<boolean>

  addMessage(data: Omit<InsertAiMessage, 'id' | 'createdAt'>): Promise<AiMessage>
  getMessages(conversationId: string): Promise<AiMessage[]>

  addFeedback(messageId: string, rating: 'thumbs_up' | 'thumbs_down', comment?: string): Promise<AiMessageFeedback>
}

export const AI_CONVERSATION_REPOSITORY = Symbol('AI_CONVERSATION_REPOSITORY')

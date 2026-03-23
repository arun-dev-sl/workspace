import { z } from 'zod'

export const AiAssistantChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
})

const AiAssistantPageContextSchema = z.object({
  pageId: z.string().trim().max(80),
  title: z.string().trim().max(200),
  route: z.string().trim().max(200),
  description: z.string().trim().max(500).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  dataSnapshot: z.record(z.string(), z.unknown()).optional(),
}).optional()

const RawAiAssistantChatRequestSchema = z.object({
  messages: z.array(AiAssistantChatMessageSchema).min(1).max(40),
  model: z.string().trim().max(120).optional(),
  pageContext: AiAssistantPageContextSchema,
  conversationId: z.string().uuid().optional(),
})

export const AiAssistantChatRequestSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  if (
    typeof value === 'object'
    && value !== null
    && 'body' in value
    && typeof value.body === 'object'
    && value.body !== null
  ) {
    return value.body
  }

  return value
}, RawAiAssistantChatRequestSchema)

export type AiAssistantChatRequest = z.infer<typeof AiAssistantChatRequestSchema>

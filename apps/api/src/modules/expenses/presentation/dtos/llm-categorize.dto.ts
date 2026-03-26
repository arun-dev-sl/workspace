import { z } from 'zod'

export const LlmProviderEnum = z.enum(['openwire', 'gemini'])
export type LlmProvider = z.infer<typeof LlmProviderEnum>

export const LlmCategorizeRequestSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(50),
  provider: LlmProviderEnum,
})
export type LlmCategorizeRequest = z.infer<typeof LlmCategorizeRequestSchema>

export const LlmCategorizationSuggestionSchema = z.object({
  id: z.string(),
  category: z.string(),
  subcategory: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})

export const LlmCategorizeResponseSchema = z.object({
  suggestions: z.array(LlmCategorizationSuggestionSchema),
})

export type LlmCategorizationSuggestion = z.infer<typeof LlmCategorizationSuggestionSchema>

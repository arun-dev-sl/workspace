import { z } from 'zod'

export const ProcessFlightLlmReviewRequestSchema = z.object({
  emailIds: z.array(z.string().uuid()).min(1).max(100),
})

export type ProcessFlightLlmReviewRequest = z.infer<typeof ProcessFlightLlmReviewRequestSchema>

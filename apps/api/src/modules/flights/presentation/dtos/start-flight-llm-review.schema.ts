import { z } from 'zod'

export const StartFlightLlmReviewRequestSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type StartFlightLlmReviewRequest = z.infer<typeof StartFlightLlmReviewRequestSchema>

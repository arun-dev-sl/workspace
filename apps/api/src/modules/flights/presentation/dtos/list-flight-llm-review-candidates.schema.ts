import { z } from 'zod'

export const ListFlightLlmReviewCandidatesQuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export type ListFlightLlmReviewCandidatesQuery = z.infer<
    typeof ListFlightLlmReviewCandidatesQuerySchema
>

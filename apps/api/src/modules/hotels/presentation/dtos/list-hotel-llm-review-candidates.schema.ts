import { z } from 'zod'

export const ListHotelLlmReviewCandidatesQuerySchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  })

export type ListHotelLlmReviewCandidatesQuery = z.infer<
  typeof ListHotelLlmReviewCandidatesQuerySchema
>

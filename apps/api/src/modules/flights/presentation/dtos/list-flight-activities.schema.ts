import { z } from 'zod'

export const ListFlightActivitiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListFlightActivitiesQuery = z.infer<
  typeof ListFlightActivitiesQuerySchema
>

import { z } from 'zod'

export const SyncFlightsRequestSchema = z.object({
  query: z.string().trim().max(512).optional(),
  after: z.string().trim().max(512).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export type SyncFlightsRequest = z.infer<typeof SyncFlightsRequestSchema>

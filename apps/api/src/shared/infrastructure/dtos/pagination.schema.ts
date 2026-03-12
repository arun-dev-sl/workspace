import { z } from 'zod'

const coerceInt = z.coerce.number().int()

export const OffsetPaginationSchema = z.object({
  page: coerceInt.min(1).default(1),
  page_size: coerceInt.min(1).max(100).default(20),
})

export type OffsetPaginationInput = z.infer<typeof OffsetPaginationSchema>

export const CursorPaginationSchema = z.object({
  page_size: coerceInt.min(1).max(100).default(20),
  cursor: z.string().optional(),
})

export type CursorPaginationInput = z.infer<typeof CursorPaginationSchema>

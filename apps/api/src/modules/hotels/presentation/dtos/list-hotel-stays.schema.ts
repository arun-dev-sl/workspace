import { z } from 'zod'

export const ListHotelStaysQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
  includeArchived: z.preprocess(
    (value) => {
      if (value === undefined) {
        return false
      }

      if (value === true || value === 'true') {
        return true
      }

      if (value === false || value === 'false') {
        return false
      }

      return value
    },
    z.boolean(),
  ),
})

export type ListHotelStaysQuery = z.infer<typeof ListHotelStaysQuerySchema>

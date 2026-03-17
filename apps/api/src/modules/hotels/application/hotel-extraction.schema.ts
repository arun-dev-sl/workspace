import { z } from 'zod'

export const HotelStayDraftSchema = z.object({
  hotelName: z.string().trim().min(1).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  city: z.string().trim().min(1).nullable().optional(),
  country: z.string().trim().min(1).nullable().optional(),
  timezone: z.string().trim().min(1).nullable().optional(),
  checkInDate: z.string().trim().min(1).nullable().optional(),
  checkOutDate: z.string().trim().min(1).nullable().optional(),
  nights: z.number().int().nonnegative().nullable().optional(),
  pricingCurrency: z.string().trim().min(1).nullable().optional(),
  pricingTotal: z.number().nonnegative().nullable().optional(),
  pricingNightly: z.number().nonnegative().nullable().optional(),
})
export type HotelStayDraft = z.infer<typeof HotelStayDraftSchema>

export const HotelLlmResponseSchema = z.object({
  stay: HotelStayDraftSchema.nullable().default(null),
})
export type HotelLlmResponse = z.infer<typeof HotelLlmResponseSchema>

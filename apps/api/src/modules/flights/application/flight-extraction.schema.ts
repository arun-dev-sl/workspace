import { z } from 'zod'

export const FlightExtractionFailureReasonSchema = z.enum([
  'llm_budget_exhausted',
])
export type FlightExtractionFailureReason = z.infer<
  typeof FlightExtractionFailureReasonSchema
>

export const FlightSegmentDraftSchema = z.object({
  segmentIndex: z.number().int().nonnegative().optional(),
  pnr: z.string().trim().min(1).nullable().optional(),
  airlineName: z.string().trim().min(1).nullable().optional(),
  flightNumber: z.string().trim().min(1).nullable().optional(),
  fromAirport: z.string().trim().min(1).nullable().optional(),
  toAirport: z.string().trim().min(1).nullable().optional(),
  departureDate: z.string().trim().min(1).nullable().optional(),
  departureTime: z.string().trim().min(1).nullable().optional(),
  arrivalDate: z.string().trim().min(1).nullable().optional(),
  arrivalTime: z.string().trim().min(1).nullable().optional(),
  departureAt: z.string().trim().min(1).nullable().optional(),
  arrivalAt: z.string().trim().min(1).nullable().optional(),
  departureTimezone: z.string().trim().min(1).nullable().optional(),
  arrivalTimezone: z.string().trim().min(1).nullable().optional(),
  travelClass: z.string().trim().min(1).nullable().optional(),
})
export type FlightSegmentDraft = z.infer<typeof FlightSegmentDraftSchema>

export const FlightSegmentSchema = z.object({
  segmentIndex: z.number().int().nonnegative(),
  pnr: z.string().nullable(),
  airlineName: z.string().nullable(),
  flightNumber: z.string(),
  fromAirport: z.string().regex(/^[A-Z]{3}$/),
  toAirport: z.string().regex(/^[A-Z]{3}$/),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departureTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  arrivalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  departureAt: z.iso.datetime().nullable(),
  arrivalAt: z.iso.datetime().nullable(),
  departureTimezone: z.string().nullable(),
  arrivalTimezone: z.string().nullable(),
  travelClass: z.string().nullable(),
})
export type FlightSegment = z.infer<typeof FlightSegmentSchema>

export const FlightLlmResponseSchema = z.object({
  segments: z.array(FlightSegmentDraftSchema).default([]),
})
export type FlightLlmResponse = z.infer<typeof FlightLlmResponseSchema>

export interface FlightExtractionResult {
  segments: FlightSegment[]
  extractionMethod: 'none' | 'json_ld' | 'heuristic' | 'llm'
  llmAttempted: boolean
  failureReason?: FlightExtractionFailureReason
}

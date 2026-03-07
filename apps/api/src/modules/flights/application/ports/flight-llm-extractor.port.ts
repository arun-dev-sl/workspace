import type { FlightSegmentDraft } from '@/modules/flights/application/flight-extraction.schema'

export interface FlightLlmPromptInput {
  subject: string
  from: string
  receivedAt: string
  text: string
}

export interface FlightLlmExtractor {
  extract(input: FlightLlmPromptInput): Promise<FlightSegmentDraft[]>
}

export const FLIGHT_LLM_EXTRACTOR = Symbol('FLIGHT_LLM_EXTRACTOR')

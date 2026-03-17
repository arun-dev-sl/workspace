import type { HotelStayDraft } from '@/modules/hotels/application/hotel-extraction.schema'

export interface HotelLlmPromptInput {
  subject: string
  from: string
  receivedAt: string
  text: string
}

export interface HotelLlmExtractor {
  extract(input: HotelLlmPromptInput): Promise<HotelStayDraft | null>
}

export const HOTEL_LLM_EXTRACTOR = Symbol('HOTEL_LLM_EXTRACTOR')

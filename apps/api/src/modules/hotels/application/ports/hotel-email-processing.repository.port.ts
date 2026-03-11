import type {
  HotelEmailProcessing,
  HotelLlmReviewCandidate,
  HotelProcessingStatus,
  HotelRecordedExtractionMethod,
  RawEmail,
} from '@workspace/domain'

export interface UpsertHotelEmailProcessingParams {
  userId: string
  sourceEmailId: string
  status: HotelProcessingStatus
  extractionMethod: HotelRecordedExtractionMethod[]
  matchedStays: number
  llmAttempts: number
  lastError?: string | null
  processedAt?: Date
}

export interface HotelEmailProcessingRepository {
  findBySourceEmailId(params: {
    userId: string
    sourceEmailId: string
  }): Promise<HotelEmailProcessing | null>
  upsert(params: UpsertHotelEmailProcessingParams): Promise<HotelEmailProcessing>
  listEmailsBySourceEmailIds(params: {
    userId: string
    sourceEmailIds: string[]
  }): Promise<RawEmail[]>
  listLlmReviewCandidates(params: {
    userId: string
    receivedFrom: Date
    receivedTo: Date
    limit: number
  }): Promise<HotelLlmReviewCandidate[]>
}

export const HOTEL_EMAIL_PROCESSING_REPOSITORY = Symbol('HOTEL_EMAIL_PROCESSING_REPOSITORY')

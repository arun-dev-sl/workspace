import type {
  FlightEmailProcessing,
  FlightExtractionMethod,
  FlightLlmReviewCandidate,
  FlightProcessingStatus,
  RawEmail,
} from '@workspace/domain'

export interface UpsertFlightEmailProcessingParams {
  userId: string
  sourceEmailId: string
  status: FlightProcessingStatus
  extractionMethod: FlightExtractionMethod
  matchedActivities: number
  llmAttempts: number
  lastError?: string | null
  processedAt?: Date
}

export interface FlightEmailProcessingRepository {
  findBySourceEmailId(params: {
    userId: string
    sourceEmailId: string
  }): Promise<FlightEmailProcessing | null>
  upsert(params: UpsertFlightEmailProcessingParams): Promise<FlightEmailProcessing>
  listEmailsForProcessing(params: {
    userId: string
    limit: number
    offset?: number
    forceProcessAll?: boolean
    receivedAfter?: Date
  }): Promise<RawEmail[]>
  listEmailsBySourceEmailIds(params: {
    userId: string
    sourceEmailIds: string[]
  }): Promise<RawEmail[]>
  listLlmReviewCandidates(params: {
    userId: string
    receivedAfter: Date
    limit: number
  }): Promise<FlightLlmReviewCandidate[]>
}

export const FLIGHT_EMAIL_PROCESSING_REPOSITORY = Symbol('FLIGHT_EMAIL_PROCESSING_REPOSITORY')

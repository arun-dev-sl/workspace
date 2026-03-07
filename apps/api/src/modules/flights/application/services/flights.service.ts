import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { format, isValid, parseISO } from 'date-fns'

import {
  RAW_EMAIL_REPOSITORY,
} from '@/modules/expenses/application/ports/raw-email.repository.port'
import {
  SYNC_JOB_REPOSITORY,
} from '@/modules/expenses/application/ports/sync-job.repository.port'
import {
  FLIGHT_ACTIVITY_REPOSITORY,
} from '@/modules/flights/application/ports/flight-activity.repository.port'
import {
  FLIGHT_EMAIL_PROCESSING_REPOSITORY,
} from '@/modules/flights/application/ports/flight-email-processing.repository.port'
import {
  buildFlightActivityId,
  buildFlightCanonicalHash,
  normalizeAirportCode,
  normalizeDateValue,
  normalizeNullableText,
  normalizeTimeValue,
  normalizeTravelClass,
} from '@/modules/flights/infrastructure/extractors/flight-extractor.utils'
import { FlightLlmInvocationError, HybridFlightExtractor } from '@/modules/flights/infrastructure/extractors/hybrid-flight.extractor'
import { EmailSyncService } from '@/shared/application/services/email-sync.service'

import type { Env } from '@/app/config/env.schema'
import type { RawEmailRepository } from '@/modules/expenses/application/ports/raw-email.repository.port'
import type { SyncJob, SyncJobRepository } from '@/modules/expenses/application/ports/sync-job.repository.port'
import type { FlightSegment } from '@/modules/flights/application/flight-extraction.schema'
import type { FlightActivityRepository } from '@/modules/flights/application/ports/flight-activity.repository.port'
import type { FlightEmailProcessingRepository } from '@/modules/flights/application/ports/flight-email-processing.repository.port'
import type {
  FlightActivity,
  FlightSyncJobStatus,
  RawEmail,
  UpdateFlightActivityInput,
} from '@workspace/domain'

const FLIGHT_CATEGORY = 'flights'
const FLIGHT_QUERY_TERMS = 'subject:(flight OR itinerary OR booking OR reservation OR "e-ticket" OR "trip confirmation" OR "travel confirmation") OR "flight number" OR pnr'

@Injectable()
export class FlightsService {
  private static readonly EMAIL_PROCESS_BATCH_SIZE = 20

  private readonly logger = new Logger(FlightsService.name)

  constructor(
    @Inject(FLIGHT_ACTIVITY_REPOSITORY)
    private readonly flightActivityRepository: FlightActivityRepository,
    @Inject(FLIGHT_EMAIL_PROCESSING_REPOSITORY)
    private readonly flightEmailProcessingRepository: FlightEmailProcessingRepository,
    @Inject(RAW_EMAIL_REPOSITORY)
    private readonly rawEmailRepository: RawEmailRepository,
    @Inject(SYNC_JOB_REPOSITORY)
    private readonly syncJobRepository: SyncJobRepository,
    private readonly emailSyncService: EmailSyncService,
    private readonly hybridFlightExtractor: HybridFlightExtractor,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  async startSyncJob(params: {
    userId: string
    query?: string
    fromDate?: string
  }): Promise<{ jobId: string }> {
    const query = params.query
      ?? (params.fromDate
        ? this.buildSyncQueryFromDate(params.fromDate)
        : await this.emailSyncService.buildIncrementalQuery(
            params.userId,
            FLIGHT_CATEGORY,
            FLIGHT_QUERY_TERMS,
          ))

    const { jobId } = await this.emailSyncService.startSync({
      userId: params.userId,
      query,
      category: FLIGHT_CATEGORY,
    })

    this.runPostSyncProcessing(jobId, params.userId).catch((error) => {
      this.logger.error(`Flight post-sync processing for job ${jobId} failed`, error)
    })

    return { jobId }
  }

  async startReprocessJob(params: {
    userId: string
    forceProcessAll?: boolean
  }): Promise<{ jobId: string }> {
    const job = await this.syncJobRepository.create({
      userId: params.userId,
      category: FLIGHT_CATEGORY,
      query: '__reprocess__',
    })

    this.runReprocessJob(job.id, params.userId, params.forceProcessAll ?? false).catch(
      async (error) => {
        this.logger.error(`Flight reprocess job ${job.id} failed`, error)
        await this.syncJobRepository.update(job.id, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unexpected error',
          completedAt: new Date(),
        })
      },
    )

    return { jobId: job.id }
  }

  async getSyncJobStatus(jobId: string): Promise<FlightSyncJobStatus | null> {
    const job = await this.emailSyncService.getSyncJobStatus(jobId)
    if (job?.category !== FLIGHT_CATEGORY) {
      return null
    }

    return this.toFlightSyncJob(job)
  }

  async getUserSyncJobs(userId: string, limit = 10): Promise<FlightSyncJobStatus[]> {
    const jobs = await this.emailSyncService.getUserSyncJobs(userId, limit, FLIGHT_CATEGORY)
    return jobs.map((job) => this.toFlightSyncJob(job))
  }

  async listFlightActivities(params: {
    userId: string
    limit: number
    offset: number
  }): Promise<{ data: FlightActivity[], total: number }> {
    const [data, total] = await Promise.all([
      this.flightActivityRepository.listByUser(params),
      this.flightActivityRepository.countByUser(params.userId),
    ])

    return { data, total }
  }

  async getFlightActivityById(params: {
    userId: string
    id: string
  }): Promise<FlightActivity | null> {
    return this.flightActivityRepository.findById(params)
  }

  async getFlightEmailById(params: {
    userId: string
    id: string
  }): Promise<RawEmail | null> {
    const email = await this.rawEmailRepository.findById(params)
    if (email?.category !== FLIGHT_CATEGORY) {
      return null
    }

    return email
  }

  async updateFlightActivity(params: {
    userId: string
    id: string
    data: UpdateFlightActivityInput
  }): Promise<FlightActivity> {
    const existing = await this.flightActivityRepository.findById({
      userId: params.userId,
      id: params.id,
    })

    if (!existing) {
      throw new NotFoundException('Flight activity not found')
    }

    const updated = this.buildUpdatedFlightActivity(existing, params.data)

    try {
      return await this.flightActivityRepository.update(updated)
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A flight activity with the same itinerary details already exists',
        )
      }

      throw error
    }
  }

  private buildSyncQueryFromDate(fromDate: string): string {
    const parsedDate = parseISO(fromDate)

    if (!isValid(parsedDate)) {
      throw new BadRequestException('Invalid fromDate. Expected format: YYYY-MM-DD.')
    }

    return `${FLIGHT_QUERY_TERMS} after:${format(parsedDate, 'yyyy/MM/dd')}`
  }

  private async runPostSyncProcessing(jobId: string, userId: string): Promise<void> {
    const MAX_WAIT_MS = 30 * 60 * 1000
    const POLL_INTERVAL_MS = 5000
    const startedAt = Date.now()

    while (Date.now() - startedAt < MAX_WAIT_MS) {
      const job = await this.emailSyncService.getSyncJobStatus(jobId)
      if (job?.category !== FLIGHT_CATEGORY) {
        return
      }

      if (job.status === 'completed') {
        break
      }

      if (job.status === 'failed') {
        return
      }

      await this.sleep(POLL_INTERVAL_MS)
    }

    await this.processEmails(jobId, userId, false, false)
  }

  private async runReprocessJob(
    jobId: string,
    userId: string,
    forceProcessAll: boolean,
  ): Promise<void> {
    await this.syncJobRepository.update(jobId, {
      status: 'processing',
      startedAt: new Date(),
    })

    const totalEmails = await this.processEmails(jobId, userId, forceProcessAll, true)

    await this.syncJobRepository.update(jobId, {
      status: 'completed',
      totalEmails,
      completedAt: new Date(),
    })
  }

  private async processEmails(
    jobId: string,
    userId: string,
    forceProcessAll: boolean,
    shouldUpdateTotalEmails: boolean,
  ): Promise<number> {
    let totalEmails = 0
    let offset = 0
    let remainingLlmCalls = this.getLlmMaxCallsPerJob()

    while (true) {
      const emails = await this.flightEmailProcessingRepository.listEmailsForProcessing({
        userId,
        limit: FlightsService.EMAIL_PROCESS_BATCH_SIZE,
        ...(forceProcessAll ? { offset } : {}),
        forceProcessAll,
      })

      if (emails.length === 0) {
        break
      }

      totalEmails += emails.length
      if (shouldUpdateTotalEmails) {
        await this.syncJobRepository.update(jobId, { totalEmails })
      }

      for (const email of emails) {
        const result = await this.processSingleEmail(email, remainingLlmCalls)
        remainingLlmCalls -= result.llmCallsUsed

        if (shouldUpdateTotalEmails) {
          await this.syncJobRepository.incrementProgress(jobId, 'processedEmails', 1)
        }
        if (result.activities > 0) {
          await this.syncJobRepository.incrementProgress(jobId, 'transactions', result.activities)
        }
      }

      if (forceProcessAll) {
        offset += emails.length
      }
    }

    return totalEmails
  }

  private async processSingleEmail(
    email: RawEmail,
    remainingLlmCalls: number,
  ): Promise<{ activities: number, llmCallsUsed: number }> {
    const existingProcessing = await this.flightEmailProcessingRepository.findBySourceEmailId({
      userId: email.userId,
      sourceEmailId: email.id,
    })
    const existingActivities = await this.flightActivityRepository.listBySourceEmailId({
      userId: email.userId,
      sourceEmailId: email.id,
    })

    if (existingActivities.some((activity) => activity.extractionMethod === 'manual')) {
      return { activities: 0, llmCallsUsed: 0 }
    }

    const existingLlmAttempts = existingProcessing?.llmAttempts ?? 0
    const llmEnabled = this.isLlmEnabled()

    try {
      const extraction = await this.hybridFlightExtractor.extract(email, {
        maxInputChars: this.configService.get('FLIGHTS_LLM_MAX_INPUT_CHARS', {
          infer: true,
        }),
        allowLlm: llmEnabled && remainingLlmCalls > 0 && existingLlmAttempts === 0,
        failOnLlmBudgetExhausted:
          llmEnabled && remainingLlmCalls <= 0 && existingLlmAttempts === 0,
      })

      if (extraction.failureReason === 'llm_budget_exhausted') {
        await this.flightEmailProcessingRepository.upsert({
          userId: email.userId,
          sourceEmailId: email.id,
          status: 'failed',
          extractionMethod: 'none',
          matchedActivities: 0,
          llmAttempts: existingLlmAttempts,
          lastError: 'llm_budget_exhausted',
          processedAt: new Date(),
        })

        return { activities: 0, llmCallsUsed: 0 }
      }

      const llmCallsUsed = extraction.llmAttempted ? 1 : 0

      if (extraction.segments.length === 0) {
        await this.flightEmailProcessingRepository.upsert({
          userId: email.userId,
          sourceEmailId: email.id,
          status: 'no_match',
          extractionMethod: extraction.extractionMethod,
          matchedActivities: 0,
          llmAttempts: existingLlmAttempts + llmCallsUsed,
          lastError: null,
          processedAt: new Date(),
        })

        return { activities: 0, llmCallsUsed }
      }

      if (extraction.extractionMethod === 'none') {
        throw new Error('Flight extraction returned segments without a valid extraction method')
      }

      const extractionMethod = extraction.extractionMethod
      const activities = extraction.segments.map((segment) =>
        this.toFlightActivity(email, segment, extractionMethod),
      )

      await this.flightActivityRepository.upsertMany(activities)
      await this.flightEmailProcessingRepository.upsert({
        userId: email.userId,
        sourceEmailId: email.id,
        status: 'matched',
        extractionMethod: extraction.extractionMethod,
        matchedActivities: activities.length,
        llmAttempts: existingLlmAttempts + llmCallsUsed,
        lastError: null,
        processedAt: new Date(),
      })

      return { activities: activities.length, llmCallsUsed }
    } catch (error) {
      const llmCallsUsed = error instanceof FlightLlmInvocationError ? 1 : 0
      const message
        = error instanceof Error
          ? error.message
          : `Flight extraction failed for email ${email.id}`

      this.logger.warn(message)

      await this.flightEmailProcessingRepository.upsert({
        userId: email.userId,
        sourceEmailId: email.id,
        status: 'failed',
        extractionMethod: llmCallsUsed > 0 ? 'llm' : 'none',
        matchedActivities: 0,
        llmAttempts: existingLlmAttempts + llmCallsUsed,
        lastError: message,
        processedAt: new Date(),
      })

      return { activities: 0, llmCallsUsed }
    }
  }

  private toFlightActivity(
    email: RawEmail,
    segment: FlightSegment,
    extractionMethod: 'json_ld' | 'heuristic' | 'llm',
  ): FlightActivity {
    const canonicalHash = buildFlightCanonicalHash({
      userId: email.userId,
      sourceEmailId: email.id,
      segmentIndex: segment.segmentIndex,
      pnr: segment.pnr,
      flightNumber: segment.flightNumber,
      fromAirport: segment.fromAirport,
      toAirport: segment.toAirport,
      departureDate: segment.departureDate,
      departureTime: segment.departureTime,
    })

    const now = new Date().toISOString()

    return {
      id: buildFlightActivityId(canonicalHash),
      userId: email.userId,
      sourceEmailId: email.id,
      activityType: 'booking_confirmation',
      extractionMethod,
      canonicalHash,
      segmentIndex: segment.segmentIndex,
      pnr: segment.pnr,
      airlineName: segment.airlineName,
      flightNumber: segment.flightNumber,
      fromAirport: segment.fromAirport,
      toAirport: segment.toAirport,
      departureDate: segment.departureDate,
      departureTime: segment.departureTime,
      arrivalDate: segment.arrivalDate,
      arrivalTime: segment.arrivalTime,
      departureAt: segment.departureAt,
      arrivalAt: segment.arrivalAt,
      departureTimezone: segment.departureTimezone,
      arrivalTimezone: segment.arrivalTimezone,
      travelClass: segment.travelClass,
      confidence: this.getConfidenceForMethod(extractionMethod),
      createdAt: now,
      updatedAt: now,
    }
  }

  private getConfidenceForMethod(method: 'json_ld' | 'heuristic' | 'llm'): number {
    switch (method) {
      case 'json_ld': {
        return 1
      }
      case 'heuristic': {
        return 0.8
      }
      case 'llm': {
        return 0.6
      }
    }
  }

  private toFlightSyncJob(job: SyncJob): FlightSyncJobStatus {
    return {
      id: job.id,
      userId: job.userId,
      status: job.status,
      query: job.query,
      totalEmails: job.totalEmails,
      processedEmails: job.processedEmails,
      newEmails: job.newEmails,
      activities: job.transactions,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    }
  }

  private buildUpdatedFlightActivity(
    existing: FlightActivity,
    data: UpdateFlightActivityInput,
  ): FlightActivity {
    const flightNumber = data.flightNumber === undefined
      ? existing.flightNumber
      : normalizeFlightNumberOrThrow(data.flightNumber, 'flightNumber')
    const fromAirport = data.fromAirport === undefined
      ? existing.fromAirport
      : normalizeAirportCodeOrThrow(data.fromAirport, 'fromAirport')
    const toAirport = data.toAirport === undefined
      ? existing.toAirport
      : normalizeAirportCodeOrThrow(data.toAirport, 'toAirport')
    const departureDate = data.departureDate === undefined
      ? existing.departureDate
      : normalizeDateOrThrow(data.departureDate, 'departureDate')

    const departureTime = data.departureTime === undefined
      ? existing.departureTime
      : normalizeNullableTimeOrThrow(data.departureTime, 'departureTime')
    const arrivalDate = data.arrivalDate === undefined
      ? existing.arrivalDate
      : normalizeNullableDateOrThrow(data.arrivalDate, 'arrivalDate')
    const arrivalTime = data.arrivalTime === undefined
      ? existing.arrivalTime
      : normalizeNullableTimeOrThrow(data.arrivalTime, 'arrivalTime')

    const departureTimezone = data.departureTimezone === undefined
      ? existing.departureTimezone
      : normalizeNullableText(data.departureTimezone)
    const arrivalTimezone = data.arrivalTimezone === undefined
      ? existing.arrivalTimezone
      : normalizeNullableText(data.arrivalTimezone)

    const departureFieldsChanged = (
      data.departureDate !== undefined
      || data.departureTime !== undefined
      || data.departureTimezone !== undefined
    )
    const arrivalFieldsChanged = (
      data.arrivalDate !== undefined
      || data.arrivalTime !== undefined
      || data.arrivalTimezone !== undefined
    )

    const departureAt = data.departureAt === undefined
      ? (departureFieldsChanged ? null : existing.departureAt)
      : normalizeNullableIsoDateTimeOrThrow(data.departureAt, 'departureAt')
    const arrivalAt = data.arrivalAt === undefined
      ? (arrivalFieldsChanged ? null : existing.arrivalAt)
      : normalizeNullableIsoDateTimeOrThrow(data.arrivalAt, 'arrivalAt')

    const canonicalHash = buildFlightCanonicalHash({
      userId: existing.userId,
      sourceEmailId: existing.sourceEmailId,
      segmentIndex: existing.segmentIndex,
      pnr: data.pnr === undefined ? existing.pnr : normalizeNullableText(data.pnr),
      flightNumber,
      fromAirport,
      toAirport,
      departureDate,
      departureTime,
    })

    return {
      ...existing,
      extractionMethod: 'manual',
      canonicalHash,
      pnr: data.pnr === undefined ? existing.pnr : normalizeNullableText(data.pnr),
      airlineName:
        data.airlineName === undefined
          ? existing.airlineName
          : normalizeNullableText(data.airlineName),
      flightNumber,
      fromAirport,
      toAirport,
      departureDate,
      departureTime,
      arrivalDate,
      arrivalTime,
      departureAt,
      arrivalAt,
      departureTimezone,
      arrivalTimezone,
      travelClass:
        data.travelClass === undefined
          ? existing.travelClass
          : normalizeTravelClass(data.travelClass),
      confidence: 1,
      updatedAt: new Date().toISOString(),
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false
    }

    const record = error as { cause?: { code?: string }, message?: string }

    return (
      record.cause?.code === '23505'
      || record.message?.toLowerCase().includes('duplicate key') === true
    )
  }

  private isLlmEnabled(): boolean {
    return (
      this.configService.get('FLIGHTS_LLM_ENABLED', { infer: true })
      && Boolean(this.configService.get('GEMINI_API_KEY', { infer: true }))
    )
  }

  private getLlmMaxCallsPerJob(): number {
    return this.configService.get('FLIGHTS_LLM_MAX_CALLS_PER_JOB', {
      infer: true,
    }) ?? 25
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

function normalizeAirportCodeOrThrow(
  value: string,
  field: 'fromAirport' | 'toAirport',
): string {
  const normalized = normalizeAirportCode(value)
  if (!normalized) {
    throw new BadRequestException(`${field} must be a valid 3-letter IATA code`)
  }

  return normalized
}

function normalizeFlightNumberOrThrow(value: string, field: 'flightNumber'): string {
  const normalized = normalizeNullableText(value)
  const compact = normalized?.replaceAll(/\s+/g, '') ?? null
  const valid = compact ? /^([A-Z0-9]{2,4}\d{1,4}[A-Z]?)$/i.test(compact) : false

  if (!valid) {
    throw new BadRequestException(`${field} must be a valid flight number`)
  }

  return compact!.toUpperCase()
}

function normalizeDateOrThrow(value: string, field: 'departureDate'): string {
  const normalized = normalizeDateValue(value)
  if (!normalized) {
    throw new BadRequestException(`${field} must be a valid date in YYYY-MM-DD format`)
  }

  return normalized
}

function normalizeNullableDateOrThrow(
  value: string | null,
  field: 'arrivalDate',
): string | null {
  if (value === null) {
    return null
  }

  const normalized = normalizeDateValue(value)
  if (!normalized) {
    throw new BadRequestException(`${field} must be a valid date in YYYY-MM-DD format`)
  }

  return normalized
}

function normalizeNullableTimeOrThrow(
  value: string | null,
  field: 'departureTime' | 'arrivalTime',
): string | null {
  if (value === null) {
    return null
  }

  const normalized = normalizeTimeValue(value)
  if (!normalized) {
    throw new BadRequestException(`${field} must be a valid time in HH:mm format`)
  }

  return normalized
}

function normalizeNullableIsoDateTimeOrThrow(
  value: string | null,
  field: 'departureAt' | 'arrivalAt',
): string | null {
  if (value === null) {
    return null
  }

  const parsed = parseISO(value)
  if (!isValid(parsed)) {
    throw new BadRequestException(`${field} must be a valid ISO datetime`)
  }

  return parsed.toISOString()
}

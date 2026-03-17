import { createHash, randomUUID } from 'node:crypto'

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfDay } from 'date-fns'

import {
  HOTEL_EMAIL_PROCESSING_REPOSITORY,
} from '@/modules/hotels/application/ports/hotel-email-processing.repository.port'
import {
  HOTEL_LLM_EXTRACTOR,
} from '@/modules/hotels/application/ports/hotel-llm-extractor.port'
import {
  HOTEL_STAY_REPOSITORY,
} from '@/modules/hotels/application/ports/hotel-stay.repository.port'
import {
  RAW_EMAIL_REPOSITORY,
} from '@/shared/application/ports/raw-email.repository.port'
import {
  SYNC_JOB_REPOSITORY,
} from '@/shared/application/ports/sync-job.repository.port'

import type { HotelStayDraft } from '@/modules/hotels/application/hotel-extraction.schema'
import type { HotelEmailProcessingRepository } from '@/modules/hotels/application/ports/hotel-email-processing.repository.port'
import type { HotelLlmExtractor } from '@/modules/hotels/application/ports/hotel-llm-extractor.port'
import type { HotelStayRepository } from '@/modules/hotels/application/ports/hotel-stay.repository.port'
import type { RawEmailRepository } from '@/shared/application/ports/raw-email.repository.port'
import type { SyncJobRepository, SyncJob } from '@/shared/application/ports/sync-job.repository.port'
import type {
  CreateHotelStayInput,
  HotelLlmReviewCandidate,
  HotelRecordedExtractionMethod,
  HotelSyncJobStatus,
  HotelStay,
  RawEmail,
  UpdateHotelStayInput,
} from '@workspace/domain'

const HOTEL_JOB_CATEGORY = 'hotels'

@Injectable()
export class HotelsService {
  private readonly logger = new Logger(HotelsService.name)

  constructor(
    @Inject(HOTEL_STAY_REPOSITORY)
    private readonly hotelStayRepository: HotelStayRepository,
    @Inject(HOTEL_EMAIL_PROCESSING_REPOSITORY)
    private readonly hotelEmailProcessingRepository: HotelEmailProcessingRepository,
    @Inject(RAW_EMAIL_REPOSITORY)
    private readonly rawEmailRepository: RawEmailRepository,
    @Inject(SYNC_JOB_REPOSITORY)
    private readonly syncJobRepository: SyncJobRepository,
    @Inject(HOTEL_LLM_EXTRACTOR)
    private readonly hotelLlmExtractor: HotelLlmExtractor,
  ) {}

  async listHotelStays(params: {
    userId: string
    limit: number
    offset: number
    includeArchived?: boolean
  }): Promise<{ data: HotelStay[], total: number }> {
    const [data, total] = await Promise.all([
      this.hotelStayRepository.listByUser(params),
      this.hotelStayRepository.countByUser(params.userId, params.includeArchived),
    ])

    return { data, total }
  }

  async archiveHotelStay(params: { userId: string, id: string }): Promise<HotelStay> {
    const existing = await this.hotelStayRepository.findById(params)
    if (!existing) {
      throw new NotFoundException('Hotel stay not found')
    }

    const archived = await this.hotelStayRepository.archive({
      ...params,
      archivedAt: new Date(),
    })

    if (!archived) {
      throw new NotFoundException('Hotel stay not found')
    }

    return archived
  }

  async unarchiveHotelStay(params: { userId: string, id: string }): Promise<HotelStay> {
    const existing = await this.hotelStayRepository.findById(params)
    if (!existing) {
      throw new NotFoundException('Hotel stay not found')
    }

    const unarchived = await this.hotelStayRepository.unarchive(params)
    if (!unarchived) {
      throw new NotFoundException('Hotel stay not found')
    }

    return unarchived
  }

  async deleteHotelStay(params: { userId: string, id: string }): Promise<void> {
    const existing = await this.hotelStayRepository.findById(params)
    if (!existing) {
      throw new NotFoundException('Hotel stay not found')
    }

    await this.hotelStayRepository.delete(params)
  }

  async getHotelStayById(params: { userId: string, id: string }): Promise<HotelStay | null> {
    return this.hotelStayRepository.findById(params)
  }

  async getHotelEmailById(params: { userId: string, id: string }): Promise<RawEmail | null> {
    return this.rawEmailRepository.findById(params)
  }

  async createHotelStay(params: {
    userId: string
    data: CreateHotelStayInput
  }): Promise<HotelStay> {
    if (params.data.sourceEmailId) {
      const email = await this.rawEmailRepository.findById({
        userId: params.userId,
        id: params.data.sourceEmailId,
      })
      if (!email) {
        throw new NotFoundException('Source email not found')
      }
    }

    const stay = this.buildManualHotelStay({
      userId: params.userId,
      data: params.data,
    })

    try {
      const saved = await this.hotelStayRepository.create(stay)
      await this.markManualSourceEmail(saved)
      return saved
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('A hotel stay with the same core itinerary already exists')
      }

      throw error
    }
  }

  async updateHotelStay(params: {
    userId: string
    id: string
    data: UpdateHotelStayInput
  }): Promise<HotelStay> {
    const existing = await this.hotelStayRepository.findById({
      userId: params.userId,
      id: params.id,
    })
    if (!existing) {
      throw new NotFoundException('Hotel stay not found')
    }

    const updated = this.buildUpdatedHotelStay(existing, params.data)

    try {
      const saved = await this.hotelStayRepository.update(updated)
      await this.markManualSourceEmail(saved)
      return saved
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('A hotel stay with the same core itinerary already exists')
      }

      throw error
    }
  }

  listLlmReviewCandidates(params: {
    userId: string
    startDate: string
    endDate: string
    limit?: number
  }): Promise<HotelLlmReviewCandidate[]> {
    const receivedFrom = this.parseDateOrThrow(params.startDate, 'startDate')
    const receivedTo = this.parseDateOrThrow(params.endDate, 'endDate')

    if (receivedTo < receivedFrom) {
      throw new BadRequestException('endDate must be on or after startDate')
    }

    return this.hotelEmailProcessingRepository.listLlmReviewCandidates({
      userId: params.userId,
      receivedFrom,
      receivedTo: addDays(receivedTo, 1),
      limit: params.limit ?? 50,
    })
  }

  async startSelectedLlmProcessingJob(params: {
    userId: string
    emailIds: string[]
  }): Promise<{ jobId: string }> {
    const sourceEmailIds = [...new Set(params.emailIds)]
    if (sourceEmailIds.length === 0) {
      throw new BadRequestException('At least one email must be selected')
    }

    const job = await this.syncJobRepository.create({
      userId: params.userId,
      category: HOTEL_JOB_CATEGORY,
      query: '__hotel_review_process__',
    })

    this.runSelectedLlmProcessingJob(job.id, params.userId, sourceEmailIds).catch(
      async (error) => {
        this.logger.error(`Hotel LLM review processing job ${job.id} failed`, error)
        await this.syncJobRepository.update(job.id, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unexpected error',
          completedAt: new Date(),
        })
      },
    )

    return { jobId: job.id }
  }

  async getSyncJobStatus(jobId: string): Promise<HotelSyncJobStatus | null> {
    const job = await this.syncJobRepository.findById(jobId)
    if (job?.category !== HOTEL_JOB_CATEGORY) {
      return null
    }

    return this.toHotelSyncJob(job)
  }

  private async runSelectedLlmProcessingJob(
    jobId: string,
    userId: string,
    sourceEmailIds: string[],
  ): Promise<void> {
    await this.syncJobRepository.update(jobId, {
      status: 'processing',
      startedAt: new Date(),
      totalEmails: sourceEmailIds.length,
    })

    const emails = await this.hotelEmailProcessingRepository.listEmailsBySourceEmailIds({
      userId,
      sourceEmailIds,
    })

    let matchedCount = 0

    for (const email of emails) {
      const existingProcessing = await this.hotelEmailProcessingRepository.findBySourceEmailId({
        userId,
        sourceEmailId: email.id,
      })

      try {
        const stayDraft = await this.hotelLlmExtractor.extract({
          subject: email.subject,
          from: email.from,
          receivedAt: email.receivedAt,
          text: this.buildHotelPromptText(email),
        })

        if (stayDraft === null) {
          await this.hotelEmailProcessingRepository.upsert({
            userId,
            sourceEmailId: email.id,
            status: 'no_match',
            extractionMethod: this.mergeExtractionMethods(
              existingProcessing?.extractionMethod ?? [],
              ['llm'],
            ),
            matchedStays: 0,
            llmAttempts: (existingProcessing?.llmAttempts ?? 0) + 1,
            lastError: null,
            processedAt: new Date(),
          })
        } else {
          const stay = this.buildExtractedHotelStay(userId, email, stayDraft)
          await this.hotelStayRepository.upsertExtracted(stay)
          await this.hotelEmailProcessingRepository.upsert({
            userId,
            sourceEmailId: email.id,
            status: 'matched',
            extractionMethod: this.mergeExtractionMethods(
              existingProcessing?.extractionMethod ?? [],
              ['llm'],
            ),
            matchedStays: 1,
            llmAttempts: (existingProcessing?.llmAttempts ?? 0) + 1,
            lastError: null,
            processedAt: new Date(),
          })
          matchedCount += 1
        }
      } catch (error) {
        await this.hotelEmailProcessingRepository.upsert({
          userId,
          sourceEmailId: email.id,
          status: 'failed',
          extractionMethod: this.mergeExtractionMethods(
            existingProcessing?.extractionMethod ?? [],
            ['llm'],
          ),
          matchedStays: 0,
          llmAttempts: (existingProcessing?.llmAttempts ?? 0) + 1,
          lastError: error instanceof Error ? error.message : 'Unexpected extraction error',
          processedAt: new Date(),
        })
      }

      await this.syncJobRepository.incrementProgress(jobId, 'processedEmails', 1)
    }

    await this.syncJobRepository.update(jobId, {
      status: 'completed',
      newEmails: matchedCount,
      completedAt: new Date(),
    })
  }

  private buildManualHotelStay(params: {
    userId: string
    data: CreateHotelStayInput
  }): HotelStay {
    const id = randomUUID()
    const normalizedDates = this.normalizeStayDates(
      params.data.checkInDate,
      params.data.checkOutDate,
      params.data.nights,
    )
    const hotelName = this.normalizeRequiredText(params.data.hotelName, 'hotelName')

    return {
      id,
      userId: params.userId,
      sourceEmailId: params.data.sourceEmailId ?? null,
      extractionMethod: ['manual'],
      canonicalHash: this.buildHotelCanonicalHash({
        fallbackKey: id,
        userId: params.userId,
        hotelName,
        city: params.data.city ?? null,
        checkInDate: normalizedDates.checkInDate,
        checkOutDate: normalizedDates.checkOutDate,
      }),
      hotelName,
      lat: params.data.lat ?? null,
      lng: params.data.lng ?? null,
      city: this.normalizeOptionalText(params.data.city),
      country: this.normalizeOptionalText(params.data.country),
      timezone: this.normalizeOptionalText(params.data.timezone),
      checkInDate: normalizedDates.checkInDate,
      checkOutDate: normalizedDates.checkOutDate,
      nights: normalizedDates.nights,
      extractionMetadata: { createdVia: 'manual' },
      confidence: 1,
      pricing: {
        currency: this.normalizeOptionalText(params.data.pricing?.currency),
        total: params.data.pricing?.total ?? null,
        nightly: params.data.pricing?.nightly ?? null,
      },
      archivedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  private buildUpdatedHotelStay(existing: HotelStay, data: UpdateHotelStayInput): HotelStay {
    const hotelName = data.hotelName === undefined
      ? existing.hotelName
      : this.normalizeRequiredText(data.hotelName, 'hotelName')

    const normalizedDates = this.normalizeStayDates(
      data.checkInDate ?? existing.checkInDate,
      data.checkOutDate ?? existing.checkOutDate,
      data.nights ?? existing.nights,
    )

    return {
      ...existing,
      extractionMethod: this.mergeExtractionMethods(existing.extractionMethod, ['manual']),
      canonicalHash: this.buildHotelCanonicalHash({
        fallbackKey: existing.sourceEmailId ?? existing.id,
        userId: existing.userId,
        hotelName,
        city: data.city === undefined ? existing.city : this.normalizeOptionalText(data.city),
        checkInDate: normalizedDates.checkInDate,
        checkOutDate: normalizedDates.checkOutDate,
      }),
      hotelName,
      lat: data.lat === undefined ? existing.lat : data.lat,
      lng: data.lng === undefined ? existing.lng : data.lng,
      city: data.city === undefined ? existing.city : this.normalizeOptionalText(data.city),
      country:
        data.country === undefined ? existing.country : this.normalizeOptionalText(data.country),
      timezone:
        data.timezone === undefined ? existing.timezone : this.normalizeOptionalText(data.timezone),
      checkInDate: normalizedDates.checkInDate,
      checkOutDate: normalizedDates.checkOutDate,
      nights: normalizedDates.nights,
      extractionMetadata: {
        ...existing.extractionMetadata,
        updatedVia: 'manual',
      },
      confidence: 1,
      pricing: {
        currency:
          data.pricing?.currency === undefined
            ? existing.pricing.currency
            : this.normalizeOptionalText(data.pricing.currency),
        total: data.pricing?.total === undefined ? existing.pricing.total : data.pricing.total,
        nightly:
          data.pricing?.nightly === undefined
            ? existing.pricing.nightly
            : data.pricing.nightly,
      },
      archivedAt: existing.archivedAt,
      updatedAt: new Date().toISOString(),
    }
  }

  private buildExtractedHotelStay(
    userId: string,
    email: RawEmail,
    draft: HotelStayDraft,
  ): HotelStay {
    const id = randomUUID()
    const hotelName = this.normalizeRequiredText(draft.hotelName, 'hotelName')
    const normalizedDates = this.normalizeStayDates(
      draft.checkInDate,
      draft.checkOutDate,
      draft.nights ?? null,
    )

    return {
      id,
      userId,
      sourceEmailId: email.id,
      extractionMethod: ['llm'],
      canonicalHash: this.buildHotelCanonicalHash({
        fallbackKey: email.id,
        userId,
        hotelName,
        city: draft.city ?? null,
        checkInDate: normalizedDates.checkInDate,
        checkOutDate: normalizedDates.checkOutDate,
      }),
      hotelName,
      lat: draft.lat ?? null,
      lng: draft.lng ?? null,
      city: this.normalizeOptionalText(draft.city),
      country: this.normalizeOptionalText(draft.country),
      timezone: this.normalizeOptionalText(draft.timezone),
      checkInDate: normalizedDates.checkInDate,
      checkOutDate: normalizedDates.checkOutDate,
      nights: normalizedDates.nights,
      extractionMetadata: {
        extractedFrom: email.id,
        source: 'llm',
      },
      confidence: 0.85,
      pricing: {
        currency: this.normalizeOptionalText(draft.pricingCurrency),
        total: draft.pricingTotal ?? null,
        nightly: draft.pricingNightly ?? null,
      },
      archivedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  private async markManualSourceEmail(stay: HotelStay): Promise<void> {
    if (!stay?.sourceEmailId) {
      return
    }

    const existingProcessing = await this.hotelEmailProcessingRepository.findBySourceEmailId({
      userId: stay.userId,
      sourceEmailId: stay.sourceEmailId,
    })

    await this.hotelEmailProcessingRepository.upsert({
      userId: stay.userId,
      sourceEmailId: stay.sourceEmailId,
      status: existingProcessing?.status ?? 'matched',
      extractionMethod: this.mergeExtractionMethods(
        existingProcessing?.extractionMethod ?? [],
        ['manual'],
      ),
      matchedStays: Math.max(existingProcessing?.matchedStays ?? 0, 1),
      llmAttempts: existingProcessing?.llmAttempts ?? 0,
      lastError: existingProcessing?.lastError ?? null,
      processedAt: new Date(),
    })
  }

  private buildHotelPromptText(email: RawEmail): string {
    return [
      email.snippet ?? '',
      email.bodyText ?? '',
    ].filter(Boolean).join('\n\n')
  }

  private mergeExtractionMethods(
    existing: readonly HotelRecordedExtractionMethod[],
    next: readonly HotelRecordedExtractionMethod[],
  ): HotelRecordedExtractionMethod[] {
    return [...new Set([...existing, ...next])]
  }

  private buildHotelCanonicalHash(input: {
    fallbackKey: string
    userId: string
    hotelName: string
    city: string | null
    checkInDate: string | null
    checkOutDate: string | null
  }): string {
    return createHash('sha256')
      .update([
        input.userId,
        input.hotelName.trim().toLowerCase(),
        input.city?.trim().toLowerCase() ?? '',
        input.checkInDate ?? '',
        input.checkOutDate ?? '',
        input.checkInDate && input.checkOutDate ? '' : input.fallbackKey,
      ].join('|'))
      .digest('hex')
  }

  private normalizeStayDates(
    checkInDate: string | null | undefined,
    checkOutDate: string | null | undefined,
    nights: number | null | undefined,
  ): { checkInDate: string | null, checkOutDate: string | null, nights: number | null } {
    const normalizedCheckInDate = this.normalizeOptionalDateValue(checkInDate, 'checkInDate')
    const normalizedCheckOutDate = this.normalizeOptionalDateValue(checkOutDate, 'checkOutDate')

    if (!normalizedCheckInDate || !normalizedCheckOutDate) {
      if (nights !== null && nights !== undefined && nights < 0) {
        throw new BadRequestException('nights must be non-negative')
      }

      return {
        checkInDate: normalizedCheckInDate,
        checkOutDate: normalizedCheckOutDate,
        nights: nights ?? null,
      }
    }

    const checkIn = parseISO(normalizedCheckInDate)
    const checkOut = parseISO(normalizedCheckOutDate)
    const computedNights = differenceInCalendarDays(checkOut, checkIn)

    if (computedNights < 0) {
      throw new BadRequestException('checkOutDate must be on or after checkInDate')
    }

    const normalizedNights = nights ?? computedNights
    if (normalizedNights < 0) {
      throw new BadRequestException('nights must be non-negative')
    }

    return {
      checkInDate: normalizedCheckInDate,
      checkOutDate: normalizedCheckOutDate,
      nights: normalizedNights,
    }
  }

  private parseDateOrThrow(value: string, field: string): Date {
    const parsed = startOfDay(parseISO(value))
    if (!isValid(parsed)) {
      throw new BadRequestException(`${field} must be a valid ISO date`)
    }

    return parsed
  }

  private normalizeOptionalDateValue(value: string | null | undefined, field: string): string | null {
    if (!value) {
      return null
    }

    const parsed = parseISO(value)
    if (!isValid(parsed)) {
      throw new BadRequestException(`${field} must be a valid date`)
    }

    return format(parsed, 'yyyy-MM-dd')
  }

  private normalizeRequiredText(value: string | null | undefined, field: string): string {
    const normalized = value?.trim()
    if (!normalized) {
      throw new BadRequestException(`${field} is required`)
    }

    return normalized
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim()
    if (!normalized) {
      return null
    }

    return normalized
  }

  private toHotelSyncJob(job: SyncJob): HotelSyncJobStatus {
    return {
      id: job.id,
      userId: job.userId,
      status: job.status,
      query: job.query,
      totalEmails: job.totalEmails,
      processedEmails: job.processedEmails,
      matchedStays: job.newEmails,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
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
}

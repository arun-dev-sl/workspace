import { Inject, Injectable, Logger } from '@nestjs/common'

import { GMAIL_PROVIDER } from '@/shared/application/ports/gmail-provider.port'
import { RAW_EMAIL_REPOSITORY } from '@/shared/application/ports/raw-email.repository.port'
import { SYNC_JOB_REPOSITORY } from '@/shared/application/ports/sync-job.repository.port'

import type { GmailProvider } from '@/shared/application/ports/gmail-provider.port'
import type { RawEmailRepository } from '@/shared/application/ports/raw-email.repository.port'
import type {
  SyncJobRepository,
  SyncJob,
} from '@/shared/application/ports/sync-job.repository.port'
import type { RawEmail } from '@workspace/domain'

export interface StartSyncParams {
  userId: string
  /** Gmail query string */
  query: string
  /** Category tag to store on raw_emails and sync_jobs (e.g. 'expenses', 'flights') */
  category: string
  /** Max emails to fetch from Gmail. Default 1000. */
  maxResults?: number
}

export interface RunSyncOptions {
  markCompleted?: boolean
}

export interface SyncResult {
  jobId: string
}

export interface FetchPreviewEmailsParams {
  userId: string
  query: string
  maxResults: number
  category?: string
}

/**
 * Generic email sync service.
 *
 * Handles: fetch email refs → fetch content in batches → upsert into raw_emails → track progress.
 * Does NOT parse or process emails — domain-specific services handle that.
 */
@Injectable()
export class EmailSyncService {
  private readonly logger = new Logger(EmailSyncService.name)

  constructor(
    @Inject(GMAIL_PROVIDER)
    private readonly gmailProvider: GmailProvider,
    @Inject(RAW_EMAIL_REPOSITORY)
    private readonly rawEmailRepository: RawEmailRepository,
    @Inject(SYNC_JOB_REPOSITORY)
    private readonly syncJobRepository: SyncJobRepository,
  ) {}

  /**
     * Start an async email sync job.
     * Returns immediately with a job ID that can be polled for status.
     */
  async startSync(params: StartSyncParams): Promise<SyncResult> {
    const job = await this.syncJobRepository.create({
      userId: params.userId,
      category: params.category,
      query: params.query,
    })

    // Run the sync in the background
    this.runSyncForExistingJob(job.id, params).catch(async (error) => {
      this.logger.error(`Sync job ${job.id} failed unexpectedly outside try-catch`, error)
      try {
        await this.syncJobRepository.update(job.id, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unexpected error',
          completedAt: new Date(),
        })
      } catch (updateError) {
        this.logger.error(
          `Failed to update job ${job.id} status after unexpected error`,
          updateError,
        )
      }
    })

    return { jobId: job.id }
  }

  async runSyncForExistingJob(
    jobId: string,
    params: StartSyncParams,
    options: RunSyncOptions = {},
  ): Promise<void> {
    const { markCompleted = true } = options

    try {
      await this.syncJobRepository.update(jobId, {
        status: 'processing',
        startedAt: new Date(),
      })

      // Fetch email list
      const emailRefs = await this.gmailProvider.listExpenseEmails({
        userId: params.userId,
        query: params.query,
        maxResults: params.maxResults,
      })

      await this.syncJobRepository.update(jobId, {
        totalEmails: emailRefs.length,
      })

      this.logger.log(
        `Sync job ${jobId} [${params.category}]: Found ${emailRefs.length} emails to process`,
      )

      // Process emails in batches
      const BATCH_SIZE = 100
      for (let i = 0; i < emailRefs.length; i += BATCH_SIZE) {
        const batch = emailRefs.slice(i, i + BATCH_SIZE)
        const batchIds = batch.map((ref) => ref.id)

        this.logger.debug(
          `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchIds.length} emails`,
        )

        try {
          const rawEmails = await this.gmailProvider.fetchEmailContentBatch({
            userId: params.userId,
            emailIds: batchIds,
            category: params.category,
          })

          for (const rawEmail of rawEmails) {
            try {
              const { isNew } = await this.rawEmailRepository.upsert(rawEmail)

              await this.syncJobRepository.incrementProgress(
                jobId,
                'processedEmails',
              )

              if (isNew) {
                await this.syncJobRepository.incrementProgress(jobId, 'newEmails')
              }
            } catch (emailError) {
              this.logger.warn(
                `Failed to process email ${rawEmail.providerMessageId} in job ${jobId}`,
                emailError,
              )
            }
          }
        } catch (batchError) {
          this.logger.error(
            `Failed to fetch batch starting at index ${i} in job ${jobId}`,
            batchError,
          )
        }
      }

      if (markCompleted) {
        await this.syncJobRepository.update(jobId, {
          status: 'completed',
          completedAt: new Date(),
        })
      }

      this.logger.log(`Sync job ${jobId} [${params.category}] completed`)
    } catch (error) {
      this.logger.error(`Sync job ${jobId} failed`, error)

      try {
        await this.syncJobRepository.update(jobId, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown sync error',
          completedAt: new Date(),
        })
      } catch (updateError) {
        this.logger.error(`Failed to update sync job ${jobId} after error`, updateError)
      }

      throw error
    }
  }

  /**
     * Build the default incremental query for a category.
     * Uses the last completed sync time for that category to do incremental fetching.
     */
  async buildIncrementalQuery(
    userId: string,
    category: string,
    baseQueryTerms: string,
  ): Promise<string> {
    const lastSync = await this.syncJobRepository.findLastCompletedByUserId(userId, category)

    if (lastSync?.completedAt) {
      const afterDate = this.formatGmailAfterTimestamp(lastSync.completedAt)
      return `${baseQueryTerms} after:${afterDate}`
    }

    // First sync — fetch last 180 days
    return `${baseQueryTerms} newer_than:180d`
  }

  /**
     * Get the status of a sync job.
     */
  async getSyncJobStatus(jobId: string): Promise<SyncJob | null> {
    return this.syncJobRepository.findById(jobId)
  }

  /**
     * Get recent sync jobs for a user, optionally filtered by category.
     */
  async getUserSyncJobs(userId: string, limit = 10, category?: string): Promise<SyncJob[]> {
    return this.syncJobRepository.findByUserId(userId, limit, category)
  }

  /**
     * Fetch emails from Gmail for preview/playground use cases.
     * This does NOT persist emails and does NOT create sync jobs.
     */
  async fetchPreviewEmails(params: FetchPreviewEmailsParams): Promise<RawEmail[]> {
    const emailRefs = await this.gmailProvider.listExpenseEmails({
      userId: params.userId,
      query: params.query,
      maxResults: params.maxResults,
    })

    if (emailRefs.length === 0) {
      return []
    }

    return this.gmailProvider.fetchEmailContentBatch({
      userId: params.userId,
      emailIds: emailRefs.map((ref) => ref.id),
      category: params.category,
    })
  }

  /**
     * Format date for Gmail query (YYYY/MM/DD)
     */
  private formatGmailAfterTimestamp(date: Date, offsetByDays = 0): number {
    const adjusted = new Date(date)
    adjusted.setDate(adjusted.getDate() - offsetByDays)

    return Math.floor(adjusted.getTime() / 1000) // Gmail expects seconds
  }
}

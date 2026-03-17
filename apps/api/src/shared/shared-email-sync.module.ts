import { Module } from '@nestjs/common'

import { AuthModule } from '@/modules/auth/auth.module'
import { GoogleApisGmailProvider } from '@/modules/expenses/infrastructure/providers/googleapis-gmail.provider'
import { RawEmailRepositoryImpl } from '@/modules/expenses/infrastructure/repositories/raw-email.repository'
import { SyncJobRepositoryImpl } from '@/modules/expenses/infrastructure/repositories/sync-job.repository'
import { GMAIL_PROVIDER } from '@/shared/application/ports/gmail-provider.port'
import { RAW_EMAIL_REPOSITORY } from '@/shared/application/ports/raw-email.repository.port'
import { SYNC_JOB_REPOSITORY } from '@/shared/application/ports/sync-job.repository.port'
import { EmailSyncService } from '@/shared/application/services/email-sync.service'

/**
 * Shared Email Sync Module
 *
 * Provides a generic, reusable email sync service that:
 * - Fetches emails from Gmail using a configurable query
 * - Stores them in raw_emails tagged with a category
 * - Tracks progress via sync_jobs
 *
 * Domain modules (expenses, flights, etc.) import this module
 * and call EmailSyncService with their own category and query.
 */
@Module({
  imports: [AuthModule],
  providers: [
    EmailSyncService,
    {
      provide: GMAIL_PROVIDER,
      useClass: GoogleApisGmailProvider,
    },
    {
      provide: RAW_EMAIL_REPOSITORY,
      useClass: RawEmailRepositoryImpl,
    },
    {
      provide: SYNC_JOB_REPOSITORY,
      useClass: SyncJobRepositoryImpl,
    },
  ],
  exports: [
    EmailSyncService,
    GMAIL_PROVIDER,
    RAW_EMAIL_REPOSITORY,
    SYNC_JOB_REPOSITORY,
  ],
})
export class SharedEmailSyncModule {}

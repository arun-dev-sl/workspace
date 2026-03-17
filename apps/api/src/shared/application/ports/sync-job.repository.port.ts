import type { SyncJobStatus } from '@workspace/database'

export interface SyncJob {
  id: string
  userId: string
  status: SyncJobStatus
  category: string
  query: string | null
  totalEmails: number | null
  processedEmails: number
  newEmails: number
  transactions: number
  statements: number
  errorMessage: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateSyncJobParams {
  userId: string
  category?: string
  query?: string
}

export interface UpdateSyncJobParams {
  status?: SyncJobStatus
  totalEmails?: number
  processedEmails?: number
  newEmails?: number
  transactions?: number
  statements?: number
  errorMessage?: string
  startedAt?: Date
  completedAt?: Date
}

export interface SyncJobRepository {
  create(params: CreateSyncJobParams): Promise<SyncJob>
  findById(id: string): Promise<SyncJob | null>
  findByUserId(userId: string, limit?: number, category?: string): Promise<SyncJob[]>
  findLastCompletedByUserId(userId: string, category?: string): Promise<SyncJob | null>
  update(id: string, params: UpdateSyncJobParams): Promise<SyncJob | null>
  incrementProgress(
    id: string,
    field: 'processedEmails' | 'newEmails' | 'transactions' | 'statements',
    amount?: number,
  ): Promise<void>
}

export const SYNC_JOB_REPOSITORY = Symbol('SYNC_JOB_REPOSITORY')

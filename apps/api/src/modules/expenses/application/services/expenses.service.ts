import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common'
import { addDays, format, isValid, parseISO, startOfDay } from 'date-fns'

import {
  EMAIL_PARSERS,

} from '@/modules/expenses/application/ports/email-parser.port'
import {
  MERCHANT_RULE_REPOSITORY,

} from '@/modules/expenses/application/ports/merchant-rule.repository.port'
import {
  STATEMENT_REPOSITORY,

} from '@/modules/expenses/application/ports/statement.repository.port'
import {
  TRANSACTION_REPOSITORY,

} from '@/modules/expenses/application/ports/transaction.repository.port'
import { CardResolver } from '@/modules/expenses/infrastructure/categorization/card-resolver'
import {
  TransactionCategorizer,

} from '@/modules/expenses/infrastructure/categorization/transaction-categorizer'
import { RAW_EMAIL_REPOSITORY  } from '@/shared/application/ports/raw-email.repository.port'
import { SYNC_JOB_REPOSITORY  } from '@/shared/application/ports/sync-job.repository.port'
import { EmailSyncService } from '@/shared/application/services/email-sync.service'

import type { EmailParser } from '@/modules/expenses/application/ports/email-parser.port'
import type { MerchantCategoryRuleRepository } from '@/modules/expenses/application/ports/merchant-rule.repository.port'
import type { StatementRepository } from '@/modules/expenses/application/ports/statement.repository.port'
import type { TransactionRepository, TransactionFilters, DateRange } from '@/modules/expenses/application/ports/transaction.repository.port'
import type { UserCategorizationRules } from '@/modules/expenses/infrastructure/categorization/transaction-categorizer'
import type {RawEmailRepository} from '@/shared/application/ports/raw-email.repository.port';
import type {SyncJobRepository} from '@/shared/application/ports/sync-job.repository.port';
import type {
  RawEmail,
  Transaction,
  UpdateTransactionInput,
  AnalyticsPeriod,
  SpendingSummary,
  SpendingByCategoryItem,
  SpendingByModeItem,
  SpendingByMerchantItem,
  DailySpendingItem,
  MonthlyTrendItem,
  SpendingByCardItem,
  MilestoneProgress,
  DayOfWeekSpendingItem,
  CategoryTrendItem,
  PeriodComparison,
  CumulativeSpendItem,
  SavingsRateItem,
  CardCategoryItem,
  TopVpaItem,
  SpendingVelocityItem,
  MilestoneEta,
  LargestTransactionItem,
  SyncJob,
} from '@workspace/domain'

const EXPENSE_CATEGORY = 'expenses'

const EXPENSE_QUERY_TERMS = 'subject:(statement OR receipt OR purchase OR transaction OR payment OR invoice OR card OR bank OR upi)'

@Injectable()
export class ExpensesService {
  private static readonly ANALYTICS_CACHE_TTL_MS = 60_000
  private static readonly EMAIL_PROCESS_BATCH_SIZE = 20

  private readonly logger = new Logger(ExpensesService.name)
  private readonly transactionCategorizer = TransactionCategorizer.getInstance()
  private readonly cardResolver = CardResolver.getInstance()

  constructor(
    @Inject(EMAIL_PARSERS)
    private readonly parsers: EmailParser[],
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepository,
    @Inject(STATEMENT_REPOSITORY)
    private readonly statementRepository: StatementRepository,
    @Inject(RAW_EMAIL_REPOSITORY)
    private readonly rawEmailRepository: RawEmailRepository,
    @Inject(SYNC_JOB_REPOSITORY)
    private readonly syncJobRepository: SyncJobRepository,
    @Inject(MERCHANT_RULE_REPOSITORY)
    private readonly merchantRuleRepository: MerchantCategoryRuleRepository,
    private readonly emailSyncService: EmailSyncService,
  ) {}

  private readonly analyticsCache = new Map<string, { expiresAt: number, value: unknown }>()

  private async getCachedOrCompute<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const entry = this.analyticsCache.get(key)
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value as T
    }

    const value = await compute()
    this.analyticsCache.set(key, {
      expiresAt: Date.now() + ExpensesService.ANALYTICS_CACHE_TTL_MS,
      value,
    })
    return value
  }

  private cacheKey(userId: string, method: string, params: Record<string, unknown>): string {
    return `expenses:${userId}:${method}:${JSON.stringify(params)}`
  }

  private invalidateUserAnalyticsCache(userId: string): void {
    const prefix = `expenses:${userId}:`
    for (const key of this.analyticsCache.keys()) {
      if (key.startsWith(prefix)) {
        this.analyticsCache.delete(key)
      }
    }
  }

  /**
     * Start an async sync job
     * Returns immediately with a job ID that can be polled for status
     */
  async startSyncJob(params: { userId: string, query?: string, fromDate?: string }): Promise<{ jobId: string }> {
    const query = params.query
      ?? (params.fromDate
        ? this.buildSyncQueryFromDate(params.fromDate)
        : await this.emailSyncService.buildIncrementalQuery(
            params.userId,
            EXPENSE_CATEGORY,
            EXPENSE_QUERY_TERMS,
          ))

    const job = await this.syncJobRepository.create({
      userId: params.userId,
      category: EXPENSE_CATEGORY,
      query,
    })

    this.runSyncJobPipeline(job.id, params.userId, query).catch(async (error) => {
      this.logger.error(`Expense sync pipeline for job ${job.id} failed`, error)
      try {
        await this.syncJobRepository.update(job.id, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unexpected error',
          completedAt: new Date(),
        })
      } catch (updateError) {
        this.logger.error(`Failed to update expense sync job ${job.id} status`, updateError)
      }
    })

    return { jobId: job.id }
  }

  private async runSyncJobPipeline(jobId: string, userId: string, query: string): Promise<void> {
    await this.emailSyncService.runSyncForExistingJob(
      jobId,
      {
        userId,
        query,
        category: EXPENSE_CATEGORY,
      },
      {
        markCompleted: false,
      },
    )

    await this.runPostSyncProcessing(jobId, userId)

    await this.syncJobRepository.update(jobId, {
      status: 'completed',
      completedAt: new Date(),
    })
  }

  private buildSyncQueryFromDate(fromDate: string): string {
    const parsedDate = parseISO(fromDate)

    if (!isValid(parsedDate)) {
      throw new BadRequestException('Invalid fromDate. Expected format: YYYY-MM-DD.')
    }

    return `${EXPENSE_QUERY_TERMS} after:${format(parsedDate, 'yyyy/MM/dd')}`
  }

  /**
     * Get the status of a sync job
     */
  async getSyncJobStatus(jobId: string): Promise<SyncJob | null> {
    const job = await this.emailSyncService.getSyncJobStatus(jobId)
    if (job?.category !== EXPENSE_CATEGORY) {
      return null
    }

    return this.toSyncJob(job)
  }

  /**
     * Get recent sync jobs for a user
     */
  async getUserSyncJobs(userId: string, limit = 10): Promise<SyncJob[]> {
    const jobs = await this.emailSyncService.getUserSyncJobs(
      userId,
      limit,
      EXPENSE_CATEGORY,
    )

    return jobs.map((job) => this.toSyncJob(job))
  }

  /**
     * Start a reprocess job — re-parse & re-categorize stored emails
     * without fetching from Gmail. Returns a job ID for polling.
     *
     * @param forceProcessAll - If true, reprocess ALL emails. If false (default), only process unprocessed emails.
     */
  async startReprocessJob(params: { userId: string, forceProcessAll?: boolean }): Promise<{ jobId: string }> {
    const job = await this.syncJobRepository.create({
      userId: params.userId,
      category: EXPENSE_CATEGORY,
      query: '__reprocess__',
    })

    this.runReprocessJob(job.id, params.userId, params.forceProcessAll ?? false).catch(async (error) => {
      this.logger.error(
        `Reprocess job ${job.id} failed unexpectedly outside try-catch`,
        error,
      )
      try {
        await this.syncJobRepository.update(job.id, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unexpected error',
          completedAt: new Date(),
        })
      } catch (updateError) {
        this.logger.error(`Failed to update reprocess job ${job.id} status`, updateError)
      }
    })

    return { jobId: job.id }
  }

  /**
     * Internal: re-parse stored raw_emails for a user and upsert transactions.
     * Skips Gmail entirely — works purely from stored email data.
     *
     * @param forceProcessAll - If true, process all emails. If false, only process unprocessed emails.
     */
  private async runReprocessJob(jobId: string, userId: string, forceProcessAll: boolean): Promise<void> {
    try {
      await this.syncJobRepository.update(jobId, {
        status: 'processing',
        startedAt: new Date(),
      })

      let totalTransactions = 0
      let totalStatements = 0
      const emailsToProcess = forceProcessAll
        ? await this.rawEmailRepository.listAllByUser(userId, EXPENSE_CATEGORY)
        : await this.rawEmailRepository.listUnprocessedByUser(userId, EXPENSE_CATEGORY)
      const totalEmails = emailsToProcess.length

      const userRules = await this.buildUserCategorizationRules(userId)

      await this.syncJobRepository.update(jobId, {
        totalEmails,
      })

      for (
        let index = 0;
        index < emailsToProcess.length;
        index += ExpensesService.EMAIL_PROCESS_BATCH_SIZE
      ) {
        const emails = emailsToProcess.slice(index, index + ExpensesService.EMAIL_PROCESS_BATCH_SIZE)

        const batchResults = await Promise.all(
          emails.map((email) => this.processEmailForReprocess(jobId, email, userRules)),
        )

        const batchTransactions = batchResults.reduce(
          (sum, result) => sum + result.transactions,
          0,
        )
        const batchStatements = batchResults.reduce(
          (sum, result) => sum + result.statements,
          0,
        )

        totalTransactions += batchTransactions
        totalStatements += batchStatements

        await this.syncJobRepository.incrementProgress(jobId, 'processedEmails', emails.length)
        if (batchTransactions > 0) {
          await this.syncJobRepository.incrementProgress(jobId, 'transactions', batchTransactions)
        }
        if (batchStatements > 0) {
          await this.syncJobRepository.incrementProgress(jobId, 'statements', batchStatements)
        }
      }

      this.invalidateUserAnalyticsCache(userId)

      await this.syncJobRepository.update(jobId, {
        status: 'completed',
        completedAt: new Date(),
      })

      this.logger.log(
        `Reprocess job ${jobId} completed: ${totalTransactions} transactions, ${totalStatements} statements from ${totalEmails} emails`,
      )
    } catch (error) {
      this.logger.error(`Reprocess job ${jobId} failed`, error)
      try {
        await this.syncJobRepository.update(jobId, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        })
      } catch (updateError) {
        this.logger.error(
          `Critical: Failed to update reprocess job ${jobId} status`,
          updateError,
        )
        throw error
      }
    }
  }

  /**
     * Internal method to run the post-sync processing
     */
  private async runPostSyncProcessing(
    jobId: string,
    userId: string,
  ): Promise<void> {
    const emailsToProcess = await this.rawEmailRepository.listUnprocessedByUser(
      userId,
      EXPENSE_CATEGORY,
    )

    if (emailsToProcess.length === 0) {
      this.logger.log(`Post-sync processing for job ${jobId}: no unprocessed emails found`)
      return
    }

    // Post-sync parsing runs after Gmail fetch completion and should not mutate fetch progress.
    let totalTransactions = 0
    let totalStatements = 0
    let processedEmails = 0

    this.logger.log(
      `Post-sync processing for job ${jobId}: processing ${emailsToProcess.length} unprocessed emails in batches`,
    )

    const userRules = await this.buildUserCategorizationRules(userId)

    for (
      let index = 0;
      index < emailsToProcess.length;
      index += ExpensesService.EMAIL_PROCESS_BATCH_SIZE
    ) {
      const chunk = emailsToProcess.slice(index, index + ExpensesService.EMAIL_PROCESS_BATCH_SIZE)

      const chunkResults = await Promise.all(
        chunk.map((email) => this.processEmailForReprocess(jobId, email, userRules)),
      )

      const chunkTransactions = chunkResults.reduce(
        (sum, result) => sum + result.transactions,
        0,
      )
      const chunkStatements = chunkResults.reduce(
        (sum, result) => sum + result.statements,
        0,
      )

      totalTransactions += chunkTransactions
      totalStatements += chunkStatements
      processedEmails += chunk.length
    }

    this.invalidateUserAnalyticsCache(userId)
    this.logger.log(`Post-sync processing for job ${jobId} completed: ${totalTransactions} transactions, ${totalStatements} statements processed from ${processedEmails} synced emails`)
  }

  private async processEmailForReprocess(
    jobId: string,
    email: RawEmail,
    userRules?: UserCategorizationRules,
  ): Promise<{ transactions: number, statements: number }> {
    try {
      const parser = this.findParser(email)
      if (!parser) {
        this.logger.debug(
          `Reprocess job ${jobId}: no parser found for email ${email.id} (from=${email.from}, subject=${email.subject.slice(0, 60)})`,
        )
        return { transactions: 0, statements: 0 }
      }

      const parsedTransactions = parser.parseTransactions(email)

      if (parsedTransactions.length === 0) {
        this.logger.debug(
          `Reprocess job ${jobId}: parser returned 0 txns for email ${email.id} (subject=${email.subject.slice(0, 60)}, bodyLen=${email.bodyText.length}, htmlLen=${email.bodyHtml?.length ?? 0}, snippet=${email.snippet.slice(0, 60)})`,
        )
      }

      const transactions = this.categorizeTransactions(parsedTransactions, userRules)

      if (transactions.length > 0) {
        await this.transactionRepository.upsertMany(transactions)
      }

      const statement = parser.parseStatement(email)
      if (statement) {
        await this.statementRepository.upsert(statement)
      }

      return {
        transactions: transactions.length,
        statements: statement ? 1 : 0,
      }
    } catch (emailError) {
      const errMsg
        = emailError instanceof Error
          ? `${emailError.message}\n${emailError.stack}`
          : String(emailError)
      this.logger.warn(
        `Reprocess job ${jobId}: failed to process email ${email.id} (subject=${email.subject.slice(0, 60)}, bodyLen=${email.bodyText.length}, htmlLen=${email.bodyHtml?.length ?? 0}): ${errMsg}`,
      )
      return { transactions: 0, statements: 0 }
    }
  }

  private toSyncJob(job: SyncJobRepository['findById'] extends (id: string) => Promise<infer TResult> ? NonNullable<TResult> : never): SyncJob {
    return {
      id: job.id,
      userId: job.userId,
      status: job.status,
      query: job.query,
      totalEmails: job.totalEmails,
      processedEmails: job.processedEmails,
      newEmails: job.newEmails,
      transactions: job.transactions,
      statements: job.statements,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    }
  }

  async listExpenseEmails(params: {
    userId: string
    limit: number
    offset: number
  }): Promise<{ data: RawEmail[], total: number }> {
    const [data, total] = await Promise.all([
      this.rawEmailRepository.listByUser({ ...params, category: EXPENSE_CATEGORY }),
      this.rawEmailRepository.countByUser(params.userId, EXPENSE_CATEGORY),
    ])
    return { data, total }
  }

  async listExpenses(params: {
    userId: string
    limit: number
    offset: number
    filters?: TransactionFilters
  }): Promise<{ data: Transaction[], total: number }> {
    const [data, total] = await Promise.all([
      this.transactionRepository.listByUser(params),
      this.transactionRepository.countByUser(params.userId, params.filters),
    ])
    return { data, total }
  }

  async listExpensesCursor(params: {
    userId: string
    pageSize: number
    cursor?: string
    filters?: TransactionFilters
  }): Promise<{ data: Transaction[], nextCursor?: string, hasMore: boolean }> {
    return this.transactionRepository.listByUserCursor(params)
  }

  async getTransactionById(params: { userId: string, id: string }): Promise<Transaction | null> {
    return this.transactionRepository.findById(params)
  }

  async findTransactionsByIds(userId: string, ids: string[]): Promise<Transaction[]> {
    return this.transactionRepository.findByIds({ userId, ids })
  }

  async updateTransaction(params: {
    userId: string
    id: string
    data: UpdateTransactionInput
  }): Promise<Transaction> {
    const updated = await this.transactionRepository.updateById(params)
    this.invalidateUserAnalyticsCache(params.userId)
    return updated
  }

  /**
     * Get distinct merchants with their most common category, for the user.
     */
  async getDistinctMerchants(userId: string) {
    return this.transactionRepository.getDistinctMerchants(userId)
  }

  /**
     * Bulk update category and subcategory for all transactions of a given merchant.
     */
  async bulkCategorizeByMerchant(params: {
    userId: string
    merchant: string
    category: string
    subcategory: string
    categoryMetadata?: { icon: string, color: string, parent: string | null }
  }): Promise<{ merchant: string, category: string, subcategory: string, updatedCount: number }> {
    const updatedCount = await this.transactionRepository.bulkCategorizeByMerchant(params)

    // Persist the merchant → category mapping for future syncs
    await this.merchantRuleRepository.upsert({
      userId: params.userId,
      merchant: params.merchant,
      category: params.category,
      subcategory: params.subcategory,
      categoryMetadata: params.categoryMetadata,
    })

    this.invalidateUserAnalyticsCache(params.userId)

    return {
      merchant: params.merchant,
      category: params.category,
      subcategory: params.subcategory,
      updatedCount,
    }
  }

  /**
     * Bulk update fields on multiple transactions by ID.
     */
  async bulkUpdateByIds(params: {
    userId: string
    ids: string[]
    data: {
      category?: string
      subcategory?: string
      transactionMode?: string
      requiresReview?: boolean
    }
  }): Promise<{ updatedCount: number }> {
    const updatedCount = await this.transactionRepository.bulkUpdateByIds(params)
    this.invalidateUserAnalyticsCache(params.userId)
    return { updatedCount }
  }

  async getExpenseEmailById(params: { userId: string, id: string }): Promise<RawEmail | null> {
    return this.rawEmailRepository.findById(params)
  }

  // ── Analytics ──

  private computeDateRange(period: AnalyticsPeriod): DateRange {
    const end = new Date()
    const start = new Date()
    switch (period) {
      case 'week': {
        start.setDate(start.getDate() - 7)
        break
      }
      case 'month': {
        start.setMonth(start.getMonth() - 1)
        break
      }
      case 'quarter': {
        start.setMonth(start.getMonth() - 3)
        break
      }
      case 'year': {
        start.setFullYear(start.getFullYear() - 1)
        break
      }
    }
    start.setHours(0, 0, 0, 0)
    return { start, end }
  }

  async getSpendingSummary(userId: string, period: AnalyticsPeriod): Promise<SpendingSummary> {
    const range = this.computeDateRange(period)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getSpendingSummary', { period }),
      () => this.transactionRepository.getSpendingSummary({ userId, range }),
    )
  }

  async getSpendingByCategory(
    userId: string,
    period: AnalyticsPeriod,
  ): Promise<SpendingByCategoryItem[]> {
    const range = this.computeDateRange(period)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getSpendingByCategory', { period }),
      () => this.transactionRepository.getSpendingByCategory({ userId, range }),
    )
  }

  async getSpendingByCategoryForDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<SpendingByCategoryItem[]> {
    const range = this.computeExplicitDateRange(startDate, endDate)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getSpendingByCategoryForDateRange', { startDate, endDate }),
      () => this.transactionRepository.getSpendingByCategory({ userId, range }),
    )
  }

  async getSpendingByMode(
    userId: string,
    period: AnalyticsPeriod,
  ): Promise<SpendingByModeItem[]> {
    const range = this.computeDateRange(period)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getSpendingByMode', { period }),
      () => this.transactionRepository.getSpendingByMode({ userId, range }),
    )
  }

  async getTopMerchants(
    userId: string,
    period: AnalyticsPeriod,
    limit = 10,
  ): Promise<SpendingByMerchantItem[]> {
    const range = this.computeDateRange(period)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getTopMerchants', { period, limit }),
      () => this.transactionRepository.getTopMerchants({ userId, range, limit }),
    )
  }

  async getTopMerchantsForDateRange(
    userId: string,
    startDate: string,
    endDate: string,
    limit = 10,
  ): Promise<SpendingByMerchantItem[]> {
    const range = this.computeExplicitDateRange(startDate, endDate)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getTopMerchantsForDateRange', { startDate, endDate, limit }),
      () => this.transactionRepository.getTopMerchants({ userId, range, limit }),
    )
  }

  async getDailySpending(userId: string, period: AnalyticsPeriod): Promise<DailySpendingItem[]> {
    const range = this.computeDateRange(period)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getDailySpending', { period }),
      () => this.transactionRepository.getDailySpending({ userId, range }),
    )
  }

  async getDailySpendingForDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailySpendingItem[]> {
    const range = this.computeExplicitDateRange(startDate, endDate)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getDailySpendingForDateRange', { startDate, endDate }),
      () => this.transactionRepository.getDailySpending({ userId, range }),
    )
  }

  async getMonthlyTrend(userId: string, months = 12): Promise<MonthlyTrendItem[]> {
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getMonthlyTrend', { months }),
      () => this.transactionRepository.getMonthlyTrend({ userId, months }),
    )
  }

  async getSpendingByCard(
    userId: string,
    period: AnalyticsPeriod,
  ): Promise<SpendingByCardItem[]> {
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getSpendingByCard', { period }),
      async () => {
        const range = this.computeDateRange(period)
        const rows = await this.transactionRepository.getSpendingByCard({ userId, range })

        const milestonesByCard = new Map<
          string,
          NonNullable<ReturnType<CardResolver['resolve']>>['milestones']
        >()

        for (const row of rows) {
          const resolved = this.cardResolver.resolve(row.cardLast4)
          if (resolved?.milestones) {
            milestonesByCard.set(row.cardLast4, resolved.milestones)
          }
        }

        const spendIndex = await this.buildMilestoneSpendIndex(userId, milestonesByCard)

        return rows.map((row) => {
          const resolved = this.cardResolver.resolve(row.cardLast4)
          const milestones = resolved?.milestones
            ? this.computeMilestoneProgress(row.cardLast4, resolved.milestones, spendIndex)
            : []

          return {
            ...row,
            cardName: resolved?.cardName ?? row.cardName,
            bank: resolved?.bank ?? row.bank,
            icon: resolved?.icon ?? row.icon,
            milestones: milestones.length > 0 ? milestones : undefined,
          }
        })
      },
    )
  }

  // ── Extended Analytics ──

  private pctChange = (curr: number, prev: number) =>
    prev > 0 ? Math.round(((curr - prev) / prev) * 10_000) / 100 : (curr > 0 ? 100 : 0)

  async getDayOfWeekSpending(
    userId: string,
    period: AnalyticsPeriod,
  ): Promise<DayOfWeekSpendingItem[]> {
    const range = this.computeDateRange(period)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getDayOfWeekSpending', { period }),
      () => this.transactionRepository.getDayOfWeekSpending({ userId, range }),
    )
  }

  async getCategoryTrend(userId: string, months = 6): Promise<CategoryTrendItem[]> {
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getCategoryTrend', { months }),
      () => this.transactionRepository.getCategoryTrend({ userId, months }),
    )
  }

  async getPeriodComparison(userId: string, period: AnalyticsPeriod): Promise<PeriodComparison> {
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getPeriodComparison', { period }),
      async () => {
        const currentRange = this.computeDateRange(period)

        const durationMs = currentRange.end.getTime() - currentRange.start.getTime()
        const previousRange = {
          start: new Date(currentRange.start.getTime() - durationMs),
          end: new Date(currentRange.start),
        }

        const [current, previous] = await Promise.all([
          this.transactionRepository.getPeriodTotals({ userId, range: currentRange }),
          this.transactionRepository.getPeriodTotals({ userId, range: previousRange }),
        ])

        const currentAvg
          = current.transactionCount > 0 ? current.totalSpent / current.transactionCount : 0
        const previousAvg
          = previous.transactionCount > 0 ? previous.totalSpent / previous.transactionCount : 0

        return {
          currentPeriod: {
            totalSpent: current.totalSpent,
            totalReceived: current.totalReceived,
            transactionCount: current.transactionCount,
            avgTransaction: currentAvg,
          },
          previousPeriod: {
            totalSpent: previous.totalSpent,
            totalReceived: previous.totalReceived,
            transactionCount: previous.transactionCount,
            avgTransaction: previousAvg,
          },
          changes: {
            spentChange: this.pctChange(current.totalSpent, previous.totalSpent),
            receivedChange: this.pctChange(current.totalReceived, previous.totalReceived),
            countChange: this.pctChange(current.transactionCount, previous.transactionCount),
            avgChange: this.pctChange(currentAvg, previousAvg),
          },
        }
      },
    )
  }

  async getCumulativeSpend(
    userId: string,
    period: AnalyticsPeriod,
  ): Promise<CumulativeSpendItem[]> {
    const range = this.computeDateRange(period)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getCumulativeSpend', { period }),
      () => this.transactionRepository.getCumulativeSpend({ userId, range }),
    )
  }

  async getSavingsRate(userId: string, months = 12): Promise<SavingsRateItem[]> {
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getSavingsRate', { months }),
      () => this.transactionRepository.getSavingsRate({ userId, months }),
    )
  }

  async getCardCategoryBreakdown(
    userId: string,
    period: AnalyticsPeriod,
  ): Promise<CardCategoryItem[]> {
    const range = this.computeDateRange(period)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getCardCategoryBreakdown', { period }),
      () => this.transactionRepository.getCardCategoryBreakdown({ userId, range }),
    )
  }

  async getTopVpas(userId: string, period: AnalyticsPeriod, limit = 10): Promise<TopVpaItem[]> {
    const range = this.computeDateRange(period)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getTopVpas', { period, limit }),
      () => this.transactionRepository.getTopVpas({ userId, range, limit }),
    )
  }

  async getSpendingVelocity(
    userId: string,
    period: AnalyticsPeriod,
  ): Promise<SpendingVelocityItem[]> {
    const range = this.computeDateRange(period)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getSpendingVelocity', { period }),
      () => this.transactionRepository.getSpendingVelocity({ userId, range }),
    )
  }

  async getMilestoneEtas(userId: string): Promise<MilestoneEta[]> {
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getMilestoneEtas', {}),
      async () => {
        const allCards = this.cardResolver.getAllCards()
        const results: MilestoneEta[] = []
        const milestonesByCard = new Map<
          string,
          NonNullable<ReturnType<CardResolver['resolve']>>['milestones']
        >()

        for (const [cardLast4, card] of allCards.entries()) {
          if (card.milestones && Object.keys(card.milestones).length > 0) {
            milestonesByCard.set(cardLast4, card.milestones)
          }
        }

        const spendIndex = await this.buildMilestoneSpendIndex(userId, milestonesByCard)

        for (const [cardLast4, card] of allCards.entries()) {
          if (!card.milestones || Object.keys(card.milestones).length === 0) continue

          for (const [id, milestone] of Object.entries(card.milestones)) {
            const duration = milestone.durations[0] ?? 'yearly'
            const { start, end } = this.computeMilestoneDateRange(
              duration,
              milestone.milestone_start_date,
              milestone.milestone_end_date,
            )

            const currentSpend = this.sumCardSpendInRange(
              spendIndex.get(cardLast4) ?? [],
              start,
              end,
            )
            const percentage = Math.min(100, (currentSpend / milestone.amount) * 100)
            const remaining = Math.max(0, milestone.amount - currentSpend)

            const elapsedMs = Date.now() - start.getTime()
            const elapsedDays = Math.max(1, elapsedMs / (1000 * 60 * 60 * 24))
            const dailyRate = currentSpend / elapsedDays

            let daysRemaining: number | null = null
            let estimatedCompletionDate: string | null = null
            const periodEndStr = end.toISOString().split('T')[0]!

            if (dailyRate > 0 && remaining > 0) {
              daysRemaining = Math.ceil(remaining / dailyRate)
              const eta = new Date()
              eta.setDate(eta.getDate() + daysRemaining)
              estimatedCompletionDate = eta.toISOString().split('T')[0]!
            } else if (remaining <= 0) {
              daysRemaining = 0
            }

            const onTrack
              = remaining <= 0
                || (estimatedCompletionDate != null && estimatedCompletionDate <= periodEndStr)

            results.push({
              id,
              cardLast4,
              cardName: card.cardName,
              description: milestone.description,
              targetAmount: milestone.amount,
              currentSpend,
              percentage: Math.round(percentage * 100) / 100,
              dailyRate: Math.round(dailyRate * 100) / 100,
              daysRemaining,
              estimatedCompletionDate,
              periodEnd: periodEndStr,
              onTrack,
            })
          }
        }

        return results
      },
    )
  }

  async getLargestTransactions(
    userId: string,
    period: AnalyticsPeriod,
    limit = 10,
  ): Promise<LargestTransactionItem[]> {
    const range = this.computeDateRange(period)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getLargestTransactions', { period, limit }),
      () => this.transactionRepository.getLargestTransactions({ userId, range, limit }),
    )
  }

  async getLargestTransactionsForDateRange(
    userId: string,
    startDate: string,
    endDate: string,
    limit = 10,
  ): Promise<LargestTransactionItem[]> {
    const range = this.computeExplicitDateRange(startDate, endDate)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getLargestTransactionsForDateRange', { startDate, endDate, limit }),
      () => this.transactionRepository.getLargestTransactions({ userId, range, limit }),
    )
  }

  async getSpendingSummaryForDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<SpendingSummary> {
    const range = this.computeExplicitDateRange(startDate, endDate)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getSpendingSummaryForDateRange', { startDate, endDate }),
      () => this.transactionRepository.getSpendingSummary({ userId, range }),
    )
  }

  // ── Pattern Analytics ──

  async getBusAnalytics(userId: string, period: AnalyticsPeriod) {
    const range = this.computeDateRange(period)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getBusAnalytics', { period }),
      () => this.transactionRepository.getBusAnalytics({ userId, range }),
    )
  }

  async getInvestmentAnalytics(userId: string, period: AnalyticsPeriod) {
    const range = this.computeDateRange(period)
    return this.getCachedOrCompute(
      this.cacheKey(userId, 'getInvestmentAnalytics', { period }),
      () => this.transactionRepository.getInvestmentAnalytics({ userId, range }),
    )
  }

  private computeExplicitDateRange(startDate: string, endDate: string): DateRange {
    const parsedStart = parseISO(startDate)
    const parsedEnd = parseISO(endDate)

    if (!isValid(parsedStart) || !isValid(parsedEnd)) {
      throw new BadRequestException('Invalid date range. Expected YYYY-MM-DD for startDate and endDate.')
    }

    const start = startOfDay(parsedStart)
    const end = startOfDay(addDays(parsedEnd, 1))

    if (start >= end) {
      throw new BadRequestException('endDate must be on or after startDate.')
    }

    return { start, end }
  }

  /**
     * Compute milestone progress for a specific card.
     * For each milestone, determines the date range based on duration type
     * (quarterly = current calendar quarter, yearly = custom dates or calendar year),
     * queries actual spend in that range, and calculates progress.
     */
  private computeMilestoneProgress(
    cardLast4: string,
    milestones: NonNullable<ReturnType<CardResolver['resolve']>>['milestones'],
    spendIndex: Map<string, { transactionDate: Date, amount: number }[]>,
  ): MilestoneProgress[] {
    const entries = Object.entries(milestones)
    if (entries.length === 0) return []

    const results: MilestoneProgress[] = []

    for (const [id, milestone] of entries) {
      const duration = milestone.durations[0] ?? 'yearly'
      const { start, end, label } = this.computeMilestoneDateRange(
        duration,
        milestone.milestone_start_date,
        milestone.milestone_end_date,
      )

      const currentSpend = this.sumCardSpendInRange(
        spendIndex.get(cardLast4) ?? [],
        start,
        end,
      )

      const percentage = Math.min(100, (currentSpend / milestone.amount) * 100)
      const remaining = Math.max(0, milestone.amount - currentSpend)

      results.push({
        id,
        type: milestone.type as 'spend' | 'fee waiver',
        description: milestone.description,
        targetAmount: milestone.amount,
        currentSpend,
        percentage: Math.round(percentage * 100) / 100,
        remaining,
        periodLabel: label,
        periodStart: start.toISOString().split('T')[0]!,
        periodEnd: end.toISOString().split('T')[0]!,
      })
    }

    return results
  }

  private async buildMilestoneSpendIndex(
    userId: string,
    milestonesByCard: Map<string, NonNullable<ReturnType<CardResolver['resolve']>>['milestones']>,
  ): Promise<Map<string, { transactionDate: Date, amount: number }[]>> {
    if (milestonesByCard.size === 0) {
      return new Map()
    }

    let minStart: Date | null = null
    let maxEnd: Date | null = null

    for (const milestones of milestonesByCard.values()) {
      for (const milestone of Object.values(milestones)) {
        const duration = milestone.durations[0] ?? 'yearly'
        const { start, end } = this.computeMilestoneDateRange(
          duration,
          milestone.milestone_start_date,
          milestone.milestone_end_date,
        )

        if (!minStart || start < minStart) {
          minStart = start
        }
        if (!maxEnd || end > maxEnd) {
          maxEnd = end
        }
      }
    }

    if (!minStart || !maxEnd) {
      return new Map()
    }

    const rows = await this.transactionRepository.getCardSpendsForRanges({
      userId,
      cards: [...milestonesByCard.keys()],
      range: { start: minStart, end: maxEnd },
    })

    const spendIndex = new Map<string, { transactionDate: Date, amount: number }[]>()

    for (const row of rows) {
      const existing = spendIndex.get(row.cardLast4)
      if (existing) {
        existing.push({ transactionDate: row.transactionDate, amount: row.amount })
      } else {
        spendIndex.set(row.cardLast4, [{ transactionDate: row.transactionDate, amount: row.amount }])
      }
    }

    return spendIndex
  }

  private sumCardSpendInRange(
    spends: { transactionDate: Date, amount: number }[],
    start: Date,
    end: Date,
  ): number {
    let total = 0
    for (const spend of spends) {
      const time = spend.transactionDate.getTime()
      if (time >= start.getTime() && time < end.getTime()) {
        total += spend.amount
      }
    }
    return total
  }

  /**
     * Compute the date range for a milestone based on its duration type.
     * - "quarterly": Current calendar quarter (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec)
     * - "yearly" with custom dates: Uses milestone_start_date/milestone_end_date
     * - "yearly" without custom dates: Current calendar year
     */
  private computeMilestoneDateRange(
    duration: string,
    startDate?: string,
    endDate?: string,
  ): { start: Date, end: Date, label: string } {
    const now = new Date()

    if (duration === 'quarterly') {
      const quarter = Math.floor(now.getMonth() / 3)
      const quarterNames = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec']
      const start = new Date(now.getFullYear(), quarter * 3, 1)
      const end = new Date(now.getFullYear(), quarter * 3 + 3, 1)
      return {
        start,
        end,
        label: `Q${quarter + 1} ${now.getFullYear()} (${quarterNames[quarter]})`,
      }
    }

    // Yearly with custom dates
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)

      const fmtDate = (d: Date) =>
        d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      return {
        start,
        end,
        label: `${fmtDate(start)} – ${fmtDate(end)}`,
      }
    }

    // Yearly default: calendar year
    const start = new Date(now.getFullYear(), 0, 1)
    const end = new Date(now.getFullYear() + 1, 0, 1)
    return { start, end, label: `FY ${now.getFullYear()}` }
  }

  private findParser(email: RawEmail): EmailParser | null {
    return this.parsers.find((parser) => parser.canParse(email)) ?? null
  }

  /**
   * Build a UserCategorizationRules object from the user's persisted
   * merchant → category rules AND from already-categorized transactions.
   * Called once per sync/reprocess.
   *
   * Priority: explicit merchant rules > inferred from existing transactions.
   */
  private async buildUserCategorizationRules(
    userId: string,
  ): Promise<UserCategorizationRules | undefined> {
    const [rules, categorizedMerchants] = await Promise.all([
      this.merchantRuleRepository.findAllByUser(userId),
      this.transactionRepository.getCategorizedMerchants(userId),
    ])

    if (rules.length === 0 && categorizedMerchants.length === 0) {
      return undefined
    }

    const exactMatches: Record<string, string> = {}

    // Lower priority: inferred from existing transactions (added first so
    // explicit rules can overwrite them below)
    for (const entry of categorizedMerchants) {
      exactMatches[entry.merchant] = entry.category
    }

    // Higher priority: explicit merchant rules (overwrites any inferred entry)
    for (const rule of rules) {
      exactMatches[rule.merchant] = rule.category
    }

    this.logger.debug(
      `Loaded ${rules.length} explicit merchant rules and ${categorizedMerchants.length} inferred merchant categories for user ${userId}`,
    )

    return { exact_matches: exactMatches }
  }

  private categorizeTransactions(
    transactions: Transaction[],
    userRules?: UserCategorizationRules,
  ): Transaction[] {
    if (transactions.length === 0) {
      return transactions
    }

    return transactions.map((transaction) => {
      const category = this.transactionCategorizer.categorizeTransaction(
        {
          id: transaction.id,
          paid_to: transaction.merchantRaw,
          vpa: transaction.vpa,
          transaction_mode: transaction.transactionMode,
          amount: transaction.amount,
          transaction_type: transaction.transactionType,
        },
        userRules,
      )

      // Resolve card name from last-4 digits
      const cardName = transaction.cardLast4
        ? this.cardResolver.resolveCardName(transaction.cardLast4)
        : undefined

      return {
        ...transaction,
        category: category.category,
        subcategory: category.subcategory,
        confidence: category.confidence,
        categorizationMethod: category.method,
        requiresReview: category.requiresReview,
        categoryMetadata: category.categoryMetadata,
        cardName,
      }
    })
  }
}

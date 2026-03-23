import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
  NotFoundException,
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags, ApiParam, ApiQuery } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

import { ZodValidationPipe } from '@/app/pipes/zod-validation.pipe'
import { JwtAuthGuard } from '@/modules/auth/presentation/guards/jwt-auth.guard'
import { ExpensesService } from '@/modules/expenses/application/services/expenses.service'
import { GmailOAuthService } from '@/modules/expenses/application/services/gmail-oauth.service'
import { BulkCategorizeDto } from '@/modules/expenses/presentation/dtos/bulk-categorize.dto'
import { BulkUpdateTransactionsDto } from '@/modules/expenses/presentation/dtos/bulk-update-transactions.dto'
import { ListExpensesCursorSchema } from '@/modules/expenses/presentation/dtos/expenses.schema'
import { ListExpenseEmailsDto } from '@/modules/expenses/presentation/dtos/list-expense-emails.dto'
import { ListExpensesDto } from '@/modules/expenses/presentation/dtos/list-expenses.dto'
import { SyncExpensesDto } from '@/modules/expenses/presentation/dtos/sync-expenses.dto'
import { UpdateTransactionDto } from '@/modules/expenses/presentation/dtos/update-transaction.dto'
import { ListResponseDto, OffsetListResponseDto } from '@/shared/infrastructure/dtos/list-response.dto'

import type { ListExpensesCursorInput } from '@/modules/expenses/presentation/dtos/expenses.schema'
import type { RawEmail, Transaction, AnalyticsPeriod } from '@workspace/domain'
import type { FastifyReply, FastifyRequest } from 'fastify'

@ApiTags('expenses')
@Controller('expenses')
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly gmailOAuthService: GmailOAuthService,
  ) {}

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start async expense email sync job' })
  @ApiResponse({
    status: 202,
    description: 'Sync job started, returns job ID for status polling',
  })
  async syncExpenses(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Body() dto: SyncExpensesDto,
  ): Promise<{ jobId: string, message: string }> {
    const { jobId } = await this.expensesService.startSyncJob({
      userId: req.user.id,
      query: dto.query,
      fromDate: dto.fromDate,
    })
    return {
      jobId,
      message: 'Sync job started. Poll /expenses/sync/:jobId for status.',
    }
  }

  @Post('reprocess')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Re-parse stored emails without fetching from Gmail',
    description: 'By default, only processes unprocessed emails. Use forceProcessAll=true to reprocess all emails.',
  })
  @ApiQuery({
    name: 'forceProcessAll',
    required: false,
    type: Boolean,
    description: 'If true, reprocess all emails. If false or omitted, only process unprocessed emails.',
  })
  @ApiResponse({
    status: 202,
    description: 'Reprocess job started, returns job ID for status polling',
  })
  async reprocessEmails(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('forceProcessAll') forceProcessAll?: string,
  ): Promise<{ jobId: string, message: string }> {
    const { jobId } = await this.expensesService.startReprocessJob({
      userId: req.user.id,
      forceProcessAll: forceProcessAll === 'true',
    })
    return {
      jobId,
      message: `Reprocess job started (${forceProcessAll === 'true' ? 'all emails' : 'unprocessed emails only'}). Poll /expenses/sync/:jobId for status.`,
    }
  }

  @Get('sync/:jobId')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle() // Skip rate limiting for status polling
  @ApiOperation({ summary: 'Get sync job status' })
  @ApiParam({ name: 'jobId', description: 'The sync job ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns sync job status and progress',
  })
  async getSyncJobStatus(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('jobId') jobId: string,
  ) {
    const job = await this.expensesService.getSyncJobStatus(jobId)
    if (job?.userId !== req.user.id) {
      throw new NotFoundException('Sync job not found')
    }
    return job
  }

  @Get('sync')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List recent sync jobs' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of recent sync jobs',
  })
  async listSyncJobs(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('limit') limit?: string,
  ) {
    return this.expensesService.getUserSyncJobs(req.user.id, limit ? Number.parseInt(limit, 10) : 10)
  }

  @Get('emails')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List expense-related emails' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated expense email list',
  })
  async listExpenseEmails(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query() query: ListExpenseEmailsDto,
  ): Promise<OffsetListResponseDto<RawEmail>> {
    const page = query.page ?? 1
    const page_size = query.page_size ?? 20
    const offset = (page - 1) * page_size

    const { data, total } = await this.expensesService.listExpenseEmails({
      userId: req.user.id,
      limit: page_size,
      offset,
    })

    return {
      object: 'list',
      data,
      page,
      page_size,
      total,
      has_more: offset + data.length < total,
    }
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List derived expense transactions' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated expense transactions',
  })
  async listExpenses(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query() query: ListExpensesDto,
  ): Promise<OffsetListResponseDto<Transaction>> {
    const page = query.page ?? 1
    const page_size = query.page_size ?? 20
    const offset = (page - 1) * page_size

    const filters: Record<string, unknown> = {}
    if (query.category) filters.category = query.category
    if (query.mode) filters.mode = query.mode
    if (query.review !== undefined) filters.requiresReview = query.review === 'true'
    if (query.date_from) filters.dateFrom = new Date(query.date_from)
    if (query.date_to) filters.dateTo = new Date(query.date_to)
    if (query.search) filters.search = query.search

    const { data, total } = await this.expensesService.listExpenses({
      userId: req.user.id,
      limit: page_size,
      offset,
      filters: Object.keys(filters).length > 0 ? (filters) : undefined,
    })

    return {
      object: 'list',
      data,
      page,
      page_size,
      total,
      has_more: offset + data.length < total,
    }
  }

  @Get('transactions/cursor')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List transactions with cursor-based pagination' })
  @ApiResponse({
    status: 200,
    description: 'Returns cursor-paginated expense transactions',
  })
  async listExpensesCursor(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query(new ZodValidationPipe(ListExpensesCursorSchema)) query: ListExpensesCursorInput,
  ): Promise<ListResponseDto<Transaction>> {
    const filters: Record<string, unknown> = {}
    if (query.category) filters.category = query.category
    if (query.mode) filters.mode = query.mode
    if (query.review !== undefined) filters.requiresReview = query.review === 'true'
    if (query.from) filters.dateFrom = new Date(query.from)
    if (query.to) filters.dateTo = new Date(query.to)
    if (query.search) filters.search = query.search

    const { data, nextCursor, hasMore } = await this.expensesService.listExpensesCursor({
      userId: req.user.id,
      pageSize: query.page_size,
      cursor: query.cursor,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    })

    return {
      object: 'list',
      data,
      has_more: hasMore,
      next_cursor: nextCursor,
    }
  }

  @Get('transactions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a single transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the transaction',
  })
  async getTransaction(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
  ): Promise<Transaction> {
    const transaction = await this.expensesService.getTransactionById({
      userId: req.user.id,
      id,
    })
    if (!transaction) {
      throw new NotFoundException('Transaction not found')
    }
    return transaction
  }

  @Patch('transactions/bulk-categorize')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Bulk categorize transactions by merchant',
    description:
            'Updates the category and subcategory for ALL transactions matching the given merchant name.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the merchant, new category, subcategory, and count of updated rows',
  })
  async bulkCategorizeByMerchant(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Body() dto: BulkCategorizeDto,
  ) {
    const result = await this.expensesService.bulkCategorizeByMerchant({
      userId: req.user.id,
      merchant: dto.merchant,
      category: dto.category,
      subcategory: dto.subcategory,
      categoryMetadata: dto.categoryMetadata,
    })
    return { data: result }
  }

  @Patch('transactions/bulk-update')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Bulk update transactions by IDs',
    description:
            'Updates category, subcategory, mode, or review status for a set of transaction IDs.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the count of updated transactions',
  })
  async bulkUpdateTransactions(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Body() dto: BulkUpdateTransactionsDto,
  ) {
    const result = await this.expensesService.bulkUpdateByIds({
      userId: req.user.id,
      ids: dto.ids,
      data: dto.data,
    })
    return { data: result }
  }

  @Patch('transactions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update / correct a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the updated transaction',
  })
  async updateTransaction(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    return this.expensesService.updateTransaction({
      userId: req.user.id,
      id,
      data: dto,
    })
  }

  @Get('merchants')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get distinct merchants with category info',
    description:
            'Returns a list of unique merchants for the user with their most common category assignment and transaction count.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns list of merchants with category info',
  })
  async getDistinctMerchants(@Request() req: FastifyRequest & { user: { id: string } }) {
    const merchants = await this.expensesService.getDistinctMerchants(req.user.id)
    return { data: merchants }
  }

  @Get('emails/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a single expense email (raw)' })
  @ApiParam({ name: 'id', description: 'Raw email ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the raw email payload (html/text/headers)',
  })
  async getExpenseEmail(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
  ): Promise<RawEmail> {
    const email = await this.expensesService.getExpenseEmailById({ userId: req.user.id, id })
    if (!email) {
      throw new NotFoundException('Email not found')
    }
    return email
  }

  // ── Analytics ──

  @Get('analytics/summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Spending summary for a period' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Explicit start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Explicit end date (YYYY-MM-DD)' })
  async getAnalyticsSummary(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('period') period: AnalyticsPeriod = 'month',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (startDate && endDate) {
      return this.expensesService.getSpendingSummaryForDateRange(
        req.user.id,
        startDate,
        endDate,
      )
    }

    return this.expensesService.getSpendingSummary(req.user.id, period)
  }

  @Get('analytics/by-category')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Spending grouped by category' })
  async getByCategory(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('period') period: AnalyticsPeriod = 'month',
  ) {
    return this.expensesService.getSpendingByCategory(req.user.id, period)
  }

  @Get('analytics/by-mode')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Spending grouped by payment mode' })
  async getByMode(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('period') period: AnalyticsPeriod = 'month',
  ) {
    return this.expensesService.getSpendingByMode(req.user.id, period)
  }

  @Get('analytics/top-merchants')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Top merchants by spend' })
  async getTopMerchants(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('period') period: AnalyticsPeriod = 'month',
    @Query('limit') limit?: string,
  ) {
    return this.expensesService.getTopMerchants(
      req.user.id,
      period,
      limit ? Number.parseInt(limit, 10) : 10,
    )
  }

  @Get('analytics/daily')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Daily spending breakdown' })
  async getDailySpending(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('period') period: AnalyticsPeriod = 'month',
  ) {
    return this.expensesService.getDailySpending(req.user.id, period)
  }

  @Get('analytics/monthly-trend')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Monthly trend (last N months)' })
  async getMonthlyTrend(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('months') months?: string,
  ) {
    return this.expensesService.getMonthlyTrend(
      req.user.id,
      months ? Number.parseInt(months, 10) : 12,
    )
  }

  @Get('analytics/by-card')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Spending grouped by credit card' })
  async getByCard(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('period') period: AnalyticsPeriod = 'month',
  ) {
    return this.expensesService.getSpendingByCard(req.user.id, period)
  }

  // ── Extended Analytics ──

  @Get('analytics/day-of-week')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Spending by day of week' })
  async getDayOfWeekSpending(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('period') period: AnalyticsPeriod = 'month',
  ) {
    return this.expensesService.getDayOfWeekSpending(req.user.id, period)
  }

  @Get('analytics/category-trend')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Category spending trend over months' })
  async getCategoryTrend(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('months') months?: string,
  ) {
    return this.expensesService.getCategoryTrend(
      req.user.id,
      months ? Number.parseInt(months, 10) : 6,
    )
  }

  @Get('analytics/period-comparison')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Compare current vs previous period' })
  async getPeriodComparison(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('period') period: AnalyticsPeriod = 'month',
  ) {
    return this.expensesService.getPeriodComparison(req.user.id, period)
  }

  @Get('analytics/cumulative')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cumulative spending over time' })
  async getCumulativeSpend(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('period') period: AnalyticsPeriod = 'month',
  ) {
    return this.expensesService.getCumulativeSpend(req.user.id, period)
  }

  @Get('analytics/savings-rate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Monthly savings rate (income vs expenses)' })
  async getSavingsRate(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('months') months?: string,
  ) {
    return this.expensesService.getSavingsRate(req.user.id, months ? Number.parseInt(months, 10) : 12)
  }

  @Get('analytics/card-categories')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Per-card category breakdown' })
  async getCardCategories(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('period') period: AnalyticsPeriod = 'month',
  ) {
    return this.expensesService.getCardCategoryBreakdown(req.user.id, period)
  }

  @Get('analytics/top-vpas')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Top UPI VPA payees' })
  async getTopVpas(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('period') period: AnalyticsPeriod = 'month',
    @Query('limit') limit?: string,
  ) {
    return this.expensesService.getTopVpas(
      req.user.id,
      period,
      limit ? Number.parseInt(limit, 10) : 10,
    )
  }

  @Get('analytics/velocity')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Spending velocity (rolling average ₹/day)' })
  async getSpendingVelocity(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('period') period: AnalyticsPeriod = 'month',
  ) {
    return this.expensesService.getSpendingVelocity(req.user.id, period)
  }

  @Get('analytics/milestone-etas')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Milestone completion ETAs for all cards' })
  async getMilestoneEtas(@Request() req: FastifyRequest & { user: { id: string } }) {
    return this.expensesService.getMilestoneEtas(req.user.id)
  }

  @Get('analytics/largest-transactions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Largest transactions in period' })
  async getLargestTransactions(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('period') period: AnalyticsPeriod = 'month',
    @Query('limit') limit?: string,
  ) {
    return this.expensesService.getLargestTransactions(
      req.user.id,
      period,
      limit ? Number.parseInt(limit, 10) : 10,
    )
  }

  @Get('analytics/bus-spending')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Bus spending analytics and patterns' })
  @ApiResponse({
    status: 200,
    description: 'Returns bus spending summary, routes, frequency, and trends',
  })
  async getBusAnalytics(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('period') period: AnalyticsPeriod = 'year',
  ) {
    return this.expensesService.getBusAnalytics(req.user.id, period)
  }

  @Get('analytics/investment-patterns')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Investment analytics across stocks, mutual funds, and gold' })
  @ApiResponse({
    status: 200,
    description:
            'Returns investment summary, asset allocation, platform breakdown, SIP detection, and trends',
  })
  async getInvestmentAnalytics(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('period') period: AnalyticsPeriod = 'year',
  ) {
    return this.expensesService.getInvestmentAnalytics(req.user.id, period)
  }

  @Get('gmail/connect')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start Gmail OAuth flow' })
  @ApiResponse({ status: 200, description: 'Returns OAuth URL' })
  async connectGmail(
    @Request() req: FastifyRequest & { user: { id: string } },
  ): Promise<{ url: string }> {
    const url = this.gmailOAuthService.getAuthUrl(req.user.id)
    return { url }
  }

  @Get('gmail/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Gmail connection status' })
  @ApiResponse({ status: 200, description: 'Returns Gmail connection status' })
  async gmailStatus(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<{ connected: boolean, email?: string | null }> {
    // Disable caching and ETag for dynamic status endpoint
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.header('Pragma', 'no-cache')
    res.header('Expires', '0')
    return this.gmailOAuthService.getStatus(req.user.id)
  }
}

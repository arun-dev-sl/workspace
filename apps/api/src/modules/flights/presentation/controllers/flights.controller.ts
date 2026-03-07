import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

import { JwtAuthGuard } from '@/modules/auth/presentation/guards/jwt-auth.guard'
import { FlightsService } from '@/modules/flights/application/services/flights.service'
import { ListFlightActivitiesDto } from '@/modules/flights/presentation/dtos/list-flight-activities.dto'
import { ListFlightActivitiesQuerySchema } from '@/modules/flights/presentation/dtos/list-flight-activities.schema'
import { ListFlightLlmReviewCandidatesDto } from '@/modules/flights/presentation/dtos/list-flight-llm-review-candidates.dto'
import { ListFlightLlmReviewCandidatesQuerySchema } from '@/modules/flights/presentation/dtos/list-flight-llm-review-candidates.schema'
import { ProcessFlightLlmReviewDto } from '@/modules/flights/presentation/dtos/process-flight-llm-review.dto'
import { ProcessFlightLlmReviewRequestSchema } from '@/modules/flights/presentation/dtos/process-flight-llm-review.schema'
import { StartFlightLlmReviewDto } from '@/modules/flights/presentation/dtos/start-flight-llm-review.dto'
import { StartFlightLlmReviewRequestSchema } from '@/modules/flights/presentation/dtos/start-flight-llm-review.schema'
import { SyncFlightsDto } from '@/modules/flights/presentation/dtos/sync-flights.dto'
import { SyncFlightsRequestSchema } from '@/modules/flights/presentation/dtos/sync-flights.schema'
import { UpdateFlightActivityDto } from '@/modules/flights/presentation/dtos/update-flight-activity.dto'
import { UpdateFlightActivityRequestSchema } from '@/modules/flights/presentation/dtos/update-flight-activity.schema'
import { OffsetListResponseDto } from '@/shared/infrastructure/dtos/list-response.dto'

import type { FlightActivity, FlightSyncJobStatus, RawEmail } from '@workspace/domain'
import type { FastifyRequest } from 'fastify'
import type { ZodType } from 'zod'

@ApiTags('flights')
@Controller('flights')
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start async flight email sync job' })
  @ApiResponse({
    status: 202,
    description: 'Flight sync job started, returns job ID for status polling',
  })
  async syncFlights(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Body() dto: SyncFlightsDto,
  ): Promise<{ jobId: string, message: string }> {
    const input = this.parseOrThrow(SyncFlightsRequestSchema, dto)
    const { jobId } = await this.flightsService.startSyncJob({
      userId: req.user.id,
      query: input.query,
      fromDate: input.fromDate,
    })

    return {
      jobId,
      message: 'Sync job started. Poll /flights/sync/:jobId for status.',
    }
  }

  @Post('reprocess')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Re-parse stored flight emails without fetching from Gmail',
  })
  @ApiQuery({
    name: 'forceProcessAll',
    required: false,
    type: Boolean,
  })
  async reprocessFlights(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('forceProcessAll') forceProcessAll?: string,
  ): Promise<{ jobId: string, message: string }> {
    const { jobId } = await this.flightsService.startReprocessJob({
      userId: req.user.id,
      forceProcessAll: forceProcessAll === 'true',
    })

    return {
      jobId,
      message: `Reprocess job started (${forceProcessAll === 'true' ? 'all emails' : 'failed or unprocessed emails only'}). Poll /flights/sync/:jobId for status.`,
    }
  }

  @Post('sync/review')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start reviewed flight sync without automatic LLM fallback' })
  async startReviewedFlightSync(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Body() dto: StartFlightLlmReviewDto,
  ): Promise<{ jobId: string, message: string }> {
    const input = this.parseOrThrow(StartFlightLlmReviewRequestSchema, dto)
    const { jobId } = await this.flightsService.startReviewedSyncJob({
      userId: req.user.id,
      fromDate: input.fromDate,
    })

    return {
      jobId,
      message:
                'Reviewed sync started. Poll /flights/sync/:jobId for status and then fetch review candidates.',
    }
  }

  @Get('sync/review/candidates')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List flight emails eligible for manual LLM review' })
  async listReviewedFlightCandidates(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query() query: ListFlightLlmReviewCandidatesDto,
  ): Promise<{ data: Awaited<ReturnType<FlightsService['listLlmReviewCandidates']>> }> {
    const input = this.parseOrThrow(ListFlightLlmReviewCandidatesQuerySchema, query)

    return {
      data: await this.flightsService.listLlmReviewCandidates({
        userId: req.user.id,
        fromDate: input.fromDate,
        limit: input.limit,
      }),
    }
  }

  @Post('sync/review/process')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Process selected flight emails with optional LLM fallback' })
  async processReviewedFlightCandidates(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Body() dto: ProcessFlightLlmReviewDto,
  ): Promise<{ jobId: string, message: string }> {
    const input = this.parseOrThrow(ProcessFlightLlmReviewRequestSchema, dto)
    const { jobId } = await this.flightsService.startSelectedLlmProcessingJob({
      userId: req.user.id,
      emailIds: input.emailIds,
    })

    return {
      jobId,
      message:
                'Selected flight emails queued for processing. Poll /flights/sync/:jobId for status.',
    }
  }

  @Get('sync/:jobId')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @ApiOperation({ summary: 'Get flight sync job status' })
  @ApiParam({ name: 'jobId', description: 'The sync job ID' })
  async getSyncJobStatus(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('jobId') jobId: string,
  ): Promise<FlightSyncJobStatus> {
    const job = await this.flightsService.getSyncJobStatus(jobId)
    if (job?.userId !== req.user.id) {
      throw new NotFoundException('Sync job not found')
    }

    return job
  }

  @Get('sync')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List recent flight sync jobs' })
  async listSyncJobs(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('limit') limit?: string,
  ): Promise<FlightSyncJobStatus[]> {
    return this.flightsService.getUserSyncJobs(
      req.user.id,
      limit ? Number.parseInt(limit, 10) : 10,
    )
  }

  @Get('activities')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List extracted flight activities' })
  async listFlightActivities(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query() query: ListFlightActivitiesDto,
  ): Promise<OffsetListResponseDto<FlightActivity>> {
    const input = this.parseOrThrow(ListFlightActivitiesQuerySchema, query)
    const offset = (input.page - 1) * input.page_size
    const { data, total } = await this.flightsService.listFlightActivities({
      userId: req.user.id,
      limit: input.page_size,
      offset,
    })

    return {
      object: 'list',
      data,
      page: input.page,
      page_size: input.page_size,
      total,
      has_more: offset + data.length < total,
    }
  }

  @Get('activities/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a single flight activity' })
  async getFlightActivity(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
  ): Promise<FlightActivity> {
    const activity = await this.flightsService.getFlightActivityById({
      userId: req.user.id,
      id,
    })
    if (!activity) {
      throw new NotFoundException('Flight activity not found')
    }

    return activity
  }

  @Patch('activities/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update or enrich a flight activity' })
  async updateFlightActivity(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateFlightActivityDto,
  ): Promise<FlightActivity> {
    const input = this.parseOrThrow(UpdateFlightActivityRequestSchema, dto)

    return this.flightsService.updateFlightActivity({
      userId: req.user.id,
      id,
      data: input,
    })
  }

  @Get('emails/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a single source flight email (raw)' })
  async getFlightEmail(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
  ): Promise<RawEmail> {
    const email = await this.flightsService.getFlightEmailById({
      userId: req.user.id,
      id,
    })
    if (!email) {
      throw new NotFoundException('Flight email not found')
    }

    return email
  }

  private parseOrThrow<T>(schema: ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input)
    if (result.success) {
      return result.data
    }

    throw new BadRequestException(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    )
  }
}

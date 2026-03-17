import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

import { JwtAuthGuard } from '@/modules/auth/presentation/guards/jwt-auth.guard'
import { HotelsService } from '@/modules/hotels/application/services/hotels.service'
import { CreateHotelStayDto } from '@/modules/hotels/presentation/dtos/create-hotel-stay.dto'
import { CreateHotelStayRequestSchema } from '@/modules/hotels/presentation/dtos/create-hotel-stay.schema'
import { ListHotelLlmReviewCandidatesDto } from '@/modules/hotels/presentation/dtos/list-hotel-llm-review-candidates.dto'
import { ListHotelLlmReviewCandidatesQuerySchema } from '@/modules/hotels/presentation/dtos/list-hotel-llm-review-candidates.schema'
import { ListHotelStaysDto } from '@/modules/hotels/presentation/dtos/list-hotel-stays.dto'
import { ListHotelStaysQuerySchema } from '@/modules/hotels/presentation/dtos/list-hotel-stays.schema'
import { ProcessHotelLlmReviewDto } from '@/modules/hotels/presentation/dtos/process-hotel-llm-review.dto'
import { ProcessHotelLlmReviewSchema } from '@/modules/hotels/presentation/dtos/process-hotel-llm-review.schema'
import { UpdateHotelStayDto } from '@/modules/hotels/presentation/dtos/update-hotel-stay.dto'
import { UpdateHotelStayRequestSchema } from '@/modules/hotels/presentation/dtos/update-hotel-stay.schema'
import { OffsetListResponseDto } from '@/shared/infrastructure/dtos/list-response.dto'

import type { HotelStay, HotelSyncJobStatus, RawEmail } from '@workspace/domain'
import type { FastifyRequest } from 'fastify'
import type { ZodType } from 'zod'

@ApiTags('hotels')
@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Get('stays')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List stored hotel stays' })
  async listHotelStays(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query() query: ListHotelStaysDto,
  ): Promise<OffsetListResponseDto<HotelStay>> {
    const input = this.parseOrThrow(ListHotelStaysQuerySchema, query)
    const offset = (input.page - 1) * input.page_size
    const { data, total } = await this.hotelsService.listHotelStays({
      userId: req.user.id,
      limit: input.page_size,
      offset,
      includeArchived: input.includeArchived,
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

  @Post('stays')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a hotel stay manually' })
  async createHotelStay(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Body() dto: CreateHotelStayDto,
  ): Promise<HotelStay> {
    const input = this.parseOrThrow(CreateHotelStayRequestSchema, dto)

    return this.hotelsService.createHotelStay({
      userId: req.user.id,
      data: input,
    })
  }

  @Patch('stays/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Edit a hotel stay manually' })
  async updateHotelStay(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateHotelStayDto,
  ): Promise<HotelStay> {
    const input = this.parseOrThrow(UpdateHotelStayRequestSchema, dto)

    return this.hotelsService.updateHotelStay({
      userId: req.user.id,
      id,
      data: input,
    })
  }

  @Patch('stays/:id/archive')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Archive a hotel stay' })
  async archiveHotelStay(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
  ): Promise<HotelStay> {
    return this.hotelsService.archiveHotelStay({ userId: req.user.id, id })
  }

  @Patch('stays/:id/unarchive')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unarchive a hotel stay' })
  async unarchiveHotelStay(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
  ): Promise<HotelStay> {
    return this.hotelsService.unarchiveHotelStay({ userId: req.user.id, id })
  }

  @Delete('stays/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a hotel stay permanently' })
  async deleteHotelStay(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    await this.hotelsService.deleteHotelStay({ userId: req.user.id, id })
    return { message: 'Hotel stay deleted successfully' }
  }

  @Get('emails/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a source email for a hotel stay' })
  async getHotelEmail(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
  ): Promise<RawEmail> {
    const email = await this.hotelsService.getHotelEmailById({
      userId: req.user.id,
      id,
    })
    if (!email) {
      throw new NotFoundException('Hotel email not found')
    }

    return email
  }

  @Get('review/candidates')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List hotel emails eligible for manual LLM review' })
  async listHotelReviewCandidates(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query() query: ListHotelLlmReviewCandidatesDto,
  ): Promise<{ data: Awaited<ReturnType<HotelsService['listLlmReviewCandidates']>> }> {
    const input = this.parseOrThrow(ListHotelLlmReviewCandidatesQuerySchema, query)

    return {
      data: await this.hotelsService.listLlmReviewCandidates({
        userId: req.user.id,
        startDate: input.startDate,
        endDate: input.endDate,
        limit: input.limit,
      }),
    }
  }

  @Post('review/process')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue selected hotel emails for LLM extraction' })
  async processHotelReviewCandidates(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Body() dto: ProcessHotelLlmReviewDto,
  ): Promise<{ jobId: string, message: string }> {
    const input = this.parseOrThrow(ProcessHotelLlmReviewSchema, dto)
    const { jobId } = await this.hotelsService.startSelectedLlmProcessingJob({
      userId: req.user.id,
      emailIds: input.emailIds,
    })

    return {
      jobId,
      message: 'Selected hotel emails queued for processing. Poll /hotels/sync/:jobId for status.',
    }
  }

  @Get('sync/:jobId')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @ApiOperation({ summary: 'Get hotel sync job status' })
  @ApiParam({ name: 'jobId', description: 'The sync job ID' })
  async getSyncJobStatus(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('jobId') jobId: string,
  ): Promise<HotelSyncJobStatus> {
    const job = await this.hotelsService.getSyncJobStatus(jobId)
    if (job?.userId !== req.user.id) {
      throw new NotFoundException('Sync job not found')
    }

    return job
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

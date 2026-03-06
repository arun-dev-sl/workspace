import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'

import { JwtAuthGuard } from '@/modules/auth/presentation/guards/jwt-auth.guard'

import { DividendsService } from '../../application/services/dividends.service'

import type { FastifyRequest } from 'fastify'

@ApiTags('Dividends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dividends')
export class DividendsController {
  constructor(private readonly dividendsService: DividendsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all dividends for current user' })
  async getDividends(@Request() req: FastifyRequest & { user: { id: string } }) {
    return this.dividendsService.getDividends(req.user.id)
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dividend dashboard analytics' })
  async getDashboard(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('year') year?: string,
  ) {
    const parsedYear = year ? Number.parseInt(year, 10) : undefined
    return this.dividendsService.getDashboard(req.user.id, parsedYear)
  }

  @Post('import')
  @ApiOperation({ summary: 'Import dividends from JSON report' })
  async importReport(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Body() body: { json: string },
  ) {
    return this.dividendsService.importReport(req.user.id, body.json)
  }

  @Patch(':id/yield')
  @ApiOperation({ summary: 'Update invested value for yield calculation' })
  async enrichYield(
    @Param('id') id: string,
    @Request() req: FastifyRequest & { user: { id: string } },
    @Body() body: { investedValue: number },
  ) {
    return this.dividendsService.enrichYield(id, req.user.id, body.investedValue)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a dividend entry' })
  async deleteDividend(
    @Param('id') id: string,
    @Request() req: FastifyRequest & { user: { id: string } },
  ) {
    await this.dividendsService.deleteDividend(id, req.user.id)
    return { message: 'Dividend entry deleted' }
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'

import { JwtAuthGuard } from '@/modules/auth/presentation/guards/jwt-auth.guard'

import { PrincipalService } from '../../application/services/principal.service'

import type { FastifyRequest } from 'fastify'

@ApiTags('Principal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('principal')
export class PrincipalController {
  constructor(private readonly principalService: PrincipalService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'Get principal investment analytics' })
  async getAnalytics(
    @Request() req: FastifyRequest & { user: { id: string } },
  ) {
    return this.principalService.getAnalytics(req.user.id)
  }

  @Post('import')
  @ApiOperation({ summary: 'Import contributions and/or distribution from pasted text' })
  async importAll(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Body() body: { contributions?: string, distribution?: string },
  ) {
    return this.principalService.importAll(
      req.user.id,
      body.contributions ?? '',
      body.distribution ?? '',
    )
  }

  @Post('import/contributions')
  @ApiOperation({ summary: 'Import monthly contributions from pasted text' })
  async importContributions(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Body() body: { text: string },
  ) {
    return this.principalService.importContributions(req.user.id, body.text)
  }

  @Post('import/distribution')
  @ApiOperation({ summary: 'Import asset distribution from pasted text' })
  async importDistribution(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Body() body: { text: string },
  ) {
    return this.principalService.importDistribution(req.user.id, body.text)
  }

  @Post('contributions')
  @ApiOperation({ summary: 'Create a single contribution' })
  async createContribution(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Body() body: { month: string, year: number, amountLakhs: number, salaryLakhs?: number | null },
  ) {
    return this.principalService.createContribution(req.user.id, body)
  }

  @Patch('contributions/:id')
  @ApiOperation({ summary: 'Update a single contribution' })
  async updateContribution(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { month?: string, year?: number, amountLakhs?: number, salaryLakhs?: number | null },
  ) {
    return this.principalService.updateContribution(id, req.user.id, body)
  }

  @Delete('contributions/:id')
  @ApiOperation({ summary: 'Delete a single contribution' })
  async deleteContribution(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.principalService.deleteContribution(id, req.user.id)
  }

  @Post('distribution')
  @ApiOperation({ summary: 'Create a single distribution entry' })
  async createDistribution(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Body() body: { name: string, value: number },
  ) {
    return this.principalService.createDistribution(req.user.id, body)
  }

  @Patch('distribution/:id')
  @ApiOperation({ summary: 'Update a single distribution entry' })
  async updateDistribution(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { name?: string, value?: number },
  ) {
    return this.principalService.updateDistribution(id, req.user.id, body)
  }

  @Delete('distribution/:id')
  @ApiOperation({ summary: 'Delete a single distribution entry' })
  async deleteDistribution(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.principalService.deleteDistribution(id, req.user.id)
  }
}

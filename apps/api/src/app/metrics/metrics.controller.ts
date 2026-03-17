import { Controller, Get, Res } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

import { MetricsService } from './metrics.service'

import type { FastifyReply } from 'fastify'

@ApiExcludeController()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Res() reply: FastifyReply): Promise<void> {
    const metrics = await this.metricsService.getMetrics()
    void reply
      .header('Content-Type', this.metricsService.getContentType())
      .send(metrics)
  }
}

import { Injectable } from '@nestjs/common'
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client'

import type {OnModuleInit} from '@nestjs/common';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry()

  readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  })

  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  })

  readonly httpRequestErrors = new Counter({
    name: 'http_request_errors_total',
    help: 'Total number of HTTP request errors (4xx and 5xx)',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  })

  readonly dbQueryDuration = new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation'] as const,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [this.registry],
  })

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry })
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics()
  }

  getContentType(): string {
    return this.registry.contentType
  }
}

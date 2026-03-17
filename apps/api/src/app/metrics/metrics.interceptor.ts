import { Injectable } from '@nestjs/common'
import { tap } from 'rxjs/operators'

import { MetricsService } from './metrics.service'

import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import type { Observable } from 'rxjs'

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest()
    const method: string = request.method
    const route: string = request.routeOptions?.url ?? request.url
    const startTime = performance.now()

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse()
          const statusCode: number = response.statusCode
          const duration = (performance.now() - startTime) / 1000

          this.metricsService.httpRequestDuration.observe(
            { method, route, status_code: statusCode },
            duration,
          )
          this.metricsService.httpRequestsTotal.inc({
            method, route, status_code: statusCode,
          })

          if (statusCode >= 400) {
            this.metricsService.httpRequestErrors.inc({
              method, route, status_code: statusCode,
            })
          }
        },
        error: () => {
          const duration = (performance.now() - startTime) / 1000
          const statusCode = 500

          this.metricsService.httpRequestDuration.observe(
            { method, route, status_code: statusCode },
            duration,
          )
          this.metricsService.httpRequestsTotal.inc({
            method, route, status_code: statusCode,
          })
          this.metricsService.httpRequestErrors.inc({
            method, route, status_code: statusCode,
          })
        },
      }),
    )
  }
}

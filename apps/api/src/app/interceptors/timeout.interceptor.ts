import {
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { throwError, TimeoutError } from 'rxjs'
import { catchError, timeout } from 'rxjs/operators'

import type {
  NestInterceptor,
  ExecutionContext,
  CallHandler } from '@nestjs/common'
import type { Observable } from 'rxjs'

const REQUEST_TIMEOUT_KEY = 'request_timeout_ms'

/**
 * Timeout interceptor - sets request timeout (default: 30s)
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly timeoutMs: number

  constructor(
    private readonly reflector: Reflector,
    timeoutMs: number = 30_000,
  ) {
    this.timeoutMs = timeoutMs
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const routeTimeout = this.reflector.getAllAndOverride<number | null>(
      REQUEST_TIMEOUT_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (routeTimeout === null) {
      return next.handle()
    }

    const timeoutMs = routeTimeout ?? this.timeoutMs

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                `Request timeout after ${timeoutMs}ms`,
              ),
          )
        }
        return throwError(() => error)
      }),
    )
  }
}

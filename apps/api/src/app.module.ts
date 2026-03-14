import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { ClsModule } from 'nestjs-cls'

import { createClsConfig } from '@/app/config/cls.config'
import { validateEnv } from '@/app/config/env.schema'
import { throttlerConfig } from '@/app/config/security.config'
import { AllExceptionsFilter } from '@/app/filters/all-exceptions.filter'
import { ProblemDetailsFilter } from '@/app/filters/problem-details.filter'
import { ThrottlerExceptionFilter } from '@/app/filters/throttler-exception.filter'
import { HealthModule } from '@/app/health/health.module'
import { CorrelationIdInterceptor } from '@/app/interceptors/correlation-id.interceptor'
import { DeprecationInterceptor } from '@/app/interceptors/deprecation.interceptor'
import { RequestContextInterceptor } from '@/app/interceptors/request-context.interceptor'
import { TraceContextInterceptor } from '@/app/interceptors/trace-context.interceptor'
import { LoggerModule } from '@/app/logger/logger.module'
import { MetricsModule } from '@/app/metrics/metrics.module'
import { ApiVersionMiddleware } from '@/app/middleware/api-version.middleware'
import { SwaggerDevController } from '@/app/swagger/swagger-dev.controller'
import { AiAssistantModule } from '@/modules/ai-assistant/ai-assistant.module'
import { AuthModule } from '@/modules/auth/auth.module'
import { DividendsModule } from '@/modules/dividends/dividends.module'
import { ExpensesModule } from '@/modules/expenses/expenses.module'
import { FlightsModule } from '@/modules/flights/flights.module'
import { HoldingsModule } from '@/modules/holdings/holdings.module'
import { HotelsModule } from '@/modules/hotels/hotels.module'
import { PlaygroundModule } from '@/modules/playground/playground.module'
import { PrincipalModule } from '@/modules/principal/principal.module'
import { TodoModule } from '@/modules/todo/todo.module'
import { DrizzleModule } from '@/shared/infrastructure/db/db.module'
import { DomainEventsModule } from '@/shared/infrastructure/events/domain-events.module'

import type { NestModule, MiddlewareConsumer } from '@nestjs/common'

/**
 * Root module: assembles all feature modules and infrastructure
 *
 * Architecture:
 * - Modular Layered Architecture (Application, Infrastructure, Presentation)
 * - Dependency Inversion Principle (DIP)
 * - Anemic Design Pattern (DTOs + Services for business logic)
 */
@Module({
  imports: [
    // Config module: global environment variable management
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigService available app-wide
      validate: validateEnv, // Validate env vars with Zod
      cache: process.env.NODE_ENV === 'production', // Only cache in production
    }),
    // CLS module: request context management (Request ID, tracing, etc.)
    ClsModule.forRoot(createClsConfig()),
    // Logger module: high-performance structured logging (Pino)
    LoggerModule,
    // Event module: domain and integration events
    EventEmitterModule.forRoot({
      wildcard: true, // Support wildcard event listeners (e.g., 'user.*')
      delimiter: '.', // Event name delimiter
      maxListeners: 10, // Max listeners per event
      verboseMemoryLeak: true, // Warn when exceeding maxListeners
      ignoreErrors: false, // Don't ignore event handler errors
    }),
    // Database module: global Drizzle instance
    DrizzleModule.forRoot(),
    // Domain events module: global domain event publisher
    DomainEventsModule,
    // Rate limiting module: prevent API abuse
    ThrottlerModule.forRoot([
      {
        ttl: throttlerConfig.ttl,
        limit: throttlerConfig.limit,
      },
    ]),
    HealthModule, // Health check module
    MetricsModule, // Prometheus metrics
    // Business modules
    TodoModule, // Todo module (anemic model example)
    AuthModule, // Auth module (authentication + DDD example)
    AiAssistantModule, // Local AI assistant via OpenWire
    ExpensesModule, // Expenses module (email parsing + finance data)
    FlightsModule, // Flights module (travel email extraction)
    HotelsModule, // Hotels module (hotel stays + review queue)
    HoldingsModule, // Holdings module (investment portfolio management)
    DividendsModule, // Dividends module (dividend income tracking + analytics)
    PrincipalModule, // Principal module (principal investment tracking)
    PlaygroundModule, // Playground module (ad-hoc email fetch for parser experiments)
  ],
  controllers: [
    // Dev helper controller (dev only)
    ...(process.env.NODE_ENV === 'production' ? [] : [SwaggerDevController]),
  ],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Exception filters (require ClsService injection)
    AllExceptionsFilter,
    ProblemDetailsFilter,
    ThrottlerExceptionFilter,
    // Interceptors (require ClsService injection)
    RequestContextInterceptor,
    CorrelationIdInterceptor,
    TraceContextInterceptor,
    DeprecationInterceptor,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Register global middleware
    const middlewares = [
      ApiVersionMiddleware, // API versioning
    ]
    consumer.apply(...middlewares).forRoutes('{*path}') // Apply to all routes
  }
}

import fastifyCors from '@fastify/cors'
import fastifyEtag from '@fastify/etag'
import fastifyHelmet from '@fastify/helmet'
import { RequestMethod } from '@nestjs/common'
import { NestFactory, Reflector } from '@nestjs/core'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { Logger } from 'nestjs-pino'

import { corsConfig } from '@/app/config/security.config'
import { setupSwagger } from '@/app/config/swagger.config'
import { createValidationPipe } from '@/app/config/validation.config'
import { AllExceptionsFilter } from '@/app/filters/all-exceptions.filter'
import { ProblemDetailsFilter } from '@/app/filters/problem-details.filter'
import { ThrottlerExceptionFilter } from '@/app/filters/throttler-exception.filter'
import { CorrelationIdInterceptor } from '@/app/interceptors/correlation-id.interceptor'
import { DeprecationInterceptor } from '@/app/interceptors/deprecation.interceptor'
import { LinkHeaderInterceptor } from '@/app/interceptors/link-header.interceptor'
import { LocationHeaderInterceptor } from '@/app/interceptors/location-header.interceptor'
import { RequestContextInterceptor } from '@/app/interceptors/request-context.interceptor'
import { TimeoutInterceptor } from '@/app/interceptors/timeout.interceptor'
import { TraceContextInterceptor } from '@/app/interceptors/trace-context.interceptor'
import { TransformInterceptor } from '@/app/interceptors/transform.interceptor'
import { closeDatabasePool } from '@/shared/infrastructure/db/db.provider'

import { AppModule } from './app.module'

import type { NestFastifyApplication } from '@nestjs/platform-fastify'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true, // Buffer logs until Logger is ready
  })

  // Use nestjs-pino Logger
  app.useLogger(app.get(Logger))

  // CORS config
  await app.register(fastifyCors, corsConfig)

  // Security headers
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  })

  // ETag support (production only)
  if (process.env.NODE_ENV === 'production') {
    await app.register(fastifyEtag)
  }

  // Global route prefix
  app.setGlobalPrefix('api', {
    exclude: [
      // Exclude Swagger dev credentials endpoint
      { path: '.well-known', method: RequestMethod.ALL },
      { path: '.well-known/{*path}', method: RequestMethod.ALL },
      // Exclude health check endpoints
      { path: 'health', method: RequestMethod.ALL },
      { path: 'health/{*path}', method: RequestMethod.ALL },
      // Exclude Gmail OAuth callback (Google requires exact redirect URI)
      { path: 'auth/google/callback', method: RequestMethod.GET },
    ],
  })

  // Global exception filters (specific to general)
  app.useGlobalFilters(
    app.get(ThrottlerExceptionFilter),
    app.get(ProblemDetailsFilter),
    app.get(AllExceptionsFilter),
  )

  // Global interceptors (in execution order)
  app.useGlobalInterceptors(
    // 1. Request context (add trace headers to response)
    app.get(RequestContextInterceptor),
    app.get(CorrelationIdInterceptor),
    app.get(TraceContextInterceptor),

    // 2. Timeout control (30s)
    new TimeoutInterceptor(30_000),

    // 3. Location header (201 Created)
    new LocationHeaderInterceptor(),

    // 4. Link header (pagination links)
    new LinkHeaderInterceptor(),

    // 5. Deprecation warning
    app.get(DeprecationInterceptor),

    // 6. Response formatting (executed last)
    new TransformInterceptor(app.get(Reflector)),
  )

  // Global validation pipe
  app.useGlobalPipes(createValidationPipe())

  // Swagger docs
  await setupSwagger(app)

  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port, '0.0.0.0')

  const logger = app.get(Logger)
  const env = process.env.NODE_ENV ?? 'development'
  const nodeVersion = process.version
  const baseUrl = `http://localhost:${port}`

  const startupMessage = `
┌─────────────────────────────────────────────────────┐
│              NestJS Boilerplate Server              │
├─────────────────────────────────────────────────────┤
│  Environment:  ${env.padEnd(35)}  │
│  Port:         ${String(port).padEnd(35)}  │
│  Node:         ${nodeVersion.padEnd(35)}  │
├─────────────────────────────────────────────────────┤
│  Endpoints:                                         │
│  - App:        ${baseUrl.padEnd(35)}  │
│  - Docs:       ${`${baseUrl}/docs`.padEnd(35)}  │
│  - Swagger:    ${`${baseUrl}/swagger`.padEnd(35)}  │
│  - YAML:       ${`${baseUrl}/openapi.yaml`.padEnd(35)}  │
│  - Health:     ${`${baseUrl}/health`.padEnd(35)}  │
└─────────────────────────────────────────────────────┘`

  logger.log(startupMessage)

  // Enable graceful shutdown hooks
  app.enableShutdownHooks()

  // Handle shutdown signals
  const signals = ['SIGTERM', 'SIGINT'] as const
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.log(`Received ${signal}, starting graceful shutdown...`)

      try {
        // Close NestJS application
        await app.close()

        // Close database pool
        await closeDatabasePool()

        logger.log('Graceful shutdown completed')
        process.exit(0)
      } catch (error) {
        logger.error('Error during graceful shutdown', error)
        process.exit(1)
      }
    })
  }
}

await bootstrap()

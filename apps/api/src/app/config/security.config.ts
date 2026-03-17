import type { FastifyCorsOptions } from '@fastify/cors'

/**
 * CORS configuration
 */
export const corsConfig: FastifyCorsOptions = {
  origin:
        process.env.NODE_ENV === 'production'
          ? (process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) ?? [])
          : true,
  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // Allowed request headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Correlation-Id',
    'Traceparent',
    'Tracestate',
    'API-Version',
  ],
  // Exposed response headers (RFC standard tracing)
  exposedHeaders: [
    'X-Request-Id',
    'X-Correlation-Id',
    'Trace-Id',
    'Link',
    'Location',
    'ETag',
    'Retry-After',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Deprecation',
    'Sunset',
    'Warning',
  ],
  // Allow credentials (cookies)
  credentials: true,
  // Preflight cache time (seconds)
  maxAge: 3600,
}

/**
 * Rate limiting config to prevent API abuse
 */
export const throttlerConfig = {
  // Time window (ms)
  ttl: 60_000, // 60 seconds
  // Max requests per window
  limit: 100, // 100 requests per minute
  ignoreUserAgents: [],
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
}

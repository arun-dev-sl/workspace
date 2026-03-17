import { Logger } from '@nestjs/common'
import * as schema from '@workspace/database'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import type { DrizzleModuleOptions } from './db.port'
import type { PoolClient } from 'pg'

let poolInstance: Pool | null = null

type QueryableClient = {
  query: (...args: unknown[]) => unknown
}

type NamedQueryConfig = {
  name?: string
  text: string
}

function isNamedQueryConfig(value: unknown): value is NamedQueryConfig {
  return Boolean(
    value
    && typeof value === 'object'
    && 'text' in value
    && typeof (value as { text?: unknown }).text === 'string'
    && 'name' in value,
  )
}

function usesPoolerConnection(connectionString: string): boolean {
  try {
    return new URL(connectionString).hostname.includes('-pooler.')
  } catch {
    return connectionString.includes('-pooler.')
  }
}

function patchPreparedStatements(target: QueryableClient) {
  const originalQuery = target.query.bind(target)

  target.query = ((...args: unknown[]) => {
    const [config, ...rest] = args

    if (isNamedQueryConfig(config)) {
      return originalQuery({
        ...config,
        name: undefined,
      }, ...rest)
    }

    return originalQuery(...args)
  }) as QueryableClient['query']
}

function getClientProcessId(client: PoolClient): number | null {
  return 'processID' in client && typeof client.processID === 'number'
    ? client.processID
    : null
}

/**
 * Create Drizzle database instance (singleton)
 *
 * Uses node-postgres connection pool for connection management
 * Provides relational query support using v1 relations syntax
 *
 * @returns Drizzle instance with singleton pool
 */
export function createDrizzleInstance(options: DrizzleModuleOptions) {
  const logger = new Logger('DatabasePool')
  const isPoolerConnection = usesPoolerConnection(options.connectionString)

  // Return existing pool if already created (singleton pattern)
  if (poolInstance) {
    logger.debug('Reusing existing database pool instance')
    return drizzle({ client: poolInstance, schema })
  }

  logger.log('Creating new database pool instance')

  poolInstance = new Pool({
    connectionString: options.connectionString,
    max: options.pool?.max ?? 10,
    min: options.pool?.min ?? 2,
    idleTimeoutMillis: options.pool?.idleTimeoutMillis ?? 30_000,
    connectionTimeoutMillis: options.pool?.connectionTimeoutMillis ?? 5000,
  })

  if (isPoolerConnection) {
    logger.warn(
      'Detected a pooled Postgres endpoint. Disabling named prepared statements for pg compatibility.',
    )
    patchPreparedStatements(poolInstance)
  }

  // Handle pool errors to prevent unhandled error events from crashing the app
  // This is critical for serverless databases like NeonDB that close idle connections
  poolInstance.on('error', (error, client) => {
    logger.error('Unexpected database pool error', {
      error: error.message,
      stack: error.stack,
      clientId: client ? getClientProcessId(client) : null,
    })
    // Don't throw - let the pool handle reconnection
  })

  // Log pool events for monitoring
  poolInstance.on('connect', (client) => {
    if (isPoolerConnection) {
      patchPreparedStatements(client)
    }

    logger.debug(
      `Database client connected (processID: ${getClientProcessId(client) ?? 'unknown'})`,
    )
  })

  poolInstance.on('remove', (client) => {
    logger.debug(
      `Database client removed (processID: ${getClientProcessId(client) ?? 'unknown'})`,
    )
  })

  return drizzle({ client: poolInstance, schema })
}

/**
 * Get the singleton pool instance for graceful shutdown
 * @returns Pool instance or null if not initialized
 */
export function getPoolInstance(): Pool | null {
  return poolInstance
}

/**
 * Gracefully close the database pool
 * Should be called during application shutdown
 */
export async function closeDatabasePool(): Promise<void> {
  const logger = new Logger('DatabasePool')

  if (poolInstance) {
    logger.log('Closing database pool...')
    await poolInstance.end()
    poolInstance = null
    logger.log('Database pool closed successfully')
  }
}

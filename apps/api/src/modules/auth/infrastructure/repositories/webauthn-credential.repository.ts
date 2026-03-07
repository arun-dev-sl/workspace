import { Inject, Injectable } from '@nestjs/common'
import { webauthnCredentialsTable } from '@workspace/database'
import { eq } from 'drizzle-orm'

import { WebauthnCredentialDto } from '@/modules/auth/application/dtos/webauthn-credential.dto'
import { WEBAUTHN_CREDENTIAL_REPOSITORY } from '@/modules/auth/application/ports/webauthn-credential.repository.port'
import { DB_TOKEN } from '@/shared/infrastructure/db/db.port'

import type { WebauthnCredentialRepository } from '@/modules/auth/application/ports/webauthn-credential.repository.port'
import type { DrizzleDb } from '@/shared/infrastructure/db/db.port'

/**
 * Drizzle WebAuthn Credential repository
 */
@Injectable()
export class WebauthnCredentialRepositoryImpl implements WebauthnCredentialRepository {
  constructor(
    @Inject(DB_TOKEN)
    private readonly db: DrizzleDb,
  ) {}

  async save(credential: WebauthnCredentialDto): Promise<void> {
    const existing = await this.findByCredentialId(credential.credentialId)
    const data = {
      id: credential.id,
      userId: credential.userId,
      credentialId: credential.credentialId,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports,
      deviceType: credential.deviceType,
      backedUp: credential.backedUp,
      aaguid: credential.aaguid,
      updatedAt: credential.updatedAt,
    }

    if (existing) {
      await this.db
        .update(webauthnCredentialsTable)
        .set(data)
        .where(eq(webauthnCredentialsTable.id, existing.id))
    } else {
      await this.db.insert(webauthnCredentialsTable).values({
        ...data,
        createdAt: credential.createdAt,
      })
    }
  }

  async findByUserId(userId: string): Promise<WebauthnCredentialDto[]> {
    const results = await this.db
      .select()
      .from(webauthnCredentialsTable)
      .where(eq(webauthnCredentialsTable.userId, userId))

    return results.map((record) => this.toDto(record))
  }

  async findByCredentialId(credentialId: string): Promise<WebauthnCredentialDto | null> {
    const results = await this.db
      .select()
      .from(webauthnCredentialsTable)
      .where(eq(webauthnCredentialsTable.credentialId, credentialId))
      .limit(1)

    if (results.length === 0) {
      return null
    }

    return this.toDto(results[0]!)
  }

  async updateCounter(id: string, counter: number): Promise<void> {
    await this.db
      .update(webauthnCredentialsTable)
      .set({ counter, updatedAt: new Date() })
      .where(eq(webauthnCredentialsTable.id, id))
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.db
      .delete(webauthnCredentialsTable)
      .where(eq(webauthnCredentialsTable.userId, userId))

    return result.rowCount ?? 0
  }

  private toDto(record: typeof webauthnCredentialsTable.$inferSelect): WebauthnCredentialDto {
    return new WebauthnCredentialDto({
      id: record.id,
      userId: record.userId,
      credentialId: record.credentialId,
      publicKey: record.publicKey,
      counter: Number(record.counter ?? 0),
      transports: record.transports,
      deviceType: (record.deviceType as WebauthnCredentialDto['deviceType']) ?? null,
      backedUp: record.backedUp ?? false,
      aaguid: record.aaguid ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })
  }
}

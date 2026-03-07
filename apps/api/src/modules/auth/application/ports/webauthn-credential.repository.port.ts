import type { WebauthnCredentialDto } from '@/modules/auth/application/dtos/webauthn-credential.dto'

/**
 * WebAuthn Credential Repository token
 */
export const WEBAUTHN_CREDENTIAL_REPOSITORY = Symbol('WEBAUTHN_CREDENTIAL_REPOSITORY')

/**
 * WebAuthn Credential Repository interface
 */
export interface WebauthnCredentialRepository {
  /**
   * Persist credential (insert or update)
   */
  save(credential: WebauthnCredentialDto): Promise<void>

  /**
   * Find credentials by user ID
   */
  findByUserId(userId: string): Promise<WebauthnCredentialDto[]>

  /**
   * Find credential by credential ID
   */
  findByCredentialId(credentialId: string): Promise<WebauthnCredentialDto | null>

  /**
   * Update signature counter
   */
  updateCounter(id: string, counter: number): Promise<void>

  /**
   * Delete all credentials for user (cleanup)
   */
  deleteByUserId(userId: string): Promise<number>
}

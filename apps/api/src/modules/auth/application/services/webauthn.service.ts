import { randomUUID } from 'node:crypto'

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { addMinutes } from 'date-fns'

import { AuthProvider } from '@/modules/auth/application/constants/auth-provider'
import { AuthIdentityDto } from '@/modules/auth/application/dtos/auth-identity.dto'
import { WebauthnCredentialDto } from '@/modules/auth/application/dtos/webauthn-credential.dto'
import { AUTH_IDENTITY_REPOSITORY } from '@/modules/auth/application/ports/auth-identity.repository.port'
import { USER_ROLE_REPOSITORY } from '@/modules/auth/application/ports/user-role.repository.port'
import { VERIFICATION_TOKEN_REPOSITORY } from '@/modules/auth/application/ports/verification-token.repository.port'
import { WEBAUTHN_CREDENTIAL_REPOSITORY } from '@/modules/auth/application/ports/webauthn-credential.repository.port'
import { AuthService } from '@/modules/auth/application/services/auth.service'
import { USER_REPOSITORY } from '@/shared/application/ports/user.repository.port'

import type { Env } from '@/app/config/env.schema'
import type { AuthIdentityRepository } from '@/modules/auth/application/ports/auth-identity.repository.port'
import type { UserRoleRepository } from '@/modules/auth/application/ports/user-role.repository.port'
import type { VerificationTokenRepository } from '@/modules/auth/application/ports/verification-token.repository.port'
import type { WebauthnCredentialRepository } from '@/modules/auth/application/ports/webauthn-credential.repository.port'
import type { DeviceContext } from '@/modules/auth/application/services/auth.service'
import type { UserRepository } from '@/shared/application/ports/user.repository.port'
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  WebAuthnCredential,
} from '@simplewebauthn/types'

interface ChallengePayload {
  challenge: string
  email: string
  userId: string
  name?: string
}

function toWebauthnUserId(userId: string): Uint8Array {
  return new TextEncoder().encode(userId)
}

function toWebauthnTransports(
  transports: string[] | null,
): AuthenticatorTransportFuture[] | undefined {
  return transports as AuthenticatorTransportFuture[] | undefined
}

/**
 * WebAuthn service
 */
@Injectable()
export class WebauthnService {
  private readonly rpId: string
  private readonly rpName: string
  private readonly origin: string
  private readonly nodeEnv: Env['NODE_ENV']

  constructor(
    @Inject(WEBAUTHN_CREDENTIAL_REPOSITORY)
    private readonly credentialRepo: WebauthnCredentialRepository,
    @Inject(AUTH_IDENTITY_REPOSITORY)
    private readonly authIdentityRepo: AuthIdentityRepository,
    @Inject(VERIFICATION_TOKEN_REPOSITORY)
    private readonly verificationTokenRepo: VerificationTokenRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: UserRepository,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepo: UserRoleRepository,
    private readonly authService: AuthService,
    private readonly configService: ConfigService<Env, true>,
  ) {
    this.nodeEnv = this.configService.get('NODE_ENV', { infer: true })
    const fallbackOrigin = this.configService.get('WEB_APP_URL', { infer: true })
    this.origin = this.configService.get('WEBAUTHN_ORIGIN', { infer: true }) ?? fallbackOrigin
    const derivedHost = new URL(this.origin).hostname
    this.rpId = this.configService.get('WEBAUTHN_RP_ID', { infer: true }) ?? derivedHost
    this.rpName = this.configService.get('WEBAUTHN_RP_NAME', { infer: true }) ?? 'Workspace App'
  }

  /**
   * Begin passkey registration
   */
  async generateRegistrationOptions(
    email: string,
    name?: string,
  ): Promise<{ options: PublicKeyCredentialCreationOptionsJSON }> {
    const normalizedEmail = email.toLowerCase()
    const displayName = name ?? normalizedEmail.split('@')[0] ?? normalizedEmail

    const [existingIdentity, existingUser] = await Promise.all([
      this.authIdentityRepo.findByIdentifier(normalizedEmail),
      this.userRepo.findByEmail(normalizedEmail),
    ])
    const userId = existingIdentity?.userId ?? existingUser?.id ?? randomUUID()
    const existingCredentials = await this.credentialRepo.findByUserId(userId)

    const options = await generateRegistrationOptions({
      rpID: this.rpId,
      rpName: this.rpName,
      userID: toWebauthnUserId(userId),
      userName: normalizedEmail,
      userDisplayName: displayName,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: existingCredentials.map((credential) => ({
        id: credential.credentialId,
        transports: toWebauthnTransports(credential.transports),
      })),
    })

    await this.verificationTokenRepo.create({
      identifier: this.challengeKey('register', normalizedEmail),
      value: JSON.stringify({
        challenge: options.challenge,
        email: normalizedEmail,
        userId,
        name: displayName,
      } satisfies ChallengePayload),
      expiresAt: addMinutes(new Date(), 10),
    })

    return { options }
  }

  /**
   * Complete passkey registration
   */
  async verifyRegistration(
    email: string,
    credential: RegistrationResponseJSON,
    deviceContext?: DeviceContext,
    requestOrigin?: string,
  ) {
    const normalizedEmail = email.toLowerCase()
    const challenge = await this.verifyChallenge('register', normalizedEmail)

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: this.resolveExpectedOrigin(requestOrigin),
      expectedRPID: this.rpId,
      requireUserVerification: true,
    })

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException('Invalid passkey response')
    }

    const registrationInfo = verification.registrationInfo
    const userId = challenge.userId
    const name = challenge.name ?? normalizedEmail

    const existingUser = await this.userRepo.findById(userId)

    if (!existingUser) {
      await this.userRepo.create({
        id: userId,
        email: normalizedEmail,
        name,
        role: 'USER',
      })
    }

    const webauthnIdentity = await this.authIdentityRepo.findByProviderAndIdentifier(
      AuthProvider.WEBAUTHN,
      normalizedEmail,
    )

    if (!webauthnIdentity) {
      const now = new Date()
      await this.authIdentityRepo.save(
        new AuthIdentityDto({
          id: randomUUID(),
          userId,
          providerId: AuthProvider.WEBAUTHN,
          accountId: normalizedEmail,
          password: null,
          accessToken: null,
          refreshToken: null,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          scope: null,
          createdAt: now,
          updatedAt: now,
        }),
      )
    }

    await this.credentialRepo.save(
      new WebauthnCredentialDto({
        id: randomUUID(),
        userId,
        credentialId: registrationInfo.credential.id,
        publicKey: isoBase64URL.fromBuffer(registrationInfo.credential.publicKey),
        counter: registrationInfo.credential.counter,
        transports: credential.response.transports ?? null,
        deviceType: registrationInfo.credentialDeviceType,
        backedUp: registrationInfo.credentialBackedUp,
        aaguid: registrationInfo.aaguid ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    )

    await this.verificationTokenRepo.deleteByIdentifier(
      this.challengeKey('register', normalizedEmail),
    )

    const role = await this.userRoleRepo.getRole(userId)
    return this.authService.issueTokens(userId, normalizedEmail, role, deviceContext)
  }

  /**
   * Begin passkey authentication
   */
  async generateAuthenticationOptions(
    email: string,
  ): Promise<{ options: PublicKeyCredentialRequestOptionsJSON }> {
    const normalizedEmail = email.toLowerCase()
    const webauthnIdentity = await this.authIdentityRepo.findByProviderAndIdentifier(
      AuthProvider.WEBAUTHN,
      normalizedEmail,
    )
    const user = webauthnIdentity
      ? null
      : await this.userRepo.findByEmail(normalizedEmail)
    const userId = webauthnIdentity?.userId ?? user?.id

    if (!userId) {
      throw new UnauthorizedException('Account not found')
    }

    const credentials = await this.credentialRepo.findByUserId(userId)
    if (credentials.length === 0) {
      throw new UnauthorizedException('No passkeys registered for this user')
    }

    if (!webauthnIdentity) {
      const now = new Date()
      await this.authIdentityRepo.save(
        new AuthIdentityDto({
          id: randomUUID(),
          userId,
          providerId: AuthProvider.WEBAUTHN,
          accountId: normalizedEmail,
          password: null,
          accessToken: null,
          refreshToken: null,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          scope: null,
          createdAt: now,
          updatedAt: now,
        }),
      )
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      userVerification: 'preferred',
      allowCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
        transports: toWebauthnTransports(credential.transports),
      })),
    })

    await this.verificationTokenRepo.create({
      identifier: this.challengeKey('login', userId),
      value: JSON.stringify({
        challenge: options.challenge,
        userId,
        email: normalizedEmail,
      } satisfies ChallengePayload),
      expiresAt: addMinutes(new Date(), 10),
    })

    return { options }
  }

  /**
   * Complete passkey authentication
   */
  async verifyAuthentication(
    email: string,
    credential: AuthenticationResponseJSON,
    deviceContext?: DeviceContext,
    requestOrigin?: string,
  ) {
    const normalizedEmail = email.toLowerCase()
    const storedCredential = await this.credentialRepo.findByCredentialId(credential.id)
    if (!storedCredential) {
      throw new UnauthorizedException('Passkey not recognized')
    }

    const challenge = await this.verifyChallenge('login', storedCredential.userId)

    const authenticator: WebAuthnCredential = {
      id: storedCredential.credentialId,
      publicKey: isoBase64URL.toBuffer(storedCredential.publicKey),
      counter: storedCredential.counter,
      transports: toWebauthnTransports(storedCredential.transports),
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: this.resolveExpectedOrigin(requestOrigin),
      expectedRPID: this.rpId,
      requireUserVerification: true,
      credential: authenticator,
    })

    if (!verification.verified || !verification.authenticationInfo) {
      throw new UnauthorizedException('Invalid passkey response')
    }

    await this.credentialRepo.updateCounter(
      storedCredential.id,
      verification.authenticationInfo.newCounter,
    )

    await this.verificationTokenRepo.deleteByIdentifier(
      this.challengeKey('login', storedCredential.userId),
    )

    const user = await this.userRepo.findById(storedCredential.userId)
    const emailToUse = user?.email ?? challenge.email ?? normalizedEmail
    const role = await this.userRoleRepo.getRole(storedCredential.userId)

    return this.authService.issueTokens(storedCredential.userId, emailToUse, role, deviceContext)
  }

  private challengeKey(type: 'register' | 'login', key: string): string {
    return `webauthn:${type}:${key}`
  }

  private resolveExpectedOrigin(requestOrigin?: string): string | string[] {
    if (!requestOrigin || requestOrigin === this.origin) {
      return this.origin
    }

    if (!this.isAllowedDevelopmentOrigin(requestOrigin)) {
      return this.origin
    }

    return [this.origin, requestOrigin]
  }

  private isAllowedDevelopmentOrigin(requestOrigin: string): boolean {
    if (this.nodeEnv === 'production') {
      return false
    }

    try {
      const configuredOrigin = new URL(this.origin)
      const runtimeOrigin = new URL(requestOrigin)
      const localHosts = new Set(['localhost', '127.0.0.1'])

      return (
        configuredOrigin.protocol === runtimeOrigin.protocol
        && configuredOrigin.hostname === runtimeOrigin.hostname
        && localHosts.has(configuredOrigin.hostname)
        && runtimeOrigin.hostname === this.rpId
      )
    } catch {
      return false
    }
  }

  private async verifyChallenge(type: 'register' | 'login', key: string): Promise<ChallengePayload> {
    const token = await this.verificationTokenRepo.findByIdentifier(this.challengeKey(type, key))
    if (!token || token.expiresAt <= new Date()) {
      throw new UnauthorizedException('Passkey challenge expired')
    }

    const payload = JSON.parse(token.value) as ChallengePayload
    return payload
  }
}

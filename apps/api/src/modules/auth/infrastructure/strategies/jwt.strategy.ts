import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

import { AUTH_SESSION_REPOSITORY } from '@/modules/auth/application/ports/auth-session.repository.port'

import type { Env } from '@/app/config/env.schema'
import type { AuthSessionRepository } from '@/modules/auth/application/ports/auth-session.repository.port'
import type { RoleType } from '@/shared/application/constants/role'

/**
 * JWT payload
 */
export interface JwtPayload {
  sub: string // User ID
  email: string
  roles: RoleType[]
  sessionId: string // Session ID
}

/**
 * JWT Strategy
 *
 * Validates JWT Token and extracts user information.
 * Verifies the session still exists in the DB to support immediate revocation.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<Env, true>,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepository: AuthSessionRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET', { infer: true }),
    })
  }

  async validate(payload: JwtPayload) {
    const session = await this.sessionRepository.findById(payload.sessionId)

    if (!session || !session.isValid) {
      throw new UnauthorizedException('Session has been revoked')
    }

    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      sessionId: payload.sessionId,
    }
  }
}

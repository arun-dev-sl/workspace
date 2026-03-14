import { Body, Controller, Get, HttpCode, Post, Request, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

import { WebauthnService } from '@/modules/auth/application/services/webauthn.service'
import {
  AccountWebauthnCredentialsResponseDto,
  AccountWebauthnRegistrationOptionsResponseDto,
  AccountWebauthnRegistrationVerifyDto,
} from '@/modules/auth/presentation/dtos/account-webauthn.dto.js'
import { JwtAuthGuard } from '@/modules/auth/presentation/guards/jwt-auth.guard'

import type { DeviceContext } from '@/modules/auth/application/services/auth.service'
import type { FastifyRequest } from 'fastify'

@ApiTags('auth')
@Controller('auth/account/passkeys')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountWebauthnController {
  constructor(private readonly webauthnService: WebauthnService) {}

  @Get()
  @ApiOperation({ summary: 'List passkeys for the current account' })
  @ApiResponse({ status: 200, type: AccountWebauthnCredentialsResponseDto })
  async listCredentials(
    @Request() req: FastifyRequest & { user: { id: string } },
  ): Promise<AccountWebauthnCredentialsResponseDto> {
    return this.webauthnService.listCredentials(req.user.id)
  }

  @Post('register/options')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generate passkey registration options for the current account' })
  @ApiResponse({ status: 200, type: AccountWebauthnRegistrationOptionsResponseDto })
  async generateRegistrationOptions(
    @Request() req: FastifyRequest & { user: { id: string, email: string } },
  ): Promise<AccountWebauthnRegistrationOptionsResponseDto> {
    return this.webauthnService.generateRegistrationOptionsForUser(req.user.id, req.user.email)
  }

  @Post('register/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify passkey registration for the current account' })
  @ApiResponse({ status: 200, type: AccountWebauthnCredentialsResponseDto })
  async verifyRegistration(
    @Body() dto: AccountWebauthnRegistrationVerifyDto,
    @Request() req: FastifyRequest & { user: { id: string, email: string } },
  ): Promise<AccountWebauthnCredentialsResponseDto> {
    const deviceContext = this.getDeviceContext(req)
    return this.webauthnService.verifyRegistrationForUser(
      req.user.id,
      req.user.email,
      dto.credential,
      deviceContext,
      typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
    )
  }

  private getDeviceContext(req: FastifyRequest): DeviceContext {
    return {
      ipAddress: req.ip,
      userAgent: typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined,
    }
  }
}

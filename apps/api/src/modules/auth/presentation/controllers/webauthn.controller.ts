import { Body, Controller, Post, Request } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

import { WebauthnService } from '@/modules/auth/application/services/webauthn.service'
import { LoginResponseDto } from '@/modules/auth/presentation/dtos/login.dto'
import {
  WebauthnLoginOptionsDto,
  WebauthnLoginOptionsResponseDto,
  WebauthnLoginVerifyDto,
  WebauthnRegistrationOptionsDto,
  WebauthnRegistrationOptionsResponseDto,
  WebauthnRegistrationVerifyDto,
} from '@/modules/auth/presentation/dtos/webauthn.dto'

import type { FastifyRequest } from 'fastify'
import type { DeviceContext } from '@/modules/auth/application/services/auth.service'

@ApiTags('auth')
@Controller('auth/webauthn')
export class WebauthnController {
  constructor(private readonly webauthnService: WebauthnService) {}

  @Post('register/options')
  @ApiOperation({ summary: 'Generate WebAuthn registration options' })
  @ApiResponse({ status: 200, type: WebauthnRegistrationOptionsResponseDto })
  async generateRegistrationOptions(
    @Body() dto: WebauthnRegistrationOptionsDto,
  ): Promise<WebauthnRegistrationOptionsResponseDto> {
    return this.webauthnService.generateRegistrationOptions(dto.email, dto.name)
  }

  @Post('register/verify')
  @ApiOperation({ summary: 'Verify WebAuthn registration response' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  async verifyRegistration(
    @Body() dto: WebauthnRegistrationVerifyDto,
    @Request() req: FastifyRequest,
  ): Promise<LoginResponseDto> {
    const deviceContext = this.getDeviceContext(req)
    return this.webauthnService.verifyRegistration(dto.email, dto.credential, deviceContext)
  }

  @Post('login/options')
  @ApiOperation({ summary: 'Generate WebAuthn authentication options' })
  @ApiResponse({ status: 200, type: WebauthnLoginOptionsResponseDto })
  async generateAuthenticationOptions(
    @Body() dto: WebauthnLoginOptionsDto,
  ): Promise<WebauthnLoginOptionsResponseDto> {
    return this.webauthnService.generateAuthenticationOptions(dto.email)
  }

  @Post('login/verify')
  @ApiOperation({ summary: 'Verify WebAuthn authentication response' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  async verifyAuthentication(
    @Body() dto: WebauthnLoginVerifyDto,
    @Request() req: FastifyRequest,
  ): Promise<LoginResponseDto> {
    const deviceContext = this.getDeviceContext(req)
    return this.webauthnService.verifyAuthentication(dto.email, dto.credential, deviceContext)
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

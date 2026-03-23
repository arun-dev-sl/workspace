import { ApiProperty } from '@nestjs/swagger'
import { IsObject } from 'class-validator'

import type { CredentialDeviceType, PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON  } from '@simplewebauthn/types'

export class AccountWebauthnRegistrationOptionsResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  options: PublicKeyCredentialCreationOptionsJSON
}

export class AccountWebauthnRegistrationVerifyDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  credential: RegistrationResponseJSON
}

export class AccountWebauthnCredentialItemDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  credentialId: string

  @ApiProperty({ type: [String], nullable: true })
  transports: string[] | null

  @ApiProperty({ nullable: true })
  deviceType: CredentialDeviceType | null

  @ApiProperty()
  backedUp: boolean

  @ApiProperty({ nullable: true })
  aaguid: string | null

  @ApiProperty()
  createdAt: Date

  @ApiProperty()
  updatedAt: Date
}

export class AccountWebauthnCredentialsResponseDto {
  @ApiProperty({ type: [AccountWebauthnCredentialItemDto] })
  credentials: AccountWebauthnCredentialItemDto[]
}

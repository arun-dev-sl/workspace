import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsEmail,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/types'

export class WebauthnRegistrationOptionsDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  name?: string
}

export class WebauthnRegistrationOptionsResponseDto {
  @ApiProperty({ type: 'object' })
  options: PublicKeyCredentialCreationOptionsJSON
}

export class WebauthnRegistrationVerifyDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({ type: 'object' })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => Object)
  credential: RegistrationResponseJSON
}

export class WebauthnLoginOptionsDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string
}

export class WebauthnLoginOptionsResponseDto {
  @ApiProperty({ type: 'object' })
  options: PublicKeyCredentialRequestOptionsJSON
}

export class WebauthnLoginVerifyDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({ type: 'object' })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => Object)
  credential: AuthenticationResponseJSON
}

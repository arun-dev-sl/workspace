import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

class HotelPricingDto {
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(16)
  currency?: string | null

  @ApiPropertyOptional({ nullable: true })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  total?: number | null

  @ApiPropertyOptional({ nullable: true })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  nightly?: number | null
}

export class CreateHotelStayDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  hotelName!: string

  @ApiPropertyOptional({ nullable: true })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @IsOptional()
  lat?: number | null

  @ApiPropertyOptional({ nullable: true })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @IsOptional()
  lng?: number | null

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  city?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  country?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  timezone?: string | null

  @ApiPropertyOptional({ example: '2026-03-11', nullable: true })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  checkInDate?: string | null

  @ApiPropertyOptional({ example: '2026-03-13', nullable: true })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  checkOutDate?: string | null

  @ApiPropertyOptional({ nullable: true })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  nights?: number | null

  @ApiPropertyOptional({ nullable: true })
  @IsUUID()
  @IsOptional()
  sourceEmailId?: string | null

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: false,
    properties: {
      currency: { type: 'string', nullable: true },
      total: { type: 'number', nullable: true },
      nightly: { type: 'number', nullable: true },
    },
  })
  @IsObject()
  @ValidateNested()
  @Type(() => HotelPricingDto)
  @IsOptional()
  pricing?: HotelPricingDto
}

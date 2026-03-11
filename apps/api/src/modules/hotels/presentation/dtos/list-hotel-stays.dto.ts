import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBooleanString, IsInt, IsOptional, Max, Min } from 'class-validator'

export class ListHotelStaysDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number = 25

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBooleanString()
  includeArchived?: string
}

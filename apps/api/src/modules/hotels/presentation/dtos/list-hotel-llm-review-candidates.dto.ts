import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator'

export class ListHotelLlmReviewCandidatesDto {
  @ApiPropertyOptional({ pattern: String.raw`^\d{4}-\d{2}-\d{2}$` })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string

  @ApiPropertyOptional({ pattern: String.raw`^\d{4}-\d{2}-\d{2}$` })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

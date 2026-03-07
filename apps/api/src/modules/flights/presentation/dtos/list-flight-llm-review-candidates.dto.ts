import { Type } from 'class-transformer'
import { IsOptional, Matches, Max, Min } from 'class-validator'

export class ListFlightLlmReviewCandidatesDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate!: string

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number
}

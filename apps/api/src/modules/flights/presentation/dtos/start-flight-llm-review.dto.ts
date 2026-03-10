import { Matches } from 'class-validator'

export class StartFlightLlmReviewDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate!: string
}

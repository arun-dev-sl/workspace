import { IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class SyncFlightsDto {
  @IsString()
  @IsOptional()
  @MaxLength(512)
  query?: string

  @IsString()
  @IsOptional()
  @MaxLength(512)
  after?: string

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string
}

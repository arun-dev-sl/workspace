import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class UpdateFlightActivityDto {
  @ApiPropertyOptional({ description: 'Corrected booking reference / PNR', nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(32)
  pnr?: string | null

  @ApiPropertyOptional({ description: 'Corrected airline name', nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  airlineName?: string | null

  @ApiPropertyOptional({ description: 'Corrected flight number' })
  @IsString()
  @IsOptional()
  @MaxLength(12)
  flightNumber?: string

  @ApiPropertyOptional({ description: 'Corrected IATA origin airport code' })
  @IsString()
  @IsOptional()
  @MaxLength(8)
  fromAirport?: string

  @ApiPropertyOptional({ description: 'Corrected IATA destination airport code' })
  @IsString()
  @IsOptional()
  @MaxLength(8)
  toAirport?: string

  @ApiPropertyOptional({ description: 'Departure date', example: '2025-10-20' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  departureDate?: string

  @ApiPropertyOptional({ description: 'Departure time', example: '08:00', nullable: true })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  @IsOptional()
  departureTime?: string | null

  @ApiPropertyOptional({ description: 'Arrival date', example: '2025-10-20', nullable: true })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  arrivalDate?: string | null

  @ApiPropertyOptional({ description: 'Arrival time', example: '10:45', nullable: true })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  @IsOptional()
  arrivalTime?: string | null

  @ApiPropertyOptional({ description: 'Absolute departure timestamp', nullable: true })
  @IsISO8601()
  @IsOptional()
  departureAt?: string | null

  @ApiPropertyOptional({ description: 'Absolute arrival timestamp', nullable: true })
  @IsISO8601()
  @IsOptional()
  arrivalAt?: string | null

  @ApiPropertyOptional({ description: 'Departure timezone / offset', nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  departureTimezone?: string | null

  @ApiPropertyOptional({ description: 'Arrival timezone / offset', nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  arrivalTimezone?: string | null

  @ApiPropertyOptional({ description: 'Travel class', nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  travelClass?: string | null
}

import { ApiProperty } from '@nestjs/swagger'
import { IsArray, ArrayMaxSize, ArrayMinSize, IsUUID } from 'class-validator'

export class ProcessHotelLlmReviewDto {
  @ApiProperty({ type: [String], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  emailIds!: string[]
}

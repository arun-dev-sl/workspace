import { Module } from '@nestjs/common'

import { AuthModule } from '@/modules/auth/auth.module'
import {
  HOTEL_EMAIL_PROCESSING_REPOSITORY,
} from '@/modules/hotels/application/ports/hotel-email-processing.repository.port'
import {
  HOTEL_LLM_EXTRACTOR,
} from '@/modules/hotels/application/ports/hotel-llm-extractor.port'
import {
  HOTEL_STAY_REPOSITORY,
} from '@/modules/hotels/application/ports/hotel-stay.repository.port'
import { HotelsService } from '@/modules/hotels/application/services/hotels.service'
import { GeminiHotelLlmExtractor } from '@/modules/hotels/infrastructure/extractors/gemini-hotel-llm.extractor'
import { HotelEmailProcessingRepositoryImpl } from '@/modules/hotels/infrastructure/repositories/hotel-email-processing.repository'
import { HotelStayRepositoryImpl } from '@/modules/hotels/infrastructure/repositories/hotel-stay.repository'
import { HotelsController } from '@/modules/hotels/presentation/controllers/hotels.controller'
import { SharedEmailSyncModule } from '@/shared/shared-email-sync.module'

@Module({
  imports: [AuthModule, SharedEmailSyncModule],
  controllers: [HotelsController],
  providers: [
    HotelsService,
    {
      provide: HOTEL_STAY_REPOSITORY,
      useClass: HotelStayRepositoryImpl,
    },
    {
      provide: HOTEL_EMAIL_PROCESSING_REPOSITORY,
      useClass: HotelEmailProcessingRepositoryImpl,
    },
    {
      provide: HOTEL_LLM_EXTRACTOR,
      useClass: GeminiHotelLlmExtractor,
    },
  ],
  exports: [HotelsService],
})
export class HotelsModule {}

import { Module } from '@nestjs/common'

import { AuthModule } from '@/modules/auth/auth.module'
import {
  FLIGHT_ACTIVITY_REPOSITORY,
} from '@/modules/flights/application/ports/flight-activity.repository.port'
import {
  FLIGHT_EMAIL_PROCESSING_REPOSITORY,
} from '@/modules/flights/application/ports/flight-email-processing.repository.port'
import {
  FLIGHT_LLM_EXTRACTOR,
} from '@/modules/flights/application/ports/flight-llm-extractor.port'
import { FlightsService } from '@/modules/flights/application/services/flights.service'
import { GeminiFlightLlmExtractor } from '@/modules/flights/infrastructure/extractors/gemini-flight-llm.extractor'
import { HeuristicFlightExtractor } from '@/modules/flights/infrastructure/extractors/heuristic-flight.extractor'
import { HybridFlightExtractor } from '@/modules/flights/infrastructure/extractors/hybrid-flight.extractor'
import { JsonLdFlightExtractor } from '@/modules/flights/infrastructure/extractors/json-ld-flight.extractor'
import { FlightActivityRepositoryImpl } from '@/modules/flights/infrastructure/repositories/flight-activity.repository'
import { FlightEmailProcessingRepositoryImpl } from '@/modules/flights/infrastructure/repositories/flight-email-processing.repository'
import { FlightsController } from '@/modules/flights/presentation/controllers/flights.controller'
import { SharedEmailSyncModule } from '@/shared/shared-email-sync.module'

@Module({
  imports: [AuthModule, SharedEmailSyncModule],
  controllers: [FlightsController],
  providers: [
    FlightsService,
    JsonLdFlightExtractor,
    HeuristicFlightExtractor,
    HybridFlightExtractor,
    {
      provide: FLIGHT_ACTIVITY_REPOSITORY,
      useClass: FlightActivityRepositoryImpl,
    },
    {
      provide: FLIGHT_EMAIL_PROCESSING_REPOSITORY,
      useClass: FlightEmailProcessingRepositoryImpl,
    },
    {
      provide: FLIGHT_LLM_EXTRACTOR,
      useClass: GeminiFlightLlmExtractor,
    },
  ],
})
export class FlightsModule {}

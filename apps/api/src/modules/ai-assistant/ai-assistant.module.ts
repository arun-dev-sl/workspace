import { Module } from '@nestjs/common'

import { AI_CHAT_PROVIDER } from '@/modules/ai-assistant/application/ports/ai-chat-provider.port'
import { AI_CONVERSATION_REPOSITORY } from '@/modules/ai-assistant/application/ports/ai-conversation.repository.port'
import { AiAnalyticsDslService } from '@/modules/ai-assistant/application/services/ai-analytics-dsl.service'
import { AiAssistantService } from '@/modules/ai-assistant/application/services/ai-assistant.service'
import { AiDomainIntelligenceService } from '@/modules/ai-assistant/application/services/ai-domain-intelligence.service'
import { AiToolRegistryService } from '@/modules/ai-assistant/application/services/ai-tool-registry.service'
import { AiConversationRepositoryImpl } from '@/modules/ai-assistant/infrastructure/ai-conversation.repository'
import { OpenWireChatProvider } from '@/modules/ai-assistant/infrastructure/open-wire-chat.provider'
import { AiAssistantController } from '@/modules/ai-assistant/presentation/controllers/ai-assistant.controller'
import { AuthModule } from '@/modules/auth/auth.module'
import { DividendsModule } from '@/modules/dividends/dividends.module'
import { ExpensesModule } from '@/modules/expenses/expenses.module'
import { FlightsModule } from '@/modules/flights/flights.module'
import { HoldingsModule } from '@/modules/holdings/holdings.module'
import { HotelsModule } from '@/modules/hotels/hotels.module'
import { PrincipalModule } from '@/modules/principal/principal.module'

@Module({
  imports: [AuthModule, ExpensesModule, HoldingsModule, DividendsModule, PrincipalModule, FlightsModule, HotelsModule],
  controllers: [AiAssistantController],
  providers: [
    AiAssistantService,
    AiDomainIntelligenceService,
    AiAnalyticsDslService,
    AiToolRegistryService,
    OpenWireChatProvider,
    AiConversationRepositoryImpl,
    {
      provide: AI_CHAT_PROVIDER,
      useExisting: OpenWireChatProvider,
    },
    {
      provide: AI_CONVERSATION_REPOSITORY,
      useExisting: AiConversationRepositoryImpl,
    },
  ],
})
export class AiAssistantModule {}

import type { AiAssistantPageContext } from '@/features/ai-assistant/api/assistant'
import type { FlightAnalytics } from '@workspace/domain'

type FlightsPageContextInput = {
  activeTab: string
  totalStored: number
  loaded: number
  manual: number
  analytics?: FlightAnalytics
}

export function buildFlightsPageContext(
  input: FlightsPageContextInput,
): AiAssistantPageContext {
  return {
    pageId: 'flights-overview',
    title: 'Travel Dashboard',
    route: '/flights',
    description:
      'Travel dashboard spanning captured flights, analytics, route map, and travel operations workflows.',
    filters: {
      activeTab: input.activeTab,
    },
    dataSnapshot: {
      visibleWidgets: ['stored-segments', 'manual-overrides', 'next-departure', 'analytics', 'map'],
      summary: {
        totalStored: input.totalStored,
        loaded: input.loaded,
        manual: input.manual,
        totalFlights: input.analytics?.overview.totalFlights ?? 0,
        totalDistanceKm: input.analytics?.overview.totalDistanceKm ?? 0,
        countriesVisited: input.analytics?.overview.countriesVisited ?? 0,
        favoriteAirline: input.analytics?.insights.favoriteAirline ?? null,
        mostFrequentRoute: input.analytics?.insights.mostFrequentRoute ?? null,
      },
    },
  }
}
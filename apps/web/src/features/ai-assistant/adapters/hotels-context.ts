import type { AiAssistantPageContext } from '@/features/ai-assistant/api/assistant'
import type { HotelStay } from '@workspace/domain'

type HotelsPageContextInput = {
  showArchived: boolean
  totalStored: number
  manual: number
  geocoded: number
  filteredCount: number
  upcomingStay: HotelStay | undefined
}

export function buildHotelsPageContext(
  input: HotelsPageContextInput,
): AiAssistantPageContext {
  return {
    pageId: 'hotels-overview',
    title: 'Hotel Stays',
    route: '/hotels',
    description:
      'Hotel stay workspace for reviewing reservations, correcting extracted details, and analyzing location coverage.',
    filters: {
      showArchived: input.showArchived,
    },
    dataSnapshot: {
      visibleWidgets: ['stored-stays', 'manual-overrides', 'mapped-coordinates', 'next-stay', 'captured-stays'],
      summary: {
        totalStored: input.totalStored,
        filteredCount: input.filteredCount,
        manual: input.manual,
        geocoded: input.geocoded,
        upcomingStay: input.upcomingStay
          ? {
              hotelName: input.upcomingStay.hotelName,
              city: input.upcomingStay.city,
              country: input.upcomingStay.country,
              checkInDate: input.upcomingStay.checkInDate,
              checkOutDate: input.upcomingStay.checkOutDate,
            }
          : null,
      },
    },
  }
}
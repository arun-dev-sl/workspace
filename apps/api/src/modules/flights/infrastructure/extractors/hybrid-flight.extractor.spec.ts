import { describe, expect, it, vi } from 'vitest'

import { HeuristicFlightExtractor } from '@/modules/flights/infrastructure/extractors/heuristic-flight.extractor'
import { HybridFlightExtractor } from '@/modules/flights/infrastructure/extractors/hybrid-flight.extractor'
import { JsonLdFlightExtractor } from '@/modules/flights/infrastructure/extractors/json-ld-flight.extractor'

import type { FlightLlmExtractor } from '@/modules/flights/application/ports/flight-llm-extractor.port'
import type { RawEmail } from '@workspace/domain'

const baseEmail: RawEmail = {
  id: 'email-1',
  userId: 'user-1',
  provider: 'gmail',
  providerMessageId: 'provider-1',
  from: 'bookings@airline.example',
  subject: 'Your flight itinerary',
  snippet: 'Flight IX1086 from BLR to VNS',
  receivedAt: '2025-10-20T08:00:00.000Z',
  bodyText: 'Flight IX1086 from BLR to VNS on 20 Oct 2025 at 08:00.',
  bodyHtml: undefined,
  rawHeaders: {},
  category: 'flights',
}

describe('hybridFlightExtractor', () => {
  it('skips the LLM when JSON-LD already yields valid segments', async () => {
    const llmExtractor: FlightLlmExtractor = {
      extract: vi.fn().mockResolvedValue([]),
    }
    const extractor = new HybridFlightExtractor(
      new JsonLdFlightExtractor(),
      new HeuristicFlightExtractor(),
      llmExtractor,
    )

    const emailWithJsonLd: RawEmail = {
      ...baseEmail,
      bodyText: '',
      bodyHtml: `
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "FlightReservation",
            "reservationNumber": "H5LTYZ",
            "reservationFor": {
              "@type": "Flight",
              "flightNumber": "IX1086",
              "departureAirport": { "@type": "Airport", "iataCode": "BLR" },
              "arrivalAirport": { "@type": "Airport", "iataCode": "VNS" },
              "departureTime": "2025-10-20T08:00:00+05:30",
              "arrivalTime": "2025-10-20T10:45:00+05:30"
            }
          }
        </script>
      `,
    }

    const result = await extractor.extract(emailWithJsonLd, {
      maxInputChars: 12_000,
      allowLlm: true,
    })

    expect(result.extractionMethod).toBe('json_ld')
    expect(result.attemptedMethods).toEqual(['json_ld'])
    expect(result.segments).toHaveLength(1)
    expect(llmExtractor.extract).not.toHaveBeenCalled()
  })

  it('invokes the LLM when structured and heuristic extraction fail', async () => {
    const llmExtractor: FlightLlmExtractor = {
      extract: vi.fn().mockResolvedValue([
        {
          segmentIndex: 0,
          pnr: 'H5LTYZ',
          airlineName: 'Air India Express',
          flightNumber: 'IX1086',
          fromAirport: 'BLR',
          toAirport: 'VNS',
          departureDate: '2025-10-20',
          departureTime: '08:00',
          arrivalDate: '2025-10-20',
          arrivalTime: '10:45',
        },
      ]),
    }
    const extractor = new HybridFlightExtractor(
      new JsonLdFlightExtractor(),
      new HeuristicFlightExtractor(),
      llmExtractor,
    )

    const result = await extractor.extract(
      {
        ...baseEmail,
        bodyText: 'Travel confirmation for your upcoming trip. Details attached.',
      },
      {
        maxInputChars: 12_000,
        allowLlm: true,
      },
    )

    expect(result.extractionMethod).toBe('llm')
    expect(result.attemptedMethods).toEqual(['heuristic', 'llm'])
    expect(result.llmAttempted).toBe(true)
    expect(result.segments).toHaveLength(1)
    expect(llmExtractor.extract).toHaveBeenCalledTimes(1)
  })

  it('discards LLM output with invalid airport codes', async () => {
    const llmExtractor: FlightLlmExtractor = {
      extract: vi.fn().mockResolvedValue([
        {
          segmentIndex: 0,
          flightNumber: 'IX1086',
          fromAirport: 'Bangalore',
          toAirport: 'Varanasi',
          departureDate: '2025-10-20',
        },
      ]),
    }
    const extractor = new HybridFlightExtractor(
      new JsonLdFlightExtractor(),
      new HeuristicFlightExtractor(),
      llmExtractor,
    )

    const result = await extractor.extract(
      {
        ...baseEmail,
        bodyText: 'Travel confirmation for your upcoming trip. Details attached.',
      },
      {
        maxInputChars: 12_000,
        allowLlm: true,
      },
    )

    expect(result.extractionMethod).toBe('llm')
    expect(result.attemptedMethods).toEqual(['heuristic', 'llm'])
    expect(result.segments).toHaveLength(0)
  })
})

import { describe, expect, it } from 'vitest'

import { JsonLdFlightExtractor } from '@/modules/flights/infrastructure/extractors/json-ld-flight.extractor'

describe('jsonLdFlightExtractor', () => {
  it('extracts multiple segments from nested @graph flight reservations', () => {
    const extractor = new JsonLdFlightExtractor()
    const structuredData = [
      {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'FlightReservation',
            'reservationNumber': 'H5LTYZ',
            'provider': {
              '@type': 'Organization',
              'name': 'Air India Express',
            },
            'reservationFor': [
              {
                '@type': 'Flight',
                'flightNumber': 'IX1086',
                'departureAirport': { '@type': 'Airport', 'iataCode': 'BLR' },
                'arrivalAirport': { '@type': 'Airport', 'iataCode': 'VNS' },
                'departureTime': '2025-10-20T08:00:00+05:30',
                'arrivalTime': '2025-10-20T10:45:00+05:30',
              },
              {
                '@type': 'Flight',
                'flightNumber': 'IX2040',
                'departureAirport': { '@type': 'Airport', 'iataCode': 'VNS' },
                'arrivalAirport': { '@type': 'Airport', 'iataCode': 'DEL' },
                'departureTime': '2025-10-20T12:00:00+05:30',
                'arrivalTime': '2025-10-20T13:30:00+05:30',
              },
            ],
          },
        ],
      },
    ]

    const segments = extractor.extract(structuredData, '2025-10-20T08:00:00.000Z')

    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({
      pnr: 'H5LTYZ',
      airlineName: 'Air India Express',
      flightNumber: 'IX1086',
      fromAirport: 'BLR',
      toAirport: 'VNS',
      departureDate: '2025-10-20',
      departureTime: '08:00',
    })
    expect(segments[1]).toMatchObject({
      pnr: 'H5LTYZ',
      flightNumber: 'IX2040',
      fromAirport: 'VNS',
      toAirport: 'DEL',
      departureDate: '2025-10-20',
      departureTime: '12:00',
    })
  })
})

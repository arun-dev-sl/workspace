import { describe, expect, it } from 'vitest'

import { prepareFlightEmailContent } from '@/shared/infrastructure/utils/flight-email-preprocessor.util'

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
  bodyText: '',
  bodyHtml: `
    <html>
      <head>
        <style>.hidden { display: none; }</style>
      </head>
      <body>
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
        <script>alert('ignore')</script>
        <div>Booking confirmed</div>
        <p>Flight IX1086 from BLR to VNS</p>
      </body>
    </html>
  `,
  rawHeaders: {},
  category: 'flights',
}

describe('prepareFlightEmailContent', () => {
  it('extracts JSON-LD and removes irrelevant markup from readable text', () => {
    const prepared = prepareFlightEmailContent(baseEmail, 12_000)

    expect(prepared.structuredData).toHaveLength(1)
    expect(prepared.hasFlightJsonLd).toBe(true)
    expect(prepared.normalizedText).toContain('Subject: Your flight itinerary')
    expect(prepared.normalizedText).toContain('Booking confirmed')
    expect(prepared.normalizedText).toContain('Flight IX1086 from BLR to VNS')
    expect(prepared.normalizedText).not.toContain('alert(')
    expect(prepared.truncated).toBe(false)
  })
})

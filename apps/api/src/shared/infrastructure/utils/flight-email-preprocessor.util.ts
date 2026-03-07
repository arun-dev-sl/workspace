import { load } from 'cheerio'

import { normalizeWhitespace } from '@/modules/flights/infrastructure/extractors/flight-extractor.utils'

import type { RawEmail } from '@workspace/domain'

export interface PreparedFlightEmailContent {
  normalizedText: string
  structuredData: unknown[]
  hasFlightJsonLd: boolean
  truncated: boolean
}

export function prepareFlightEmailContent(
  email: RawEmail,
  maxChars: number,
): PreparedFlightEmailContent {
  const structuredData: unknown[] = []
  let extractedText = email.bodyText || email.snippet || ''

  if (email.bodyHtml) {
    const $ = load(email.bodyHtml)

    $('script[type="application/ld+json"]').each((_, element) => {
      const content = $(element).html()?.trim()
      if (!content) {
        return
      }

      try {
        structuredData.push(JSON.parse(content))
      } catch {
        // Ignore invalid JSON-LD blocks and continue extracting text.
      }
    })

    $('head, script, style, noscript, svg, img, meta, link').remove()
    $('br').replaceWith('\n')
    $('p, div, section, article, li, tr, td, th, h1, h2, h3, h4, h5, h6').append('\n')

    extractedText = $('body').text() || $.root().text() || extractedText
  }

  const normalizedText = normalizeWhitespace([
    `Subject: ${email.subject}`,
    `From: ${email.from}`,
    `Received At: ${email.receivedAt}`,
    extractedText,
  ].filter(Boolean).join('\n'))

  const truncatedText = normalizedText.slice(0, maxChars)

  return {
    normalizedText: truncatedText,
    structuredData,
    hasFlightJsonLd: structuredData.some((entry) => containsFlightSchema(entry)),
    truncated: truncatedText.length < normalizedText.length,
  }
}

function containsFlightSchema(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsFlightSchema(item))
  }

  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  const typeValue = record['@type']
  const typeList = Array.isArray(typeValue) ? typeValue : [typeValue]
  if (
    typeList.some(
      (type) => typeof type === 'string'
        && ['FlightReservation', 'Flight'].includes(type),
    )
  ) {
    return true
  }

  return Object.values(record).some((item) => containsFlightSchema(item))
}

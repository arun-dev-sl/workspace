import { Injectable } from '@nestjs/common'

import {
  normalizeAirportCode,
  normalizeDateValue,
  normalizeFlightNumber,
  normalizeNullableText,
  normalizeTimeValue,
  normalizeTravelClass,
} from '@/modules/flights/infrastructure/extractors/flight-extractor.utils'

import type { FlightSegmentDraft } from '@/modules/flights/application/flight-extraction.schema'

const PNR_PATTERNS = [
  /\b(?:PNR|Booking Reference|Reservation Number|Record Locator)\s*[:#-]?\s*([A-Z0-9]{5,8})\b/i,
  /\b([A-Z0-9]{6})\b(?=.*\bPNR\b)/i,
] as const

const FLIGHT_NUMBER_REGEX = /\b([A-Z]{1,3}\s?\d{1,4}[A-Z]?)\b/g
const AIRPORT_PAIR_PATTERNS = [
  /\b([A-Z]{3})\s*(?:->|→|to|-|–)\s*([A-Z]{3})\b/g,
  /\bfrom\s+([A-Z]{3})\b[\s\S]{0,40}?\bto\s+([A-Z]{3})\b/gi,
  /\bdeparture\s*[:-]?\s*([A-Z]{3})\b[\s\S]{0,50}?\barrival\s*[:-]?\s*([A-Z]{3})\b/gi,
] as const
const DATE_REGEXES = [
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b\d{2}[/. -]\d{2}[/. -]\d{2,4}\b/g,
  /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}\b/g,
  /\b[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}\b/g,
] as const
const TIME_REGEXES = [
  /\b\d{1,2}:\d{2}\s?(?:AM|PM)?\b/gi,
  /\b\d{3,4}\s?HRS\b/gi,
] as const
const TRAVEL_CLASS_REGEX = /\b(premium economy|economy|business|first)\b/i

@Injectable()
export class HeuristicFlightExtractor {
  extract(text: string, referenceDate?: string): FlightSegmentDraft[] {
    const pnr = this.extractPnr(text)
    const airlineName = this.extractAirlineName(text)
    const travelClass = this.extractTravelClass(text)
    const flightNumbers = this.extractFlightNumbers(text)
    const globalAirportPairs = this.extractAirportPairs(text)
    const globalDates = this.extractDates(text, referenceDate)
    const globalTimes = this.extractTimes(text)

    return flightNumbers.map((flightNumber, index) => {
      const context = this.extractContextForFlight(text, flightNumber, index)
      const localAirportPairs = this.extractAirportPairs(context)
      const localDates = this.extractDates(context, referenceDate)
      const localTimes = this.extractTimes(context)
      const airportPair = localAirportPairs[0] ?? globalAirportPairs[index] ?? globalAirportPairs[0]
      const departureDate = localDates[0] ?? globalDates[index] ?? globalDates[0] ?? null
      const arrivalDate = localDates[1] ?? departureDate
      const departureTime = localTimes[0] ?? globalTimes[index * 2] ?? globalTimes[0] ?? null
      const arrivalTime = localTimes[1] ?? globalTimes[index * 2 + 1] ?? null

      return {
        segmentIndex: index,
        pnr,
        airlineName,
        flightNumber,
        fromAirport: airportPair?.from ?? null,
        toAirport: airportPair?.to ?? null,
        departureDate,
        departureTime,
        arrivalDate,
        arrivalTime,
        departureAt: null,
        arrivalAt: null,
        departureTimezone: null,
        arrivalTimezone: null,
        travelClass,
      } satisfies FlightSegmentDraft
    })
  }

  private extractPnr(text: string): string | null {
    for (const pattern of PNR_PATTERNS) {
      const match = text.match(pattern)
      if (match?.[1]) {
        return match[1].toUpperCase()
      }
    }

    return null
  }

  private extractAirlineName(text: string): string | null {
    const match = /\b(?:airline|carrier)\s*[:-]?\s*([A-Za-z0-9 &.-]{2,50})/i.exec(text)
    if (match?.[1]) {
      return normalizeNullableText(match[1])
    }

    const fromMatch = /From:\s*.*?@([A-Za-z0-9.-]+)/i.exec(text)
    if (!fromMatch?.[1]) {
      return null
    }

    const normalizedDomain = fromMatch[1]
      .split('.')
      .slice(0, -1)
      .join(' ')

    return normalizeNullableText(normalizedDomain)
  }

  private extractTravelClass(text: string): string | null {
    const match = TRAVEL_CLASS_REGEX.exec(text)
    return normalizeTravelClass(match?.[1] ?? null)
  }

  private extractFlightNumbers(text: string): string[] {
    const matches = [...text.matchAll(FLIGHT_NUMBER_REGEX)]
      .map((match) => normalizeFlightNumber(match[1]))
      .filter((value): value is string => value !== null)

    return [...new Set(matches)]
  }

  private extractAirportPairs(text: string): { from: string, to: string }[] {
    const pairs: { from: string, to: string }[] = []

    for (const pattern of AIRPORT_PAIR_PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        const from = normalizeAirportCode(match[1])
        const to = normalizeAirportCode(match[2])
        if (from && to) {
          pairs.push({ from, to })
        }
      }
    }

    return pairs
  }

  private extractDates(text: string, referenceDate?: string): string[] {
    const dates: string[] = []

    for (const regex of DATE_REGEXES) {
      for (const match of text.matchAll(regex)) {
        const normalized = normalizeDateValue(match[0], referenceDate)
        if (normalized && !dates.includes(normalized)) {
          dates.push(normalized)
        }
      }
    }

    return dates
  }

  private extractTimes(text: string): string[] {
    const times: string[] = []

    for (const regex of TIME_REGEXES) {
      for (const match of text.matchAll(regex)) {
        const normalized = normalizeTimeValue(match[0])
        if (normalized && !times.includes(normalized)) {
          times.push(normalized)
        }
      }
    }

    return times
  }

  private extractContextForFlight(text: string, flightNumber: string, occurrenceIndex: number): string {
    let matchCount = -1
    for (const match of text.matchAll(FLIGHT_NUMBER_REGEX)) {
      const normalized = normalizeFlightNumber(match[1])
      if (normalized !== flightNumber) {
        continue
      }

      matchCount += 1
      if (matchCount !== occurrenceIndex && occurrenceIndex !== 0) {
        continue
      }

      const startIndex = Math.max(0, (match.index ?? 0) - 220)
      const endIndex = Math.min(text.length, (match.index ?? 0) + 220)
      return text.slice(startIndex, endIndex)
    }

    return text
  }
}

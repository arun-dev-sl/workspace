import { createHash } from 'node:crypto'

import {
  format,
  isValid,
  parse,
  parseISO,
} from 'date-fns'

import { deterministicUuidFromHash } from '@/shared/infrastructure/utils/hash.utils'

import type { FlightSegment, FlightSegmentDraft } from '@/modules/flights/application/flight-extraction.schema'

const DATE_PATTERNS = [
  'yyyy-MM-dd',
  'dd-MM-yyyy',
  'dd/MM/yyyy',
  'dd.MM.yyyy',
  'dd MMM yyyy',
  'd MMM yyyy',
  'dd MMMM yyyy',
  'd MMMM yyyy',
  'MMM d, yyyy',
  'MMMM d, yyyy',
  'dd-MM-yy',
  'dd/MM/yy',
  'dd.MM.yy',
  'dd MMM yy',
  'd MMM yy',
] as const

const TIME_PATTERNS = [
  'HH:mm',
  'H:mm',
  'HHmm',
  'H.mm',
  'HH.mm',
  'hh:mm a',
  'h:mm a',
  'hh.mm a',
  'h.mm a',
] as const

const IATA_REGEX = /^[A-Z]{3}$/

function getDateReference(referenceDate?: string): Date {
  if (referenceDate) {
    const parsedReference = parseISO(referenceDate)
    if (isValid(parsedReference)) {
      return parsedReference
    }
  }

  return parseISO('2000-01-01')
}

function getTimeReference(): Date {
  return parseISO('2000-01-01T00:00:00Z')
}

export function normalizeWhitespace(value: string): string {
  return value
    .replaceAll('\r\n', '\n')
    .replaceAll('\u00A0', ' ')
    .replaceAll(/[ \t]+/g, ' ')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizeAirportCode(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const match = /\b([A-Z]{3})\b/.exec(value.toUpperCase())
  return match?.[1] ?? null
}

export function isValidIataCode(value: string | null | undefined): value is string {
  return typeof value === 'string' && IATA_REGEX.test(value)
}

export function normalizeFlightNumber(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const normalized = value.toUpperCase().replaceAll(/\s+/g, '')
  return /^[A-Z0-9]{2,4}\d{1,4}[A-Z]?$/.test(normalized) ? normalized : null
}

export function normalizeTravelClass(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const normalized = normalizeWhitespace(value).toLowerCase()
  if (!normalized) {
    return null
  }

  return normalized
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function normalizeDateValue(
  value: string | null | undefined,
  referenceDate?: string,
): string | null {
  if (!value) {
    return null
  }

  const cleaned = normalizeWhitespace(value.replaceAll(',', ''))
  if (!cleaned) {
    return null
  }

  const isoDateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(cleaned)
  if (isoDateMatch?.[1]) {
    return isoDateMatch[1]
  }

  const isoCandidate = parseISO(cleaned)
  if (isValid(isoCandidate)) {
    return format(isoCandidate, 'yyyy-MM-dd')
  }

  const reference = getDateReference(referenceDate)

  for (const pattern of DATE_PATTERNS) {
    const parsed = parse(cleaned, pattern, reference)
    if (isValid(parsed)) {
      return format(parsed, 'yyyy-MM-dd')
    }
  }

  return null
}

export function normalizeTimeValue(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const cleaned = normalizeWhitespace(
    value
      .toUpperCase()
      .replaceAll(/\.(?=\s*(AM|PM)\b)/g, ':')
      .replaceAll(/\bHRS\b/g, '')
      .replaceAll(/\bUTC\b/g, '')
      .trim(),
  )

  const isoTimeMatch = /\b(\d{2}:\d{2})/.exec(cleaned)
  if (isoTimeMatch?.[1]) {
    return isoTimeMatch[1]
  }

  const reference = getTimeReference()

  for (const pattern of TIME_PATTERNS) {
    const parsed = parse(cleaned, pattern, reference)
    if (isValid(parsed)) {
      return format(parsed, 'HH:mm')
    }
  }

  return null
}

export function normalizeDateTimeValue(
  value: string | null | undefined,
  referenceDate?: string,
): {
  date: string | null
  time: string | null
  at: string | null
  timezone: string | null
} {
  if (!value) {
    return {
      date: null,
      time: null,
      at: null,
      timezone: null,
    }
  }

  const cleaned = normalizeWhitespace(value)
  const isoMatch = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.exec(cleaned)

  if (isoMatch) {
    const [, date, time, timezone] = isoMatch
    let at: string | null = null

    if (timezone) {
      const parsed = parseISO(cleaned)
      if (isValid(parsed)) {
        at = parsed.toISOString()
      }
    }

    return {
      date: date ?? null,
      time: time ?? null,
      at,
      timezone: timezone ?? null,
    }
  }

  return {
    date: normalizeDateValue(cleaned, referenceDate),
    time: normalizeTimeValue(cleaned),
    at: null,
    timezone: null,
  }
}

export function finalizeFlightSegment(
  draft: FlightSegmentDraft,
  fallbackIndex: number,
): FlightSegment | null {
  const flightNumber = normalizeFlightNumber(draft.flightNumber)
  const fromAirport = normalizeAirportCode(draft.fromAirport)
  const toAirport = normalizeAirportCode(draft.toAirport)
  const departureDate = normalizeDateValue(draft.departureDate)
  const departureTime = normalizeTimeValue(draft.departureTime ?? null)
  const arrivalDate = normalizeDateValue(draft.arrivalDate ?? null)
  const arrivalTime = normalizeTimeValue(draft.arrivalTime ?? null)
  const departureAt = normalizeIsoDateTime(draft.departureAt)
  const arrivalAt = normalizeIsoDateTime(draft.arrivalAt)

  if (!flightNumber || !fromAirport || !toAirport || !departureDate) {
    return null
  }

  if (!isValidIataCode(fromAirport) || !isValidIataCode(toAirport)) {
    return null
  }

  return {
    segmentIndex: draft.segmentIndex ?? fallbackIndex,
    pnr: normalizeNullableText(draft.pnr),
    airlineName: normalizeNullableText(draft.airlineName),
    flightNumber,
    fromAirport,
    toAirport,
    departureDate,
    departureTime,
    arrivalDate,
    arrivalTime,
    departureAt,
    arrivalAt,
    departureTimezone: normalizeNullableText(draft.departureTimezone),
    arrivalTimezone: normalizeNullableText(draft.arrivalTimezone),
    travelClass: normalizeTravelClass(draft.travelClass),
  }
}

export function mergeSegmentDrafts(
  preferred: FlightSegmentDraft[],
  fallback: FlightSegmentDraft[],
): FlightSegmentDraft[] {
  return preferred.map((preferredSegment, index) => {
    const fallbackSegment = fallback[index]

    if (!fallbackSegment) {
      return {
        ...preferredSegment,
        segmentIndex: preferredSegment.segmentIndex ?? index,
      }
    }

    return {
      segmentIndex: preferredSegment.segmentIndex ?? fallbackSegment.segmentIndex ?? index,
      pnr: preferredSegment.pnr ?? fallbackSegment.pnr ?? null,
      airlineName: preferredSegment.airlineName ?? fallbackSegment.airlineName ?? null,
      flightNumber: preferredSegment.flightNumber ?? fallbackSegment.flightNumber ?? null,
      fromAirport: preferredSegment.fromAirport ?? fallbackSegment.fromAirport ?? null,
      toAirport: preferredSegment.toAirport ?? fallbackSegment.toAirport ?? null,
      departureDate: preferredSegment.departureDate ?? fallbackSegment.departureDate ?? null,
      departureTime: preferredSegment.departureTime ?? fallbackSegment.departureTime ?? null,
      arrivalDate: preferredSegment.arrivalDate ?? fallbackSegment.arrivalDate ?? null,
      arrivalTime: preferredSegment.arrivalTime ?? fallbackSegment.arrivalTime ?? null,
      departureAt: preferredSegment.departureAt ?? fallbackSegment.departureAt ?? null,
      arrivalAt: preferredSegment.arrivalAt ?? fallbackSegment.arrivalAt ?? null,
      departureTimezone:
        preferredSegment.departureTimezone ?? fallbackSegment.departureTimezone ?? null,
      arrivalTimezone:
        preferredSegment.arrivalTimezone ?? fallbackSegment.arrivalTimezone ?? null,
      travelClass: preferredSegment.travelClass ?? fallbackSegment.travelClass ?? null,
    }
  })
}

export function buildFlightCanonicalHash(input: {
  userId: string
  sourceEmailId: string
  segmentIndex: number
  pnr?: string | null
  flightNumber?: string | null
  fromAirport?: string | null
  toAirport?: string | null
  departureDate?: string | null
  departureTime?: string | null
}): string {
  const normalizedFlightNumber = normalizeFlightNumber(input.flightNumber)
  const normalizedFrom = normalizeAirportCode(input.fromAirport)
  const normalizedTo = normalizeAirportCode(input.toAirport)
  const normalizedDepartureDate = normalizeDateValue(input.departureDate)
  const normalizedDepartureTime = normalizeTimeValue(input.departureTime)

  const hasCoreFields = Boolean(
    normalizedFlightNumber
    && normalizedFrom
    && normalizedTo
    && normalizedDepartureDate,
  )

  const payload = hasCoreFields
    ? JSON.stringify({
        userId: input.userId,
        pnr: normalizeNullableText(input.pnr),
        flightNumber: normalizedFlightNumber,
        fromAirport: normalizedFrom,
        toAirport: normalizedTo,
        departureDate: normalizedDepartureDate,
        departureTime: normalizedDepartureTime,
      })
    : JSON.stringify({
        userId: input.userId,
        sourceEmailId: input.sourceEmailId,
        segmentIndex: input.segmentIndex,
      })

  return createHash('sha256').update(payload).digest('hex')
}

export function buildFlightActivityId(canonicalHash: string): string {
  return deterministicUuidFromHash(canonicalHash)
}

export function normalizeNullableText(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const normalized = normalizeWhitespace(value)
  return normalized || null
}

function normalizeIsoDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const parsed = parseISO(value)
  if (!isValid(parsed)) {
    return null
  }

  return parsed.toISOString()
}

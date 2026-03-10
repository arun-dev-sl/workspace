import { Injectable } from '@nestjs/common'

import {
  normalizeAirportCode,
  normalizeDateTimeValue,
  normalizeFlightNumber,
  normalizeNullableText,
  normalizeTravelClass,
} from '@/modules/flights/infrastructure/extractors/flight-extractor.utils'

import type { FlightSegmentDraft } from '@/modules/flights/application/flight-extraction.schema'

@Injectable()
export class JsonLdFlightExtractor {
  extract(structuredData: unknown[], referenceDate?: string): FlightSegmentDraft[] {
    const reservations = this.collectTypedNodes(structuredData, 'FlightReservation')
    const standaloneFlights = this.collectTypedNodes(structuredData, 'Flight')
    const segments: FlightSegmentDraft[] = []
    const seenKeys = new Set<string>()

    for (const reservation of reservations) {
      const reservationSegments = this.extractReservationSegments(
        reservation,
        referenceDate,
      )

      for (const segment of reservationSegments) {
        const key = this.buildDraftKey(segment)
        if (key && seenKeys.has(key)) {
          continue
        }
        if (key) {
          seenKeys.add(key)
        }
        segments.push({
          ...segment,
          segmentIndex: segment.segmentIndex ?? segments.length,
        })
      }
    }

    for (const flight of standaloneFlights) {
      const segment = this.mapFlightNode(flight, {}, referenceDate, segments.length)
      if (!segment) {
        continue
      }

      const key = this.buildDraftKey(segment)
      if (key && seenKeys.has(key)) {
        continue
      }
      if (key) {
        seenKeys.add(key)
      }

      segments.push(segment)
    }

    return segments
  }

  private extractReservationSegments(
    reservation: Record<string, unknown>,
    referenceDate?: string,
  ): FlightSegmentDraft[] {
    const defaults = {
      pnr: this.extractFirstString(
        reservation.reservationNumber,
        reservation.bookingReference,
        reservation.confirmationNumber,
        reservation.reservationId,
      ),
      airlineName: this.extractNestedString(reservation.provider, 'name'),
    }

    const flights = this.collectTypedNodes(reservation.reservationFor, 'Flight')
    if (flights.length === 0) {
      return []
    }

    return flights
      .map((flight, index) => this.mapFlightNode(flight, defaults, referenceDate, index))
      .filter((segment): segment is FlightSegmentDraft => segment !== null)
  }

  private mapFlightNode(
    flightNode: Record<string, unknown>,
    defaults: { pnr?: string | null, airlineName?: string | null },
    referenceDate: string | undefined,
    fallbackIndex: number,
  ): FlightSegmentDraft | null {
    const flightNumber = normalizeFlightNumber(
      this.extractFirstString(flightNode.flightNumber, flightNode.identifier),
    )
    const departure = normalizeDateTimeValue(
      this.extractFirstString(flightNode.departureTime),
      referenceDate,
    )
    const arrival = normalizeDateTimeValue(
      this.extractFirstString(flightNode.arrivalTime),
      referenceDate,
    )

    const fromAirport = this.extractAirportCode(flightNode.departureAirport)
    const toAirport = this.extractAirportCode(flightNode.arrivalAirport)

    if (!flightNumber && !fromAirport && !toAirport) {
      return null
    }

    return {
      segmentIndex: fallbackIndex,
      pnr: normalizeNullableText(defaults.pnr),
      airlineName: normalizeNullableText(
        defaults.airlineName
        ?? this.extractNestedString(flightNode.airline, 'name')
        ?? this.extractNestedString(flightNode.provider, 'name'),
      ),
      flightNumber,
      fromAirport,
      toAirport,
      departureDate: departure.date,
      departureTime: departure.time,
      arrivalDate: arrival.date,
      arrivalTime: arrival.time,
      departureAt: departure.at,
      arrivalAt: arrival.at,
      departureTimezone: departure.timezone,
      arrivalTimezone: arrival.timezone,
      travelClass: normalizeTravelClass(
        this.extractFirstString(
          flightNode.airplaneCabin,
          flightNode.bookingClass,
          this.extractNestedValue(flightNode.reservedTicket, 'ticketedSeat', 'seatSection'),
        ),
      ),
    }
  }

  private extractAirportCode(value: unknown): string | null {
    if (!value) {
      return null
    }

    if (typeof value === 'string') {
      return normalizeAirportCode(value)
    }

    if (typeof value !== 'object') {
      return null
    }

    const record = value as Record<string, unknown>
    return normalizeAirportCode(
      this.extractFirstString(
        record.iataCode,
        record.identifier,
        record.code,
        record.name,
      ),
    )
  }

  private collectTypedNodes(value: unknown, typeName: string): Record<string, unknown>[] {
    const nodes: Record<string, unknown>[] = []
    this.walkNodes(value, nodes, typeName)
    return nodes
  }

  private walkNodes(
    value: unknown,
    nodes: Record<string, unknown>[],
    typeName: string,
  ): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        this.walkNodes(item, nodes, typeName)
      }
      return
    }

    if (!value || typeof value !== 'object') {
      return
    }

    const record = value as Record<string, unknown>
    if (this.hasType(record, typeName)) {
      nodes.push(record)
    }

    if (record['@graph']) {
      this.walkNodes(record['@graph'], nodes, typeName)
    }

    for (const item of Object.values(record)) {
      this.walkNodes(item, nodes, typeName)
    }
  }

  private hasType(record: Record<string, unknown>, typeName: string): boolean {
    const rawType = record['@type']
    if (Array.isArray(rawType)) {
      return rawType.includes(typeName)
    }

    return rawType === typeName
  }

  private extractNestedString(value: unknown, ...path: string[]): string | null {
    const nested = this.extractNestedValue(value, ...path)
    return typeof nested === 'string' ? nested : null
  }

  private extractNestedValue(value: unknown, ...path: string[]): unknown {
    let current = value
    for (const key of path) {
      if (!current || typeof current !== 'object') {
        return null
      }
      current = (current as Record<string, unknown>)[key]
    }
    return current
  }

  private extractFirstString(...values: unknown[]): string | null {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }

    return null
  }

  private buildDraftKey(segment: FlightSegmentDraft): string | null {
    const flightNumber = normalizeFlightNumber(segment.flightNumber)
    const fromAirport = normalizeAirportCode(segment.fromAirport)
    const toAirport = normalizeAirportCode(segment.toAirport)
    const departureDate = segment.departureDate ?? null

    if (!flightNumber || !fromAirport || !toAirport || !departureDate) {
      return null
    }

    return `${flightNumber}:${fromAirport}:${toAirport}:${departureDate}`
  }
}

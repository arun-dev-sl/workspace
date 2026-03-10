import { Inject, Injectable } from '@nestjs/common'
import {
  differenceInMinutes,
  isValid,
  parse,
  parseISO,
} from 'date-fns'

import { FLIGHT_ACTIVITY_REPOSITORY } from '@/modules/flights/application/ports/flight-activity.repository.port'
import {
  FlightAirportCatalogService,
} from '@/modules/flights/infrastructure/services/flight-airport-catalog.service'

import type { FlightActivityRepository } from '@/modules/flights/application/ports/flight-activity.repository.port'
import type { FlightAirportMetadata } from '@/modules/flights/infrastructure/services/flight-airport-catalog.service'
import type {
  FlightActivity,
  FlightAnalytics,
  FlightAnalyticsAirlineCount,
  FlightAnalyticsAirportCount,
  FlightAnalyticsAirportFrequencyItem,
  FlightAnalyticsFlightsByYearItem,
  FlightAnalyticsLongestFlight,
  FlightAnalyticsRouteCount,
  FlightAnalyticsTimelineItem,
} from '@workspace/domain'

const EARTH_RADIUS_KM = 6371
const DATE_TIME_PATTERN = 'yyyy-MM-dd HH:mm'

interface SegmentAnalytics {
  distanceKm: number | null
  durationMinutes: number | null
  departureAirport: FlightAirportMetadata | null
  arrivalAirport: FlightAirportMetadata | null
}

@Injectable()
export class FlightAnalyticsService {
  constructor(
    @Inject(FLIGHT_ACTIVITY_REPOSITORY)
    private readonly flightActivityRepository: FlightActivityRepository,
    private readonly flightAirportCatalogService: FlightAirportCatalogService,
  ) {}

  async getAnalytics(userId: string): Promise<FlightAnalytics> {
    const flights = await this.flightActivityRepository.listAllByUser(userId)
    if (flights.length === 0) {
      return this.buildEmptyAnalytics()
    }

    const airportCounts = new Map<string, number>()
    const routeCounts = new Map<string, number>()
    const airlineCounts = new Map<string, number>()
    const yearCounts = new Map<number, number>()
    const cities = new Set<string>()
    const countries = new Set<string>()
    const timeline: FlightAnalyticsTimelineItem[] = []

    let totalDistanceKm = 0
    let totalDurationMinutes = 0
    let domesticFlights = 0
    let internationalFlights = 0
    let longestFlight: FlightAnalyticsLongestFlight | null = null

    for (const flight of flights) {
      const segment = this.analyzeSegment(flight)

      totalDistanceKm += segment.distanceKm ?? 0
      totalDurationMinutes += segment.durationMinutes ?? 0

      this.incrementCount(airportCounts, flight.fromAirport)
      this.incrementCount(airportCounts, flight.toAirport)
      this.incrementCount(routeCounts, `${flight.fromAirport}->${flight.toAirport}`)

      if (flight.airlineName?.trim()) {
        this.incrementCount(airlineCounts, flight.airlineName.trim())
      }

      const year = Number.parseInt(flight.departureDate.slice(0, 4), 10)
      if (!Number.isNaN(year)) {
        this.incrementCount(yearCounts, year)
      }

      this.collectLocation(cities, countries, segment.departureAirport)
      this.collectLocation(cities, countries, segment.arrivalAirport)

      if (
        segment.departureAirport?.country
        && segment.arrivalAirport?.country
      ) {
        if (segment.departureAirport.country === segment.arrivalAirport.country) {
          domesticFlights += 1
        } else {
          internationalFlights += 1
        }
      }

      if (segment.distanceKm !== null) {
        const roundedDistance = Math.round(segment.distanceKm)
        if (!longestFlight || roundedDistance > longestFlight.distanceKm) {
          longestFlight = {
            from: flight.fromAirport,
            to: flight.toAirport,
            distanceKm: roundedDistance,
          }
        }
      }

      timeline.push({
        date: flight.departureDate,
        fromAirport: flight.fromAirport,
        toAirport: flight.toAirport,
        airline: flight.airlineName?.trim() || 'Unknown airline',
        flightNumber: flight.flightNumber || null,
      })
    }

    const airportFrequency = this.toSortedAirportFrequency(airportCounts)
    const airlineDistribution = this.toSortedAirlineCounts(airlineCounts)
    const flightsByYear = this.toSortedYearCounts(yearCounts)
    const mostVisitedAirport: FlightAnalyticsAirportCount | null
      = airportFrequency[0]
        ? { iata: airportFrequency[0].airport, count: airportFrequency[0].count }
        : null
    const mostFrequentRoute: FlightAnalyticsRouteCount | null
      = this.toSortedRouteCounts(routeCounts)[0] ?? null
    const favoriteAirline: FlightAnalyticsAirlineCount | null = airlineDistribution[0] ?? null

    timeline.sort((left, right) => {
      const dateCompare = right.date.localeCompare(left.date)
      if (dateCompare !== 0) {
        return dateCompare
      }

      const fromCompare = left.fromAirport.localeCompare(right.fromAirport)
      if (fromCompare !== 0) {
        return fromCompare
      }

      return left.toAirport.localeCompare(right.toAirport)
    })

    return {
      overview: {
        totalFlights: flights.length,
        totalDistanceKm: Math.round(totalDistanceKm),
        countriesVisited: countries.size,
        citiesVisited: cities.size,
        totalFlightTimeHours: Number((totalDurationMinutes / 60).toFixed(1)),
      },
      insights: {
        mostVisitedAirport,
        mostFrequentRoute,
        favoriteAirline,
        longestFlight,
        domesticFlights,
        internationalFlights,
      },
      breakdowns: {
        flightsByYear,
        airlineDistribution,
        airportFrequency,
      },
      timeline,
    }
  }

  private buildEmptyAnalytics(): FlightAnalytics {
    return {
      overview: {
        totalFlights: 0,
        totalDistanceKm: 0,
        countriesVisited: 0,
        citiesVisited: 0,
        totalFlightTimeHours: 0,
      },
      insights: {
        mostVisitedAirport: null,
        mostFrequentRoute: null,
        favoriteAirline: null,
        longestFlight: null,
        domesticFlights: 0,
        internationalFlights: 0,
      },
      breakdowns: {
        flightsByYear: [],
        airlineDistribution: [],
        airportFrequency: [],
      },
      timeline: [],
    }
  }

  private analyzeSegment(flight: FlightActivity): SegmentAnalytics {
    const departureAirport = this.flightAirportCatalogService.getAirport(flight.fromAirport)
    const arrivalAirport = this.flightAirportCatalogService.getAirport(flight.toAirport)

    return {
      departureAirport,
      arrivalAirport,
      distanceKm: departureAirport && arrivalAirport
        ? this.calculateDistanceKm(departureAirport, arrivalAirport)
        : null,
      durationMinutes: this.calculateDurationMinutes(flight),
    }
  }

  private calculateDistanceKm(
    departureAirport: FlightAirportMetadata,
    arrivalAirport: FlightAirportMetadata,
  ): number {
    const deltaLat = arrivalAirport.latRad - departureAirport.latRad
    const deltaLng = arrivalAirport.lngRad - departureAirport.lngRad
    const sinLat = Math.sin(deltaLat / 2)
    const sinLng = Math.sin(deltaLng / 2)
    const a
      = sinLat * sinLat
        + Math.cos(departureAirport.latRad)
        * Math.cos(arrivalAirport.latRad)
        * sinLng
        * sinLng

    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
  }

  private calculateDurationMinutes(flight: FlightActivity): number | null {
    if (flight.departureAt && flight.arrivalAt) {
      const departureAt = parseISO(flight.departureAt)
      const arrivalAt = parseISO(flight.arrivalAt)
      if (isValid(departureAt) && isValid(arrivalAt)) {
        const diff = differenceInMinutes(arrivalAt, departureAt)
        if (diff >= 0) {
          return diff
        }
      }
    }

    if (!flight.departureTime || !flight.arrivalTime) {
      return null
    }

    const departureDateTime = parse(
      `${flight.departureDate} ${flight.departureTime}`,
      DATE_TIME_PATTERN,
      parseISO(`${flight.departureDate}T00:00:00Z`),
    )
    const arrivalDate = flight.arrivalDate ?? flight.departureDate
    const arrivalDateTime = parse(
      `${arrivalDate} ${flight.arrivalTime}`,
      DATE_TIME_PATTERN,
      parseISO(`${arrivalDate}T00:00:00Z`),
    )

    if (!isValid(departureDateTime) || !isValid(arrivalDateTime)) {
      return null
    }

    const diff = differenceInMinutes(arrivalDateTime, departureDateTime)
    return diff >= 0 ? diff : null
  }

  private collectLocation(
    cities: Set<string>,
    countries: Set<string>,
    airport: FlightAirportMetadata | null,
  ): void {
    if (!airport) {
      return
    }

    if (airport.country) {
      countries.add(airport.country)
    }

    if (airport.city) {
      cities.add(`${airport.city}|${airport.country ?? 'unknown'}`)
    }
  }

  private incrementCount<T extends string | number>(map: Map<T, number>, key: T): void {
    map.set(key, (map.get(key) ?? 0) + 1)
  }

  private toSortedYearCounts(counts: Map<number, number>): FlightAnalyticsFlightsByYearItem[] {
    return [...counts.entries()]
      .map(([year, count]) => ({ year, count }))
      .sort((left, right) => left.year - right.year)
  }

  private toSortedAirlineCounts(
    counts: Map<string, number>,
  ): FlightAnalyticsAirlineCount[] {
    return [...counts.entries()]
      .map(([airline, count]) => ({ airline, count }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count
        }

        return left.airline.localeCompare(right.airline)
      })
  }

  private toSortedAirportFrequency(
    counts: Map<string, number>,
  ): FlightAnalyticsAirportFrequencyItem[] {
    return [...counts.entries()]
      .map(([airport, count]) => ({ airport, count }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count
        }

        return left.airport.localeCompare(right.airport)
      })
  }

  private toSortedRouteCounts(counts: Map<string, number>): FlightAnalyticsRouteCount[] {
    return [...counts.entries()]
      .map(([route, count]) => {
        const [from, to] = route.split('->')
        return {
          from: from ?? '',
          to: to ?? '',
          count,
        }
      })
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count
        }

        return `${left.from}-${left.to}`.localeCompare(`${right.from}-${right.to}`)
      })
  }
}

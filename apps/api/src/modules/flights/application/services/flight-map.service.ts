import { Inject, Injectable } from '@nestjs/common'

import { FLIGHT_ACTIVITY_REPOSITORY } from '@/modules/flights/application/ports/flight-activity.repository.port'
import { FlightAirportCatalogService } from '@/modules/flights/infrastructure/services/flight-airport-catalog.service'

import type { FlightActivityRepository } from '@/modules/flights/application/ports/flight-activity.repository.port'
import type { FlightAirportMetadata } from '@/modules/flights/infrastructure/services/flight-airport-catalog.service'
import type {
  FlightMap,
  FlightMapAirport,
  FlightMapFlight,
  FlightMapPathPoint,
  FlightMapRoute,
} from '@workspace/domain'

const EARTH_RADIUS_KM = 6371
const ROUTE_SEGMENT_COUNT = 32
const RADIANS_TO_DEGREES = 180 / Math.PI

interface RouteAccumulator {
  from: string
  to: string
  fromLat: number
  fromLng: number
  toLat: number
  toLng: number
  count: number
  path: FlightMapPathPoint[]
}

@Injectable()
export class FlightMapService {
  constructor(
    @Inject(FLIGHT_ACTIVITY_REPOSITORY)
    private readonly flightActivityRepository: FlightActivityRepository,
    private readonly flightAirportCatalogService: FlightAirportCatalogService,
  ) {}

  async getMap(userId: string): Promise<FlightMap> {
    const storedFlights = await this.flightActivityRepository.listAllByUser(userId)

    const airportVisitCounts = new Map<string, number>()
    const routeCounts = new Map<string, RouteAccumulator>()
    const flights: FlightMapFlight[] = []
    const cities = new Set<string>()
    const countries = new Set<string>()
    let totalDistanceKm = 0

    for (const flight of storedFlights) {
      const departureAirport = this.flightAirportCatalogService.getAirport(flight.fromAirport)
      const arrivalAirport = this.flightAirportCatalogService.getAirport(flight.toAirport)

      if (departureAirport) {
        this.incrementCount(airportVisitCounts, departureAirport.iata)
        this.collectLocation(cities, countries, departureAirport)
      }

      if (arrivalAirport) {
        this.incrementCount(airportVisitCounts, arrivalAirport.iata)
        this.collectLocation(cities, countries, arrivalAirport)
      }

      if (!departureAirport || !arrivalAirport) {
        continue
      }

      const routeKey = `${departureAirport.iata}->${arrivalAirport.iata}`
      const existingRoute = routeCounts.get(routeKey)
      if (existingRoute) {
        existingRoute.count += 1
      } else {
        routeCounts.set(routeKey, {
          from: departureAirport.iata,
          to: arrivalAirport.iata,
          fromLat: departureAirport.lat,
          fromLng: departureAirport.lng,
          toLat: arrivalAirport.lat,
          toLng: arrivalAirport.lng,
          count: 1,
          path: this.buildGreatCirclePath(departureAirport, arrivalAirport),
        })
      }

      totalDistanceKm += this.calculateDistanceKm(departureAirport, arrivalAirport)
      flights.push({
        date: flight.departureDate,
        from: departureAirport.iata,
        to: arrivalAirport.iata,
        fromLat: departureAirport.lat,
        fromLng: departureAirport.lng,
        toLat: arrivalAirport.lat,
        toLng: arrivalAirport.lng,
        airline: flight.airlineName?.trim() || 'Unknown airline',
        flightNumber: flight.flightNumber || null,
      })
    }

    const airports = this.toSortedAirports(airportVisitCounts)
      .map((airportCount) => {
        const airport = this.flightAirportCatalogService.getAirport(airportCount.iata)
        if (!airport) {
          return null
        }

        return {
          iata: airport.iata,
          lat: airport.lat,
          lng: airport.lng,
          city: airport.city,
          country: airport.country,
          timezone: airport.timezone,
          visits: airportCount.visits,
        } satisfies FlightMapAirport
      })
      .filter((airport): airport is FlightMapAirport => airport !== null)

    const routes = [...routeCounts.values()]
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count
        }

        return `${left.from}-${left.to}`.localeCompare(`${right.from}-${right.to}`)
      })
      .map((route) => ({ ...route })) satisfies FlightMapRoute[]

    flights.sort((left, right) => {
      const dateCompare = right.date.localeCompare(left.date)
      if (dateCompare !== 0) {
        return dateCompare
      }

      const originCompare = left.from.localeCompare(right.from)
      if (originCompare !== 0) {
        return originCompare
      }

      return left.to.localeCompare(right.to)
    })

    return {
      airports,
      routes,
      flights,
      summary: {
        totalFlights: flights.length,
        totalDistanceKm: Math.round(totalDistanceKm),
        citiesVisited: cities.size,
        countriesVisited: countries.size,
      },
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
    const a = sinLat * sinLat
      + Math.cos(departureAirport.latRad)
      * Math.cos(arrivalAirport.latRad)
      * sinLng
      * sinLng

    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
  }

  private buildGreatCirclePath(
    departureAirport: FlightAirportMetadata,
    arrivalAirport: FlightAirportMetadata,
  ): FlightMapPathPoint[] {
    const from = this.toCartesian(departureAirport)
    const to = this.toCartesian(arrivalAirport)
    const dot = this.clamp(from.x * to.x + from.y * to.y + from.z * to.z, -1, 1)
    const omega = Math.acos(dot)

    if (omega < 1e-6) {
      return [
        [departureAirport.lng, departureAirport.lat],
        [arrivalAirport.lng, arrivalAirport.lat],
      ]
    }

    const sinOmega = Math.sin(omega)
    const points: FlightMapPathPoint[] = []

    for (let index = 0; index <= ROUTE_SEGMENT_COUNT; index += 1) {
      const progress = index / ROUTE_SEGMENT_COUNT
      const leftWeight = Math.sin((1 - progress) * omega) / sinOmega
      const rightWeight = Math.sin(progress * omega) / sinOmega
      const x = leftWeight * from.x + rightWeight * to.x
      const y = leftWeight * from.y + rightWeight * to.y
      const z = leftWeight * from.z + rightWeight * to.z
      const length = Math.hypot(x, y, z) || 1
      const normalizedX = x / length
      const normalizedY = y / length
      const normalizedZ = z / length
      const lat = Math.atan2(normalizedZ, Math.hypot(normalizedX, normalizedY))
      const lng = Math.atan2(normalizedY, normalizedX)

      points.push([
        this.normalizeLongitude(lng * RADIANS_TO_DEGREES),
        lat * RADIANS_TO_DEGREES,
      ])
    }

    return points
  }

  private toCartesian(airport: FlightAirportMetadata): { x: number, y: number, z: number } {
    const cosLat = Math.cos(airport.latRad)

    return {
      x: cosLat * Math.cos(airport.lngRad),
      y: cosLat * Math.sin(airport.lngRad),
      z: Math.sin(airport.latRad),
    }
  }

  private normalizeLongitude(value: number): number {
    if (value > 180) {
      return value - 360
    }

    if (value < -180) {
      return value + 360
    }

    return value
  }

  private toSortedAirports(counts: Map<string, number>): { iata: string, visits: number }[] {
    return [...counts.entries()]
      .map(([iata, visits]) => ({ iata, visits }))
      .sort((left, right) => {
        if (right.visits !== left.visits) {
          return right.visits - left.visits
        }

        return left.iata.localeCompare(right.iata)
      })
  }

  private collectLocation(
    cities: Set<string>,
    countries: Set<string>,
    airport: FlightAirportMetadata,
  ): void {
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

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
  }
}

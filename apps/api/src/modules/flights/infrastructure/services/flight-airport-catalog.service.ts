import { readFileSync } from 'node:fs'

import { Injectable } from '@nestjs/common'

interface FlightAirportRecord {
  name: string
  city: string | null
  country: string | null
  lat: number
  lng: number
  latRad?: number | null
  lngRad?: number | null
  timezone: string | null
}

export interface FlightAirportMetadata {
  iata: string
  name: string
  city: string | null
  country: string | null
  lat: number
  lng: number
  latRad: number
  lngRad: number
  timezone: string | null
}

function loadAirportCatalog(): Record<string, FlightAirportRecord> {
  const airportCatalogUrl = new URL('../config/airports.json', import.meta.url)
  const airportCatalogJson = readFileSync(airportCatalogUrl, 'utf8')

  return JSON.parse(airportCatalogJson) as Record<string, FlightAirportRecord>
}

@Injectable()
export class FlightAirportCatalogService {
  private readonly airportMap = new Map<string, FlightAirportMetadata>()

  constructor() {
    const airports = loadAirportCatalog()

    for (const [iata, airport] of Object.entries(airports)) {
      const code = iata.trim().toUpperCase()
      if (!code || !Number.isFinite(airport.lat) || !Number.isFinite(airport.lng)) {
        continue
      }

      this.airportMap.set(code, {
        iata: code,
        name: airport.name,
        city: airport.city,
        country: airport.country,
        lat: airport.lat,
        lng: airport.lng,
        latRad: airport.latRad ?? this.toRadians(airport.lat),
        lngRad: airport.lngRad ?? this.toRadians(airport.lng),
        timezone: airport.timezone,
      })
    }
  }

  getAirport(iata: string | null | undefined): FlightAirportMetadata | null {
    if (!iata) {
      return null
    }

    return this.airportMap.get(iata.trim().toUpperCase()) ?? null
  }

  private toRadians(value: number): number {
    return value * (Math.PI / 180)
  }
}

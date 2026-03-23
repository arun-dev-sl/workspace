import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  endOfDay,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
} from 'date-fns'
import maplibregl from 'maplibre-gl/dist/maplibre-gl-csp'
import maplibreglWorkerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url'
import {
  Globe2,
  MapPinned,
  Pause,
  Palette,
  Play,
  Route,
  Settings2,
  SkipBack,
  SkipForward,
  Sparkles,
} from 'lucide-react'

import { useFlightMap } from '@/features/flights/api/flights'
import { useAllHotelStays } from '@/features/hotels/api/hotels'
import {
  AIRPORT_MIN_ZOOM,
  FLIGHT_SCENE_LAYER_ID,
  FlightMap3DLayerController,
} from '@/features/flights/components/flight-map-dashboard.3d'
import {
  DEFAULT_SETTINGS,
  MAP_STYLE_OPTIONS,
  // ROUTE_COLOR_PRESETS,
  SATELLITE_LABEL_LAYER_ID,
  STORAGE_KEY,
  TERRAIN_HILLSHADE_LAYER_ID,
  buildAirportFeatureCollection,
  getBaseLabelLayerIds,
  getMapStyle,
  getOverlayAnchorId,
  loadSettings,
  sanitizeSettings,
  saveSettings,
  supportsTerrain,
  type MapSettings,
  type MapStyleName,
} from '@/features/flights/components/flight-map-dashboard.lib'
import { Badge } from '@workspace/ui/components/ui/badge'
import { Button } from '@workspace/ui/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/ui/card'
import { Label } from '@workspace/ui/components/ui/label'
import { Input } from '@workspace/ui/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@workspace/ui/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/ui/select'
import { Separator } from '@workspace/ui/components/ui/separator'
import { Skeleton } from '@workspace/ui/components/ui/skeleton'
import { Slider } from '@workspace/ui/components/ui/slider'
import { Switch } from '@workspace/ui/components/ui/switch'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@workspace/ui/components/ui/toggle-group'
import { MetricTrendCard } from '@/components/metric-trend-card'
import { normalizeRecentMonthlySeries } from '@/lib/metric-trends'

import type { FlightMap, HotelStay } from '@workspace/domain'
import type { LayerSpecification } from 'maplibre-gl'

maplibregl.setWorkerUrl(maplibreglWorkerUrl)

const AIRPORT_SOURCE_ID = 'flight-map-airports'
const ROUTE_SOURCE_ID = 'flight-map-routes'
const HEATMAP_LAYER_ID = 'flight-map-heatmap'
const AIRPORT_OVERVIEW_LAYER_ID = 'flight-map-airports-overview'
const AIRPORT_HIT_LAYER_ID = 'flight-map-airports-hit'
const AIRPORT_LABEL_LAYER_ID = 'flight-map-airports-labels'
const ROUTE_HIT_LAYER_ID = 'flight-map-routes-hit'
const ACTIVE_ROUTE_SOURCE_ID = 'flight-map-active-route'
const ACTIVE_ROUTE_LAYER_ID = 'flight-map-active-route-line'
const HOTEL_SOURCE_ID = 'flight-map-hotels'
const HOTEL_LAYER_ID = 'flight-map-hotels-circle'
const HOTEL_HIT_LAYER_ID = 'flight-map-hotels-hit'
const HOTEL_LABEL_LAYER_ID = 'flight-map-hotels-labels'
const AIRPORT_LAYER_ID = AIRPORT_OVERVIEW_LAYER_ID
const ROUTE_GLOW_LAYER_ID = FLIGHT_SCENE_LAYER_ID
const ROUTE_LINE_LAYER_ID = FLIGHT_SCENE_LAYER_ID
const DEFAULT_MAP_PITCH = 54
const DEFAULT_MAP_BEARING = -18
const CUSTOM_LAYER_IDS = [
  HEATMAP_LAYER_ID,
  AIRPORT_OVERVIEW_LAYER_ID,
  AIRPORT_HIT_LAYER_ID,
  AIRPORT_LABEL_LAYER_ID,
  ROUTE_HIT_LAYER_ID,
  ACTIVE_ROUTE_LAYER_ID,
  HOTEL_LAYER_ID,
  HOTEL_HIT_LAYER_ID,
  HOTEL_LABEL_LAYER_ID,
  FLIGHT_SCENE_LAYER_ID,
]

type RouteScope = 'all' | 'domestic' | 'international'
type HotelStayScope = 'active' | 'archived' | 'all'

interface AirportHoverStat {
  airlines: string[]
  connectedRoutes: number
  lastYear: string | null
}

interface RouteHoverStat {
  airlines: string[]
  count: number
  distanceKm: number
  routeType: RouteScope | 'unknown'
  years: string[]
}

interface RouteOption {
  count: number
  key: string
  label: string
}

interface HotelHoverStat {
  city: string | null
  country: string | null
  nights: number | null
  checkInDate: string | null
  checkOutDate: string | null
  pricingCurrency: string | null
  pricingTotal: number | null
  archivedAt: string | null
}

function formatDistance(value: number) {
  return `${value.toLocaleString()} km`
}

function formatPlaybackDate(value: string) {
  try {
    return format(parseISO(value), 'MMM d, yyyy')
  } catch {
    return value
  }
}

function formatStayDate(value: string | null) {
  if (!value) {
    return 'Unknown'
  }

  try {
    return format(parseISO(value), 'MMM d, yyyy')
  } catch {
    return value
  }
}

function formatHotelPricing(stay: Pick<HotelStay, 'pricing'>) {
  if (stay.pricing.total === null || stay.pricing.total === undefined) {
    return 'Pricing not captured'
  }

  return `${stay.pricing.currency ?? 'Currency unknown'} ${stay.pricing.total}`
}

function matchesHotelDateWindow(
  stay: Pick<HotelStay, 'checkInDate' | 'checkOutDate'>,
  startDate: string,
  endDate: string,
) {
  if (!startDate && !endDate) {
    return true
  }

  const normalizedStart = stay.checkInDate ?? stay.checkOutDate
  const normalizedEnd = stay.checkOutDate ?? stay.checkInDate

  if (!normalizedStart || !normalizedEnd) {
    return false
  }

  const stayStart = startOfDay(parseISO(normalizedStart))
  const stayEnd = endOfDay(parseISO(normalizedEnd))
  const windowStart = startDate ? startOfDay(parseISO(startDate)) : null
  const windowEnd = endDate ? endOfDay(parseISO(endDate)) : null

  if (windowStart && isBefore(stayEnd, windowStart)) {
    return false
  }

  if (windowEnd && isAfter(stayStart, windowEnd)) {
    return false
  }

  return true
}

function createEmptyFeatureCollection() {
  return { type: 'FeatureCollection' as const, features: [] }
}

function buildHotelFeatureCollection(
  hotels: HotelStay[],
  selectedHotelId: string | null,
) {
  return {
    type: 'FeatureCollection' as const,
    features: hotels
      .filter(
        (hotel): hotel is HotelStay & { lat: number; lng: number } =>
          hotel.lat !== null && hotel.lng !== null,
      )
      .map((hotel) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [hotel.lng, hotel.lat],
        },
        properties: {
          id: hotel.id,
          hotelName: hotel.hotelName,
          city: hotel.city ?? 'Unknown city',
          country: hotel.country ?? 'Unknown country',
          archived: hotel.archivedAt !== null,
          selected: hotel.id === selectedHotelId,
          checkInDate: hotel.checkInDate,
          checkOutDate: hotel.checkOutDate,
          nights: hotel.nights,
          pricingCurrency: hotel.pricing.currency,
          pricingTotal: hotel.pricing.total,
        },
      })),
  }
}

function getRouteKey(from: string, to: string) {
  return `${from}:${to}`
}

function formatAirlineList(values: string[]) {
  if (values.length === 0) return 'Unknown'
  if (values.length <= 2) return values.join(', ')
  return `${values.slice(0, 2).join(', ')} +${values.length - 2}`
}

function formatYearList(values: string[]) {
  if (values.length === 0) return 'Unknown'
  if (values.length <= 3) return values.join(', ')
  return `${values.slice(0, 3).join(', ')} +${values.length - 3}`
}

function getFlightRouteType(
  flight: FlightMap['flights'][number],
  airportCountryByIata: Map<string, string>,
): RouteScope | 'unknown' {
  const fromCountry = airportCountryByIata.get(flight.from)
  const toCountry = airportCountryByIata.get(flight.to)

  if (!fromCountry || !toCountry) {
    return 'unknown'
  }

  return fromCountry === toCountry ? 'domestic' : 'international'
}

function buildDerivedMapData(data: FlightMap, flights: FlightMap['flights']) {
  if (flights.length === 0) {
    return {
      airports: [],
      routes: [],
      flights: [],
      summary: {
        totalFlights: 0,
        totalDistanceKm: 0,
        citiesVisited: 0,
        countriesVisited: 0,
      },
    } satisfies FlightMap
  }

  const airportMeta = new Map(
    data.airports.map((airport) => [airport.iata, airport]),
  )
  const routeMeta = new Map<string, FlightMap['routes'][number]>(
    data.routes.map(
      (route) => [getRouteKey(route.from, route.to), route] as const,
    ),
  )
  const airportCounts = new Map<string, number>()
  const citySet = new Set<string>()
  const countrySet = new Set<string>()
  const routeCounts = new Map<string, FlightMap['routes'][number]>()
  let totalDistanceKm = 0

  for (const flight of flights) {
    totalDistanceKm += haversineDistanceKm(
      flight.fromLat,
      flight.fromLng,
      flight.toLat,
      flight.toLng,
    )

    airportCounts.set(flight.from, (airportCounts.get(flight.from) ?? 0) + 1)
    airportCounts.set(flight.to, (airportCounts.get(flight.to) ?? 0) + 1)

    const fromAirport = airportMeta.get(flight.from)
    const toAirport = airportMeta.get(flight.to)
    if (fromAirport?.city) citySet.add(fromAirport.city)
    if (toAirport?.city) citySet.add(toAirport.city)
    if (fromAirport?.country) countrySet.add(fromAirport.country)
    if (toAirport?.country) countrySet.add(toAirport.country)

    const routeKey = getRouteKey(flight.from, flight.to)
    const existingRoute = routeCounts.get(routeKey)
    if (existingRoute) {
      existingRoute.count += 1
      continue
    }

    const baseRoute = routeMeta.get(routeKey)
    routeCounts.set(routeKey, {
      from: flight.from,
      to: flight.to,
      fromLat: baseRoute?.fromLat ?? flight.fromLat,
      fromLng: baseRoute?.fromLng ?? flight.fromLng,
      toLat: baseRoute?.toLat ?? flight.toLat,
      toLng: baseRoute?.toLng ?? flight.toLng,
      count: 1,
      path: baseRoute?.path ?? [
        [flight.fromLng, flight.fromLat],
        [flight.toLng, flight.toLat],
      ],
    })
  }

  const airports = Array.from(airportCounts.entries()).map(([iata, visits]) => {
    const airport = airportMeta.get(iata)
    const matchingFlight = flights.find(
      (flight) => flight.from === iata || flight.to === iata,
    )

    return {
      iata,
      lat:
        airport?.lat ??
        (matchingFlight?.from === iata
          ? matchingFlight.fromLat
          : (matchingFlight?.toLat ?? 0)),
      lng:
        airport?.lng ??
        (matchingFlight?.from === iata
          ? matchingFlight.fromLng
          : (matchingFlight?.toLng ?? 0)),
      city: airport?.city ?? null,
      country: airport?.country ?? null,
      timezone: airport?.timezone ?? null,
      visits,
    }
  })

  return {
    airports,
    routes: Array.from(routeCounts.values()),
    flights,
    summary: {
      totalFlights: flights.length,
      totalDistanceKm: Math.round(totalDistanceKm),
      citiesVisited: citySet.size,
      countriesVisited: countrySet.size,
    },
  } satisfies FlightMap
}

function haversineDistanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) {
  const toRadians = (value: number) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const deltaLat = toRadians(toLat - fromLat)
  const deltaLng = toRadians(toLng - fromLng)
  const originLat = toRadians(fromLat)
  const destinationLat = toRadians(toLat)

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(deltaLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusKm * c
}

function buildPlaybackMapData(
  data: FlightMap,
  flights: FlightMap['flights'],
  activeIndex: number,
): FlightMap {
  return buildDerivedMapData(data, flights.slice(0, activeIndex + 1))
}

function buildInteractiveRouteFeatureCollection(
  data: FlightMap,
  routeStats: Map<string, RouteHoverStat>,
) {
  return {
    type: 'FeatureCollection' as const,
    features: data.routes.map((route) => {
      const routeKey = getRouteKey(route.from, route.to)
      const stat = routeStats.get(routeKey)

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: route.path,
        },
        properties: {
          from: route.from,
          to: route.to,
          count: route.count,
          distanceKm: stat?.distanceKm ?? 0,
          airlines: formatAirlineList(stat?.airlines ?? []),
          routeType: stat?.routeType ?? 'unknown',
          years: formatYearList(stat?.years ?? []),
        },
      }
    }),
  }
}

function buildActiveRouteFeatureCollection(
  activeFlight: FlightMap['flights'][number] | null,
  data: FlightMap,
) {
  if (!activeFlight) {
    return createEmptyFeatureCollection()
  }

  const route = data.routes.find(
    (entry) => entry.from === activeFlight.from && entry.to === activeFlight.to,
  )

  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: route?.path ?? [
            [activeFlight.fromLng, activeFlight.fromLat],
            [activeFlight.toLng, activeFlight.toLat],
          ],
        },
        properties: {
          from: activeFlight.from,
          to: activeFlight.to,
          airline: activeFlight.airline,
          date: activeFlight.date,
          flightNumber: activeFlight.flightNumber ?? '',
        },
      },
    ],
  }
}

function hasVisibleSize(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function MapSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-140 w-full rounded-3xl" />
    </div>
  )
}

function getOverlayBeforeId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle().layers as LayerSpecification[] | undefined
  return getOverlayAnchorId(layers, CUSTOM_LAYER_IDS)
}

function ensureMapSources(map: maplibregl.Map) {
  if (!map.getSource(AIRPORT_SOURCE_ID)) {
    map.addSource(AIRPORT_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }

  if (!map.getSource(ROUTE_SOURCE_ID)) {
    map.addSource(ROUTE_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }

  if (!map.getSource(ACTIVE_ROUTE_SOURCE_ID)) {
    map.addSource(ACTIVE_ROUTE_SOURCE_ID, {
      type: 'geojson',
      data: createEmptyFeatureCollection(),
    })
  }

  if (!map.getSource(HOTEL_SOURCE_ID)) {
    map.addSource(HOTEL_SOURCE_ID, {
      type: 'geojson',
      data: createEmptyFeatureCollection(),
    })
  }
}

function addLayerIfMissing(
  map: maplibregl.Map,
  layer: LayerSpecification,
  beforeId?: string,
) {
  if (map.getLayer(layer.id)) {
    return
  }

  map.addLayer(layer, beforeId)
}

function ensureMapLayers(map: maplibregl.Map, settings: MapSettings) {
  ensureMapSources(map)

  const beforeId = getOverlayBeforeId(map)

  addLayerIfMissing(
    map,
    {
      id: HEATMAP_LAYER_ID,
      type: 'heatmap',
      source: AIRPORT_SOURCE_ID,
      paint: {
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'visits'],
          1,
          0.4,
          12,
          1,
        ],

        'heatmap-intensity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0,
          1.6 * settings.heatmapIntensity,
          7,
          2.2 * settings.heatmapIntensity,
          12,
          2.5 * settings.heatmapIntensity,
        ],

        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0,
          24,
          7,
          56,
          12,
          72,
        ],

        'heatmap-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0,
          0.95,
          7,
          0.85,
          12,
          0.55,
        ],

        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(59,130,246,0.12)',
          0.25,
          'rgba(59,130,246,0.45)',
          0.5,
          'rgba(14,165,233,0.65)',
          0.75,
          'rgba(34,197,94,0.8)',
          1,
          'rgba(249,115,22,0.9)',
        ],
      },
    },
    beforeId,
  )

  // Uncomment to add airport overview circles back in the airports

  addLayerIfMissing(
    map,
    {
      id: AIRPORT_OVERVIEW_LAYER_ID,
      type: 'circle',
      source: AIRPORT_SOURCE_ID,
      minzoom: 6,
      maxzoom: AIRPORT_MIN_ZOOM + 10,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          6,
          ['interpolate', ['linear'], ['get', 'visits'], 1, 4, 12, 10],
          10,
          ['interpolate', ['linear'], ['get', 'visits'], 1, 8, 12, 20],
        ],
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', 'visits'],
          1,
          '#fed7aa', // light orange
          5,
          '#fb923c',
          10,
          '#f97316',
          20,
          '#ea580c',
          40,
          '#c2410c',
        ],

        'circle-opacity': 0.95,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
      },
    },
    beforeId,
  )

  addLayerIfMissing(
    map,
    {
      id: AIRPORT_HIT_LAYER_ID,
      type: 'circle',
      source: AIRPORT_SOURCE_ID,
      minzoom: 2,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'visits'],
          1,
          14,
          12,
          30,
        ],
        'circle-color': '#f8fafc',
        'circle-opacity': 0,
        'circle-stroke-opacity': 0,
      },
    },
    beforeId,
  )

  addLayerIfMissing(
    map,
    {
      id: AIRPORT_LABEL_LAYER_ID,
      type: 'symbol',
      source: AIRPORT_SOURCE_ID,
      minzoom: Math.max(0, AIRPORT_MIN_ZOOM - 0.2),
      layout: {
        'text-field': [
          'format',
          ['get', 'iata'],
          { 'font-scale': 1 },
          '\n',
          {},
          ['get', 'city'],
          { 'font-scale': 0.82 },
        ],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 8, 13],
        'text-line-height': 1.1,
        'text-letter-spacing': 0.04,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
      },
      paint: {
        'text-color': '#f8fafc',
        'text-halo-color': 'rgba(15, 23, 42, 0.94)',
        'text-halo-width': 1.35,
      },
    },
    beforeId,
  )

  addLayerIfMissing(
    map,
    {
      id: ROUTE_HIT_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          1,
          12,
          6,
          18,
          10,
          28,
        ],
        'line-opacity': 0,
      },
    },
    beforeId,
  )

  addLayerIfMissing(
    map,
    {
      id: ACTIVE_ROUTE_LAYER_ID,
      type: 'line',
      source: ACTIVE_ROUTE_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#f8fafc',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 3, 6, 5, 10, 8],
        'line-opacity': 0.96,
        'line-blur': 0.2,
      },
    },
    beforeId,
  )

  addLayerIfMissing(
    map,
    {
      id: HOTEL_LAYER_ID,
      type: 'circle',
      source: HOTEL_SOURCE_ID,
      minzoom: 5,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          2,
          ['case', ['boolean', ['get', 'selected'], false], 4, 2],
          6,
          ['case', ['boolean', ['get', 'selected'], false], 6, 3.5],
          10,
          ['case', ['boolean', ['get', 'selected'], false], 8, 5],
        ],
        'circle-color': [
          'case',
          ['boolean', ['get', 'selected'], false],
          '#0f766e',
          ['boolean', ['get', 'archived'], false],
          '#94a3b8',
          '#2dd4bf',
        ],
        'circle-opacity': 0.85,
        'circle-stroke-color': [
          'case',
          ['boolean', ['get', 'selected'], false],
          '#ccfbf1',
          '#ffffff',
        ],
        'circle-stroke-width': [
          'case',
          ['boolean', ['get', 'selected'], false],
          2,
          1,
        ],
      },
    },
    beforeId,
  )

  addLayerIfMissing(
    map,
    {
      id: HOTEL_HIT_LAYER_ID,
      type: 'circle',
      source: HOTEL_SOURCE_ID,
      minzoom: 2,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          2,
          14,
          6,
          18,
          10,
          24,
        ],
        'circle-color': '#14b8a6',
        'circle-opacity': 0,
        'circle-stroke-opacity': 0,
      },
    },
    beforeId,
  )

  addLayerIfMissing(
    map,
    {
      id: HOTEL_LABEL_LAYER_ID,
      type: 'symbol',
      source: HOTEL_SOURCE_ID,
      minzoom: Math.max(0, AIRPORT_MIN_ZOOM - 0.2),
      layout: {
        'text-field': ['get', 'hotelName'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 8, 12],
        'text-line-height': 1.1,
        'text-letter-spacing': 0.02,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
      },
      paint: {
        'text-color': '#ecfeff',
        'text-halo-color': 'rgba(8, 47, 73, 0.92)',
        'text-halo-width': 1.2,
      },
    },
    beforeId,
  )
}

function ensureFlightSceneLayer(
  map: maplibregl.Map,
  sceneController: FlightMap3DLayerController,
) {
  if (map.getLayer(FLIGHT_SCENE_LAYER_ID)) {
    return
  }

  map.addLayer(sceneController.layer, getOverlayBeforeId(map))
}

function updateMapData(
  map: maplibregl.Map,
  data: FlightMap,
  hotels: HotelStay[],
  selectedHotelId: string | null,
  activeFlight: FlightMap['flights'][number] | null,
  routeStats: Map<string, RouteHoverStat>,
  sceneController: FlightMap3DLayerController,
) {
  const airportSource = map.getSource(AIRPORT_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined
  const routeSource = map.getSource(ROUTE_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined
  const activeRouteSource = map.getSource(ACTIVE_ROUTE_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined
  const hotelSource = map.getSource(HOTEL_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined

  airportSource?.setData(buildAirportFeatureCollection(data))
  routeSource?.setData(buildInteractiveRouteFeatureCollection(data, routeStats))
  hotelSource?.setData(buildHotelFeatureCollection(hotels, selectedHotelId))
  activeRouteSource?.setData(
    buildActiveRouteFeatureCollection(activeFlight, data),
  )
  sceneController.setData(data)
}

function fitMapToPoints(
  map: maplibregl.Map,
  data: FlightMap,
  hotels: HotelStay[],
  includeHotels: boolean,
) {
  const coordinates: [number, number][] = data.airports.map((airport) => [
    airport.lng,
    airport.lat,
  ])

  if (includeHotels) {
    for (const hotel of hotels) {
      if (hotel.lat !== null && hotel.lng !== null) {
        coordinates.push([hotel.lng, hotel.lat])
      }
    }
  }

  if (coordinates.length === 0) {
    return
  }

  if (coordinates.length === 1) {
    map.flyTo({
      center: coordinates[0],
      zoom: 4,
      pitch: DEFAULT_MAP_PITCH,
      bearing: DEFAULT_MAP_BEARING,
      essential: true,
    })
    return
  }

  const bounds = new maplibregl.LngLatBounds()
  for (const coordinate of coordinates) {
    bounds.extend(coordinate)
  }

  map.fitBounds(bounds, {
    padding: 72,
    duration: 1200,
    pitch: DEFAULT_MAP_PITCH,
    bearing: DEFAULT_MAP_BEARING,
    essential: true,
  })
}

function applySettingsToMap(
  map: maplibregl.Map,
  settings: MapSettings,
  sceneController: FlightMap3DLayerController,
  showActiveRouteHighlight = false,
) {
  const setVis = (id: string, visible: boolean) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    }
  }

  setVis(HEATMAP_LAYER_ID, settings.showHeatmap)
  setVis(AIRPORT_OVERVIEW_LAYER_ID, true)
  setVis(AIRPORT_HIT_LAYER_ID, true)
  setVis(AIRPORT_LABEL_LAYER_ID, settings.showLabels)
  setVis(HOTEL_LAYER_ID, settings.showMarkers)
  setVis(HOTEL_HIT_LAYER_ID, settings.showMarkers)
  setVis(HOTEL_LABEL_LAYER_ID, settings.showMarkers && settings.showLabels)
  setVis(ROUTE_HIT_LAYER_ID, settings.showRoutes)
  setVis(
    ACTIVE_ROUTE_LAYER_ID,
    showActiveRouteHighlight && !settings.showRoutes,
  )

  const labelLayerIds = getBaseLabelLayerIds(
    map.getStyle().layers as LayerSpecification[] | undefined,
    CUSTOM_LAYER_IDS,
  )

  for (const layerId of labelLayerIds) {
    setVis(layerId, settings.showLabels)
  }

  if (map.getLayer(HEATMAP_LAYER_ID)) {
    map.setPaintProperty(HEATMAP_LAYER_ID, 'heatmap-intensity', [
      'interpolate',
      ['linear'],
      ['zoom'],
      0,
      1.5 * settings.heatmapIntensity,
      7,
      3 * settings.heatmapIntensity,
    ])
  }

  map.setProjection({ type: settings.projection })

  if (supportsTerrain(settings.mapStyle) && settings.terrainEnabled) {
    if (map.getSource('terrainDem')) {
      map.setTerrain({ source: 'terrainDem', exaggeration: 1.18 })
    }
    if (map.getLayer(TERRAIN_HILLSHADE_LAYER_ID)) {
      map.setLayoutProperty(TERRAIN_HILLSHADE_LAYER_ID, 'visibility', 'visible')
    }
  } else {
    map.setTerrain(null)
    if (map.getLayer(TERRAIN_HILLSHADE_LAYER_ID)) {
      map.setLayoutProperty(TERRAIN_HILLSHADE_LAYER_ID, 'visibility', 'none')
    }
  }
  sceneController.setSettings({
    showMarkers: settings.showMarkers,
    showRoutes: settings.showRoutes,
    showHeatmap3d: settings.heatmap3d,
    showSelectedHotelMarker: false,
    glowTint: settings.routeColor,
  })

  if (settings.terrainEnabled && map.getPitch() < 45) {
    map.easeTo({
      pitch: DEFAULT_MAP_PITCH,
      bearing: DEFAULT_MAP_BEARING,
      duration: 900,
      essential: true,
    })
  } else if (!settings.terrainEnabled && map.getPitch() < 30) {
    map.easeTo({
      pitch: DEFAULT_MAP_PITCH,
      bearing: DEFAULT_MAP_BEARING,
      duration: 900,
      essential: true,
    })
  }
}

function MapControlsInline({
  settings,
  onChange,
}: {
  settings: MapSettings
  onChange: (patch: Partial<MapSettings>) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">
          Style
        </Label>
        <Select
          value={settings.mapStyle}
          onValueChange={(value) =>
            onChange({ mapStyle: value as MapStyleName })
          }
        >
          <SelectTrigger className="h-7 w-27.5 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MAP_STYLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator orientation="vertical" className="hidden h-5 lg:block" />

      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">
          Projection
        </Label>
        <ToggleGroup
          type="single"
          value={settings.projection}
          onValueChange={(value) => {
            if (value === 'mercator' || value === 'globe') {
              onChange({ projection: value })
            }
          }}
          className="gap-1"
        >
          <ToggleGroupItem value="mercator" className="h-7 px-2.5 text-xs">
            Flat
          </ToggleGroupItem>
          <ToggleGroupItem value="globe" className="h-7 px-2.5 text-xs">
            Globe
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Separator orientation="vertical" className="hidden h-5 lg:block" />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Switch
            id="toggle-heatmap"
            checked={settings.showHeatmap}
            onCheckedChange={(value) => onChange({ showHeatmap: value })}
            className="scale-75"
          />
          <Label htmlFor="toggle-heatmap" className="text-xs cursor-pointer">
            Heatmap
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch
            id="toggle-heatmap3d"
            checked={settings.heatmap3d}
            onCheckedChange={(value) => onChange({ heatmap3d: value })}
            className="scale-75"
          />
          <Label htmlFor="toggle-heatmap3d" className="text-xs cursor-pointer">
            3D Heat
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch
            id="toggle-routes"
            checked={settings.showRoutes}
            onCheckedChange={(value) => onChange({ showRoutes: value })}
            className="scale-75"
          />
          <Label htmlFor="toggle-routes" className="text-xs cursor-pointer">
            Routes
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch
            id="toggle-markers"
            checked={settings.showMarkers}
            onCheckedChange={(value) => onChange({ showMarkers: value })}
            className="scale-75"
          />
          <Label htmlFor="toggle-markers" className="text-xs cursor-pointer">
            Markers
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch
            id="toggle-labels"
            checked={settings.showLabels}
            onCheckedChange={(value) => onChange({ showLabels: value })}
            className="scale-75"
          />
          <Label htmlFor="toggle-labels" className="text-xs cursor-pointer">
            Labels
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch
            id="toggle-terrain"
            checked={settings.terrainEnabled}
            onCheckedChange={(value) => onChange({ terrainEnabled: value })}
            disabled={!supportsTerrain(settings.mapStyle)}
            className="scale-75"
          />
          <Label
            htmlFor="toggle-terrain"
            className="text-xs cursor-pointer data-[disabled=true]:cursor-not-allowed"
            data-disabled={!supportsTerrain(settings.mapStyle)}
          >
            Terrain
          </Label>
        </div>
      </div>

      {/* <Separator orientation="vertical" className="hidden h-5 lg:block" /> */}

      {/* <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">
          <Palette className="inline h-3 w-3 mr-1" />
          Route
        </Label>
        <ToggleGroup
          type="single"
          value={settings.routeColor}
          onValueChange={(value) => {
            if (value) {
              onChange({ routeColor: value })
            }
          }}
          className="gap-1"
        >
          {ROUTE_COLOR_PRESETS.map((preset) => (
            <ToggleGroupItem
              key={preset.value}
              value={preset.value}
              aria-label={preset.label}
              className="h-6 w-6 rounded-full p-0 data-[state=on]:ring-2 data-[state=on]:ring-primary data-[state=on]:ring-offset-1"
              style={{ backgroundColor: preset.value }}
            />
          ))}
        </ToggleGroup>
      </div> */}

      {settings.showHeatmap ? (
        <>
          <Separator orientation="vertical" className="hidden h-5 lg:block" />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Intensity
            </Label>
            <Slider
              min={0.2}
              max={2.0}
              step={0.1}
              value={[settings.heatmapIntensity]}
              onValueChange={([value]) => onChange({ heatmapIntensity: value })}
              className="w-20"
            />
            <span className="text-xs tabular-nums text-muted-foreground w-7">
              {settings.heatmapIntensity.toFixed(1)}
            </span>
          </div>
        </>
      ) : null}
    </div>
  )
}

function MapControlsPopover({
  settings,
  onChange,
}: {
  settings: MapSettings
  onChange: (patch: Partial<MapSettings>) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-4" align="end">
        <p className="text-sm font-medium">Map Settings</p>

        <div className="space-y-1.5">
          <Label className="text-xs">Base Map</Label>
          <Select
            value={settings.mapStyle}
            onValueChange={(value) =>
              onChange({ mapStyle: value as MapStyleName })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAP_STYLE_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="text-xs"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label className="text-xs">Projection</Label>
          <ToggleGroup
            type="single"
            value={settings.projection}
            onValueChange={(value) => {
              if (value === 'mercator' || value === 'globe') {
                onChange({ projection: value })
              }
            }}
            className="justify-start gap-1.5"
          >
            <ToggleGroupItem value="mercator" className="h-8 px-3 text-xs">
              Flat
            </ToggleGroupItem>
            <ToggleGroupItem value="globe" className="h-8 px-3 text-xs">
              Globe
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-xs">Layers</Label>
          {(
            [
              { key: 'showHeatmap', label: 'Heatmap' },
              { key: 'heatmap3d', label: '3D Heatmap' },
              { key: 'showRoutes', label: 'Routes' },
              { key: 'showMarkers', label: 'Markers' },
              { key: 'showLabels', label: 'Labels' },
              { key: 'terrainEnabled', label: 'Terrain' },
            ] as { key: keyof MapSettings; label: string }[]
          ).map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <Label
                htmlFor={`pop-${item.key}`}
                className="text-xs cursor-pointer"
              >
                {item.label}
              </Label>
              <Switch
                id={`pop-${item.key}`}
                checked={settings[item.key] as boolean}
                onCheckedChange={(value) => onChange({ [item.key]: value })}
                disabled={
                  item.key === 'terrainEnabled' &&
                  !supportsTerrain(settings.mapStyle)
                }
                className="scale-75"
              />
            </div>
          ))}
        </div>

        {/* <Separator /> */}

        {/* <div className="space-y-1.5">
          <Label className="text-xs">Route Color</Label>
          <ToggleGroup
            type="single"
            value={settings.routeColor}
            onValueChange={(value) => {
              if (value) {
                onChange({ routeColor: value })
              }
            }}
            className="gap-1.5 justify-start"
          >
            {ROUTE_COLOR_PRESETS.map((preset) => (
              <ToggleGroupItem
                key={preset.value}
                value={preset.value}
                aria-label={preset.label}
                className="h-7 w-7 rounded-full p-0 data-[state=on]:ring-2 data-[state=on]:ring-primary data-[state=on]:ring-offset-1"
                style={{ backgroundColor: preset.value }}
              />
            ))}
          </ToggleGroup>
        </div> */}

        {settings.showHeatmap ? (
          <>
            <Separator />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Heatmap Intensity</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {settings.heatmapIntensity.toFixed(1)}
                </span>
              </div>
              <Slider
                min={0.2}
                max={2.0}
                step={0.1}
                value={[settings.heatmapIntensity]}
                onValueChange={([value]) =>
                  onChange({ heatmapIntensity: value })
                }
              />
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function TimelinePlaybackControls({
  activeFlight,
  currentIndex,
  enabled,
  isPlaying,
  onEnabledChange,
  onPlayPause,
  onReset,
  onStep,
  onValueChange,
  setSpeed,
  speed,
  totalFlights,
}: {
  activeFlight: FlightMap['flights'][number] | null
  currentIndex: number
  enabled: boolean
  isPlaying: boolean
  onEnabledChange: (value: boolean) => void
  onPlayPause: () => void
  onReset: () => void
  onStep: (direction: -1 | 1) => void
  onValueChange: (nextIndex: number) => void
  setSpeed: (value: number) => void
  speed: number
  totalFlights: number
}) {
  const disabled = totalFlights <= 1

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Switch
              id="toggle-timeline-playback"
              checked={enabled}
              onCheckedChange={onEnabledChange}
              disabled={disabled}
              className="scale-75"
            />
            <Label
              htmlFor="toggle-timeline-playback"
              className="cursor-pointer text-xs"
            >
              Timeline Playback
            </Label>
          </div>
          <Badge variant="outline" className="text-xs">
            {enabled
              ? `${currentIndex + 1} / ${totalFlights}`
              : `${totalFlights} flights`}
          </Badge>
        </div>

        {enabled ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={onReset}
              disabled={currentIndex === 0}
              aria-label="Reset timeline"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onStep(-1)}
              disabled={currentIndex === 0}
              aria-label="Previous flight"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onPlayPause}
              disabled={disabled}
              aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}
            >
              {isPlaying ? (
                <Pause className="mr-2 h-4 w-4" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onStep(1)}
              disabled={currentIndex >= totalFlights - 1}
              aria-label="Next flight"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            <ToggleGroup
              type="single"
              value={String(speed)}
              onValueChange={(value) => {
                if (!value) {
                  return
                }
                setSpeed(Number(value))
              }}
              className="gap-1"
            >
              {[1, 2, 4].map((value) => (
                <ToggleGroupItem
                  key={value}
                  value={String(value)}
                  className="h-8 px-2.5 text-xs"
                >
                  {value}x
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ) : null}
      </div>

      {enabled ? (
        <>
          <div className="flex items-center gap-3">
            <Slider
              min={0}
              max={Math.max(totalFlights - 1, 0)}
              step={1}
              value={[currentIndex]}
              onValueChange={([value]) => onValueChange(value)}
              className="flex-1"
            />
            <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
              {currentIndex + 1}
            </span>
          </div>
          <div className="rounded-lg bg-background/80 px-3 py-2 text-sm text-muted-foreground">
            {activeFlight ? (
              <>
                <span className="font-medium text-foreground">
                  {activeFlight.from} → {activeFlight.to}
                </span>
                <span className="mx-2">•</span>
                <span>{activeFlight.airline}</span>
                {activeFlight.flightNumber ? (
                  <>
                    <span className="mx-2">•</span>
                    <span>{activeFlight.flightNumber}</span>
                  </>
                ) : null}
                <span className="mx-2">•</span>
                <span>{formatPlaybackDate(activeFlight.date)}</span>
              </>
            ) : (
              'Turn on playback to scrub through your trips in chronological order.'
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Turn on playback to replay your trips in chronological order and
          highlight one active flight at a time.
        </p>
      )}
    </div>
  )
}

function FlightInteractionControls({
  airlineOptions,
  routeOptions,
  routeScope,
  selectedAirline,
  selectedRoute,
  selectedYear,
  topRoutesOnly,
  yearOptions,
  onAirlineChange,
  onRouteChange,
  onRouteScopeChange,
  onTopRoutesChange,
  onYearChange,
}: {
  airlineOptions: string[]
  routeOptions: RouteOption[]
  routeScope: RouteScope
  selectedAirline: string
  selectedRoute: string
  selectedYear: string
  topRoutesOnly: boolean
  yearOptions: string[]
  onAirlineChange: (value: string) => void
  onRouteChange: (value: string) => void
  onRouteScopeChange: (value: RouteScope) => void
  onTopRoutesChange: (value: boolean) => void
  onYearChange: (value: string) => void
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
        <div className="flex items-center gap-2">
          <Label className="w-16 text-xs text-muted-foreground">Airline</Label>
          <Select value={selectedAirline} onValueChange={onAirlineChange}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All airlines
              </SelectItem>
              {airlineOptions.map((airline) => (
                <SelectItem key={airline} value={airline} className="text-xs">
                  {airline}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="w-16 text-xs text-muted-foreground">Year</Label>
          <Select value={selectedYear} onValueChange={onYearChange}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All years
              </SelectItem>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year} className="text-xs">
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="w-16 text-xs text-muted-foreground">Type</Label>
          <ToggleGroup
            type="single"
            value={routeScope}
            onValueChange={(value) => {
              if (
                value === 'all' ||
                value === 'domestic' ||
                value === 'international'
              ) {
                onRouteScopeChange(value)
              }
            }}
            className="gap-1"
          >
            <ToggleGroupItem value="all" className="h-8 px-2.5 text-xs">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="domestic" className="h-8 px-2.5 text-xs">
              Domestic
            </ToggleGroupItem>
            <ToggleGroupItem
              value="international"
              className="h-8 px-2.5 text-xs"
            >
              International
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex items-center gap-2">
          <Label className="w-16 text-xs text-muted-foreground">Route</Label>
          <Select value={selectedRoute} onValueChange={onRouteChange}>
            <SelectTrigger className="h-8 w-52 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All routes
              </SelectItem>
              {routeOptions.map((route) => (
                <SelectItem
                  key={route.key}
                  value={route.key}
                  className="text-xs"
                >
                  {route.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <Switch
            id="toggle-top-routes"
            checked={topRoutesOnly}
            onCheckedChange={onTopRoutesChange}
            className="scale-75"
          />
          <Label htmlFor="toggle-top-routes" className="cursor-pointer text-xs">
            Top 10 routes only
          </Label>
        </div>
      </div>
    </div>
  )
}

function HotelInteractionControls({
  hotelCount,
  scope,
  startDate,
  endDate,
  onScopeChange,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: {
  hotelCount: number
  scope: HotelStayScope
  startDate: string
  endDate: string
  onScopeChange: (value: HotelStayScope) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onClear: () => void
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
        <div className="flex items-center gap-2">
          <Label className="w-20 text-xs text-muted-foreground">Hotels</Label>
          <Select
            value={scope}
            onValueChange={(value) => onScopeChange(value as HotelStayScope)}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active" className="text-xs">
                Active stays
              </SelectItem>
              <SelectItem value="archived" className="text-xs">
                Archived stays
              </SelectItem>
              <SelectItem value="all" className="text-xs">
                All stays
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="w-20 text-xs text-muted-foreground">From</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="h-8 w-40 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="w-20 text-xs text-muted-foreground">To</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="h-8 w-40 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {hotelCount} visible hotels
          </Badge>
          <Button type="button" variant="outline" size="sm" onClick={onClear}>
            Clear hotel filters
          </Button>
        </div>
      </div>
    </div>
  )
}

function TravelMapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="size-3 rounded-full bg-orange-500 ring-2 ring-white/90" />
        Airports
      </div>
      <div className="flex items-center gap-2">
        <span className="size-3 rounded-full bg-teal-400 ring-2 ring-white/90" />
        Hotels
      </div>
      <div className="flex items-center gap-2">
        <span className="size-3 rounded-full bg-slate-400 ring-2 ring-white/90" />
        Archived hotel
      </div>
    </div>
  )
}

export interface FlightMapDashboardProps {
  isActive: boolean
}

export function FlightMapDashboard({ isActive }: FlightMapDashboardProps) {
  const mapQuery = useFlightMap()
  const hotelsQuery = useAllHotelStays({ includeArchived: true })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const sceneControllerRef = useRef<FlightMap3DLayerController | null>(null)
  const hasFittedRef = useRef(false)
  const latestDataRef = useRef<FlightMap | null>(null)
  const latestActiveFlightRef = useRef<FlightMap['flights'][number] | null>(
    null,
  )
  const latestAirportStatsRef = useRef<Map<string, AirportHoverStat>>(new Map())
  const latestRouteStatsRef = useRef<Map<string, RouteHoverStat>>(new Map())
  const latestHotelsRef = useRef<HotelStay[]>([])
  const latestHotelStatsRef = useRef<Map<string, HotelHoverStat>>(new Map())
  const latestSelectedHotelIdRef = useRef<string | null>(null)
  const settingsRef = useRef<MapSettings>(DEFAULT_SETTINGS)
  const baseStyleKeyRef = useRef<string | null>(null)

  const [settings, setSettings] = useState<MapSettings>(loadSettings)
  const [isPlaybackEnabled, setIsPlaybackEnabled] = useState(false)
  const [playbackIndex, setPlaybackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [selectedAirline, setSelectedAirline] = useState('all')
  const [selectedYear, setSelectedYear] = useState('all')
  const [selectedRoute, setSelectedRoute] = useState('all')
  const [routeScope, setRouteScope] = useState<RouteScope>('all')
  const [topRoutesOnly, setTopRoutesOnly] = useState(false)
  const [hotelScope, setHotelScope] = useState<HotelStayScope>('all')
  const [hotelStartDate, setHotelStartDate] = useState('')
  const [hotelEndDate, setHotelEndDate] = useState('')
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null)

  const sortedFlights = useMemo(() => {
    if (!mapQuery.data) {
      return [] as FlightMap['flights']
    }

    return [...mapQuery.data.flights].sort((left, right) => {
      const byDate = left.date.localeCompare(right.date)
      if (byDate !== 0) return byDate
      const byFrom = left.from.localeCompare(right.from)
      if (byFrom !== 0) return byFrom
      return left.to.localeCompare(right.to)
    })
  }, [mapQuery.data])

  const airportCountryByIata = useMemo(() => {
    if (!mapQuery.data) {
      return new Map<string, string>()
    }

    return new Map(
      mapQuery.data.airports
        .filter((airport) => Boolean(airport.country))
        .map((airport) => [airport.iata, airport.country ?? ''] as const),
    )
  }, [mapQuery.data])

  const cityByIata = useMemo(() => {
    if (!mapQuery.data) {
      return new Map<string, string>()
    }

    return new Map(
      mapQuery.data.airports
        .filter((airport) => Boolean(airport.city))
        .map((airport) => [airport.iata, airport.city ?? ''] as const),
    )
  }, [mapQuery.data])

  const airlineOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sortedFlights
            .map((flight) => flight.airline?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [sortedFlights],
  )

  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(sortedFlights.map((flight) => flight.date.slice(0, 4))),
      ).sort((left, right) => right.localeCompare(left)),
    [sortedFlights],
  )

  const scopedFlights = useMemo(() => {
    return sortedFlights.filter((flight) => {
      if (selectedAirline !== 'all' && flight.airline !== selectedAirline) {
        return false
      }

      if (selectedYear !== 'all' && !flight.date.startsWith(selectedYear)) {
        return false
      }

      if (routeScope !== 'all') {
        const flightRouteType = getFlightRouteType(flight, airportCountryByIata)
        if (flightRouteType !== routeScope) {
          return false
        }
      }

      return true
    })
  }, [
    airportCountryByIata,
    routeScope,
    selectedAirline,
    selectedYear,
    sortedFlights,
  ])

  const routeOptions = useMemo(() => {
    const routeCounts = new Map<string, number>()

    for (const flight of scopedFlights) {
      const routeKey = getRouteKey(flight.from, flight.to)
      routeCounts.set(routeKey, (routeCounts.get(routeKey) ?? 0) + 1)
    }

    return Array.from(routeCounts.entries())
      .map(([key, count]) => {
        const [from, to] = key.split(':')
        return {
          key,
          count,
          label: `${from} → ${to} (${count})`,
        } satisfies RouteOption
      })
      .sort(
        (left, right) =>
          right.count - left.count || left.label.localeCompare(right.label),
      )
  }, [scopedFlights])

  const filteredFlights = useMemo(() => {
    let nextFlights = scopedFlights

    if (selectedRoute !== 'all') {
      nextFlights = nextFlights.filter(
        (flight) => getRouteKey(flight.from, flight.to) === selectedRoute,
      )
    }

    if (topRoutesOnly) {
      const topRouteKeys = new Set(
        routeOptions.slice(0, 10).map((route) => route.key),
      )
      nextFlights = nextFlights.filter((flight) =>
        topRouteKeys.has(getRouteKey(flight.from, flight.to)),
      )
    }

    return nextFlights
  }, [routeOptions, scopedFlights, selectedRoute, topRoutesOnly])

  const boundedPlaybackIndex = Math.min(
    playbackIndex,
    Math.max(filteredFlights.length - 1, 0),
  )

  const filteredBaseData = useMemo(() => {
    if (!mapQuery.data) {
      return null
    }

    return buildDerivedMapData(mapQuery.data, filteredFlights)
  }, [filteredFlights, mapQuery.data])

  const displayData = useMemo(() => {
    if (!mapQuery.data) {
      return null
    }

    if (!isPlaybackEnabled) {
      return filteredBaseData
    }

    return buildPlaybackMapData(
      mapQuery.data,
      filteredFlights,
      boundedPlaybackIndex,
    )
  }, [
    boundedPlaybackIndex,
    filteredBaseData,
    filteredFlights,
    isPlaybackEnabled,
    mapQuery.data,
  ])

  const activeFlight = useMemo(() => {
    if (!isPlaybackEnabled) {
      return null
    }

    return filteredFlights[boundedPlaybackIndex] ?? null
  }, [boundedPlaybackIndex, filteredFlights, isPlaybackEnabled])

  const distanceTrendData = useMemo(() => {
    if (!displayData || displayData.flights.length === 0) {
      return []
    }

    return normalizeRecentMonthlySeries({
      entries: displayData.flights,
      getMonthKey: (flight) => flight.date.slice(0, 7),
      getValue: (flight) =>
        haversineDistanceKm(
          flight.fromLat,
          flight.fromLng,
          flight.toLat,
          flight.toLng,
        ),
    })
  }, [displayData])

  const citiesTrendData = useMemo(() => {
    if (!displayData || displayData.flights.length === 0) {
      return []
    }

    const monthlyCities = new Map<string, Set<string>>()

    for (const flight of displayData.flights) {
      const monthKey = flight.date.slice(0, 7)
      const citySet = monthlyCities.get(monthKey) ?? new Set<string>()
      const fromCity = cityByIata.get(flight.from)
      const toCity = cityByIata.get(flight.to)

      if (fromCity) {
        citySet.add(fromCity)
      }

      if (toCity) {
        citySet.add(toCity)
      }

      monthlyCities.set(monthKey, citySet)
    }

    return normalizeRecentMonthlySeries({
      entries: Array.from(monthlyCities.entries()).map(
        ([monthKey, cities]) => ({
          monthKey,
          value: cities.size,
        }),
      ),
      getMonthKey: (entry) => entry.monthKey,
      getValue: (entry) => entry.value,
    })
  }, [cityByIata, displayData])

  const routeTrendData = useMemo(() => {
    if (!displayData || displayData.flights.length === 0) {
      return []
    }

    const monthlyRoutes = new Map<string, Set<string>>()

    for (const flight of displayData.flights) {
      const monthKey = flight.date.slice(0, 7)
      const routeSet = monthlyRoutes.get(monthKey) ?? new Set<string>()
      routeSet.add(getRouteKey(flight.from, flight.to))
      monthlyRoutes.set(monthKey, routeSet)
    }

    return normalizeRecentMonthlySeries({
      entries: Array.from(monthlyRoutes.entries()).map(
        ([monthKey, routes]) => ({
          monthKey,
          value: routes.size,
        }),
      ),
      getMonthKey: (entry) => entry.monthKey,
      getValue: (entry) => entry.value,
    })
  }, [displayData])

  const airportHoverStats = useMemo(() => {
    if (!displayData) {
      return new Map<string, AirportHoverStat>()
    }

    const routeSetByAirport = new Map<string, Set<string>>()
    const airlinesByAirport = new Map<string, Set<string>>()
    const lastYearByAirport = new Map<string, string>()

    for (const flight of displayData.flights) {
      const routeKey = getRouteKey(flight.from, flight.to)

      for (const iata of [flight.from, flight.to]) {
        const routeSet = routeSetByAirport.get(iata) ?? new Set<string>()
        routeSet.add(routeKey)
        routeSetByAirport.set(iata, routeSet)

        const airlineSet = airlinesByAirport.get(iata) ?? new Set<string>()
        if (flight.airline) {
          airlineSet.add(flight.airline)
        }
        airlinesByAirport.set(iata, airlineSet)

        const year = flight.date.slice(0, 4)
        const currentLastYear = lastYearByAirport.get(iata)
        if (!currentLastYear || year > currentLastYear) {
          lastYearByAirport.set(iata, year)
        }
      }
    }

    return new Map(
      displayData.airports.map((airport) => [
        airport.iata,
        {
          airlines: Array.from(airlinesByAirport.get(airport.iata) ?? []).sort(
            (left, right) => left.localeCompare(right),
          ),
          connectedRoutes: (routeSetByAirport.get(airport.iata) ?? new Set())
            .size,
          lastYear: lastYearByAirport.get(airport.iata) ?? null,
        } satisfies AirportHoverStat,
      ]),
    )
  }, [displayData])

  const routeHoverStats = useMemo(() => {
    if (!displayData) {
      return new Map<string, RouteHoverStat>()
    }

    const routeMeta = new Map(
      displayData.routes.map(
        (route) => [getRouteKey(route.from, route.to), route] as const,
      ),
    )
    const airlinesByRoute = new Map<string, Set<string>>()
    const yearsByRoute = new Map<string, Set<string>>()

    for (const flight of displayData.flights) {
      const routeKey = getRouteKey(flight.from, flight.to)
      const airlineSet = airlinesByRoute.get(routeKey) ?? new Set<string>()
      if (flight.airline) {
        airlineSet.add(flight.airline)
      }
      airlinesByRoute.set(routeKey, airlineSet)

      const yearSet = yearsByRoute.get(routeKey) ?? new Set<string>()
      yearSet.add(flight.date.slice(0, 4))
      yearsByRoute.set(routeKey, yearSet)
    }

    return new Map(
      displayData.routes.map((route) => {
        const routeKey = getRouteKey(route.from, route.to)
        const meta = routeMeta.get(routeKey) ?? route
        return [
          routeKey,
          {
            airlines: Array.from(airlinesByRoute.get(routeKey) ?? []).sort(
              (left, right) => left.localeCompare(right),
            ),
            count: route.count,
            distanceKm: Math.round(
              haversineDistanceKm(
                meta.fromLat,
                meta.fromLng,
                meta.toLat,
                meta.toLng,
              ),
            ),
            routeType: getFlightRouteType(
              {
                from: route.from,
                to: route.to,
                fromLat: meta.fromLat,
                fromLng: meta.fromLng,
                toLat: meta.toLat,
                toLng: meta.toLng,
                airline: '',
                date: '',
                flightNumber: null,
              },
              airportCountryByIata,
            ),
            years: Array.from(yearsByRoute.get(routeKey) ?? []).sort(),
          } satisfies RouteHoverStat,
        ] as const
      }),
    )
  }, [airportCountryByIata, displayData])

  const hotelMarkers = useMemo(() => {
    return (hotelsQuery.data?.data ?? []).filter((hotel) => {
      if (hotel.lat === null || hotel.lng === null) {
        return false
      }

      if (hotelScope === 'active' && hotel.archivedAt !== null) {
        return false
      }

      if (hotelScope === 'archived' && hotel.archivedAt === null) {
        return false
      }

      return matchesHotelDateWindow(hotel, hotelStartDate, hotelEndDate)
    }) as Array<HotelStay & { lat: number; lng: number }>
  }, [hotelEndDate, hotelScope, hotelStartDate, hotelsQuery.data?.data])

  const totalHotelMarkers = useMemo(
    () =>
      (hotelsQuery.data?.data ?? []).filter(
        (hotel): hotel is HotelStay & { lat: number; lng: number } =>
          hotel.lat !== null && hotel.lng !== null,
      ),
    [hotelsQuery.data?.data],
  )

  const hotelHoverStats = useMemo(
    () =>
      new Map(
        hotelMarkers.map((hotel) => [
          hotel.id,
          {
            city: hotel.city,
            country: hotel.country,
            nights: hotel.nights,
            checkInDate: hotel.checkInDate,
            checkOutDate: hotel.checkOutDate,
            pricingCurrency: hotel.pricing.currency,
            pricingTotal: hotel.pricing.total,
            archivedAt: hotel.archivedAt,
          } satisfies HotelHoverStat,
        ]),
      ),
    [hotelMarkers],
  )

  const selectedHotel = useMemo(
    () => hotelMarkers.find((hotel) => hotel.id === selectedHotelId) ?? null,
    [hotelMarkers, selectedHotelId],
  )

  settingsRef.current = settings
  latestDataRef.current = displayData
  latestActiveFlightRef.current = activeFlight
  latestAirportStatsRef.current = airportHoverStats
  latestRouteStatsRef.current = routeHoverStats
  latestHotelsRef.current = hotelMarkers
  latestHotelStatsRef.current = hotelHoverStats
  latestSelectedHotelIdRef.current = selectedHotelId

  const baseStyleKey = `${settings.mapStyle}:${settings.terrainEnabled ? 'terrain' : 'flat'}`
  const hasActiveFilters =
    selectedAirline !== 'all' ||
    selectedYear !== 'all' ||
    selectedRoute !== 'all' ||
    routeScope !== 'all' ||
    topRoutesOnly
  const hasActiveHotelFilters =
    hotelScope !== 'all' || hotelStartDate !== '' || hotelEndDate !== ''

  const handleSettingsChange = useCallback((patch: Partial<MapSettings>) => {
    setSettings((previous) => {
      const next = sanitizeSettings({ ...previous, ...patch })
      saveSettings(next)
      return next
    })
  }, [])

  const handlePlaybackEnabledChange = useCallback((enabled: boolean) => {
    setIsPlaybackEnabled(enabled)
    setIsPlaying(false)
    setPlaybackIndex(enabled ? 0 : 0)
  }, [])

  useEffect(() => {
    if (
      selectedAirline !== 'all' &&
      !airlineOptions.includes(selectedAirline)
    ) {
      setSelectedAirline('all')
    }
  }, [airlineOptions, selectedAirline])

  useEffect(() => {
    if (selectedYear !== 'all' && !yearOptions.includes(selectedYear)) {
      setSelectedYear('all')
    }
  }, [selectedYear, yearOptions])

  useEffect(() => {
    if (
      selectedRoute !== 'all' &&
      !routeOptions.some((route) => route.key === selectedRoute)
    ) {
      setSelectedRoute('all')
    }
  }, [routeOptions, selectedRoute])

  const handlePlaybackStep = useCallback(
    (direction: -1 | 1) => {
      setIsPlaying(false)
      setPlaybackIndex((previous) => {
        const next = previous + direction
        return Math.max(
          0,
          Math.min(next, Math.max(filteredFlights.length - 1, 0)),
        )
      })
    },
    [filteredFlights.length],
  )

  const syncMapPresentation = useCallback(
    (fitToData: boolean) => {
      const map = mapRef.current
      const data = latestDataRef.current

      if (!map || !map.isStyleLoaded()) {
        return
      }

      const currentSettings = settingsRef.current
      ensureMapLayers(map, currentSettings)
      if (!sceneControllerRef.current) {
        sceneControllerRef.current = new FlightMap3DLayerController()
      }
      ensureFlightSceneLayer(map, sceneControllerRef.current)
      sceneControllerRef.current.setSelectedHotel(null)
      applySettingsToMap(
        map,
        currentSettings,
        sceneControllerRef.current,
        Boolean(latestActiveFlightRef.current),
      )

      if (!data) {
        return
      }

      updateMapData(
        map,
        data,
        latestHotelsRef.current,
        latestSelectedHotelIdRef.current,
        latestActiveFlightRef.current,
        latestRouteStatsRef.current,
        sceneControllerRef.current,
      )
      applySettingsToMap(
        map,
        currentSettings,
        sceneControllerRef.current,
        Boolean(latestActiveFlightRef.current),
      )

      if (fitToData && !hasFittedRef.current && isActive) {
        fitMapToPoints(
          map,
          data,
          latestHotelsRef.current,
          currentSettings.showMarkers,
        )
        hasFittedRef.current = true
      }

      requestAnimationFrame(() => {
        map.resize()
        map.triggerRepaint()
      })
    },
    [isActive],
  )

  const summaryCards = useMemo(() => {
    if (!displayData) {
      return []
    }

    return [
      {
        title: 'Distance Flown',
        value: formatDistance(displayData.summary.totalDistanceKm),
        description: isPlaybackEnabled
          ? 'Visible timeline slice'
          : hasActiveFilters
            ? 'Across the current filtered selection'
            : 'Across all mapped routes',
        icon: Globe2,
        trendData: distanceTrendData,
        formatTrendValue: formatDistance,
      },
      {
        title: 'Cities Reached',
        value: displayData.summary.citiesVisited.toLocaleString(),
        description: isPlaybackEnabled
          ? 'Visible during playback'
          : hasActiveFilters
            ? 'Unique cities in the current filter'
            : 'Unique airport cities across your history',
        icon: MapPinned,
        trendData: citiesTrendData,
      },
      {
        title: 'Routes Visualized',
        value: displayData.routes.length.toLocaleString(),
        description: `${displayData.summary.totalFlights.toLocaleString()} mapped flights`,
        icon: Route,
        trendData: routeTrendData,
      },
    ]
  }, [
    citiesTrendData,
    displayData,
    distanceTrendData,
    hasActiveFilters,
    isPlaybackEnabled,
    routeTrendData,
  ])

  useEffect(() => {
    hasFittedRef.current = false
  }, [
    hotelEndDate,
    hotelScope,
    hotelStartDate,
    routeScope,
    selectedAirline,
    selectedRoute,
    selectedYear,
    settings.showMarkers,
    topRoutesOnly,
  ])

  useEffect(() => {
    if (!settings.showMarkers) {
      setSelectedHotelId(null)
      return
    }

    if (
      selectedHotelId &&
      !hotelMarkers.some((hotel) => hotel.id === selectedHotelId)
    ) {
      setSelectedHotelId(null)
    }
  }, [hotelMarkers, selectedHotelId, settings.showMarkers])

  useEffect(() => {
    if (
      hotelScope === 'active' &&
      hotelStartDate === '' &&
      hotelEndDate === '' &&
      hotelMarkers.length === 0 &&
      totalHotelMarkers.length > 0
    ) {
      setHotelScope('all')
    }
  }, [
    hotelEndDate,
    hotelMarkers.length,
    hotelScope,
    hotelStartDate,
    totalHotelMarkers.length,
  ])

  useEffect(() => {
    if (!isPlaybackEnabled || !isPlaying || filteredFlights.length <= 1) {
      return
    }

    const intervalId = window.setInterval(
      () => {
        setPlaybackIndex((previous) => {
          if (previous >= filteredFlights.length - 1) {
            setIsPlaying(false)
            return previous
          }
          return previous + 1
        })
      },
      Math.max(350, 1600 / playbackSpeed),
    )

    return () => {
      window.clearInterval(intervalId)
    }
  }, [filteredFlights.length, isPlaybackEnabled, isPlaying, playbackSpeed])

  useEffect(() => {
    if (filteredFlights.length === 0) {
      setPlaybackIndex(0)
      setIsPlaying(false)
      setIsPlaybackEnabled(false)
      return
    }

    setPlaybackIndex((previous) =>
      Math.min(previous, filteredFlights.length - 1),
    )
  }, [filteredFlights.length])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const updateReadyState = () => {
      if (hasVisibleSize(container) && mapRef.current) {
        requestAnimationFrame(() => mapRef.current?.resize())
      }
    }

    updateReadyState()

    const observer = new ResizeObserver(updateReadyState)
    observer.observe(container)
    window.addEventListener('resize', updateReadyState)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateReadyState)
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive || !containerRef.current || mapRef.current) {
      return
    }

    const initialSettings = settingsRef.current
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(initialSettings),
      center: [78.9629, 20.5937],
      zoom: 2.2,
      pitch: DEFAULT_MAP_PITCH,
      bearing: DEFAULT_MAP_BEARING,
      cooperativeGestures: true,
      maxPitch: 85,
    })

    baseStyleKeyRef.current = baseStyleKey
    mapRef.current = map
    sceneControllerRef.current = new FlightMap3DLayerController()
    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'flight-map-popup',
      maxWidth: '240px',
    })

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      'top-right',
    )

    const handleStyleLoad = () => {
      syncMapPresentation(true)
    }

    map.on('style.load', handleStyleLoad)
    map.on('load', () => {
      requestAnimationFrame(() => {
        if (mapRef.current !== map) {
          return
        }

        map.resize()
        syncMapPresentation(true)
      })
    })

    requestAnimationFrame(() => {
      if (mapRef.current !== map) {
        return
      }

      if (map.isStyleLoaded()) {
        syncMapPresentation(true)
      }
    })

    map.on(
      'mouseenter',
      AIRPORT_HIT_LAYER_ID,
      (event: maplibregl.MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = 'pointer'
        const feature = event.features?.[0]
        if (!feature || feature.geometry.type !== 'Point') {
          return
        }

        const coordinates = [...feature.geometry.coordinates] as [
          number,
          number,
        ]
        const properties = feature.properties as
          | {
              city?: string
              country?: string
              iata?: string
              visits?: number | string
            }
          | undefined
        const airportStat = properties?.iata
          ? latestAirportStatsRef.current.get(properties.iata)
          : undefined

        popupRef.current
          ?.setLngLat(coordinates)
          .setHTML(
            `<div class="space-y-1.5"><div class="text-sm font-semibold">${properties?.iata ?? 'Unknown'}</div><div class="text-xs text-muted-foreground">${properties?.city ?? 'Unknown city'}, ${properties?.country ?? 'Unknown country'}</div><div class="text-xs font-medium">Visits: ${properties?.visits ?? 0}</div><div class="text-xs text-muted-foreground">Routes: ${airportStat?.connectedRoutes ?? 0}</div><div class="text-xs text-muted-foreground">Airlines: ${formatAirlineList(airportStat?.airlines ?? [])}</div><div class="text-xs text-muted-foreground">Last active: ${airportStat?.lastYear ?? 'Unknown'}</div></div>`,
          )
          .addTo(map)
      },
    )

    map.on(
      'click',
      AIRPORT_HIT_LAYER_ID,
      (event: maplibregl.MapLayerMouseEvent) => {
        const feature = event.features?.[0]
        if (!feature || feature.geometry.type !== 'Point') {
          return
        }

        map.easeTo({
          center: [...feature.geometry.coordinates] as [number, number],
          zoom: Math.max(map.getZoom(), 12),
          pitch: Math.max(map.getPitch(), 45),
          duration: 900,
          essential: true,
        })
      },
    )

    map.on(
      'mouseenter',
      ROUTE_HIT_LAYER_ID,
      (event: maplibregl.MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = 'pointer'
        const feature = event.features?.[0]
        if (!feature || feature.geometry.type !== 'LineString') {
          return
        }

        const coordinates = feature.geometry.coordinates
        const midpoint = coordinates[
          Math.max(Math.floor(coordinates.length / 2), 0)
        ] as [number, number] | undefined
        if (!midpoint) {
          return
        }

        const properties = feature.properties as
          | {
              from?: string
              to?: string
            }
          | undefined
        const routeKey = getRouteKey(
          properties?.from ?? '',
          properties?.to ?? '',
        )
        const routeStat = latestRouteStatsRef.current.get(routeKey)

        popupRef.current
          ?.setLngLat(midpoint)
          .setHTML(
            `<div class="space-y-1.5"><div class="text-sm font-semibold">${properties?.from ?? 'Unknown'} → ${properties?.to ?? 'Unknown'}</div><div class="text-xs text-muted-foreground">Flights: ${routeStat?.count ?? 0}</div><div class="text-xs text-muted-foreground">Distance: ${routeStat?.distanceKm?.toLocaleString?.() ?? 0} km</div><div class="text-xs text-muted-foreground">Type: ${routeStat?.routeType ?? 'unknown'}</div><div class="text-xs text-muted-foreground">Airlines: ${formatAirlineList(routeStat?.airlines ?? [])}</div><div class="text-xs text-muted-foreground">Years: ${formatYearList(routeStat?.years ?? [])}</div></div>`,
          )
          .addTo(map)
      },
    )

    map.on(
      'mouseenter',
      HOTEL_HIT_LAYER_ID,
      (event: maplibregl.MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = 'pointer'
        const feature = event.features?.[0]
        if (!feature || feature.geometry.type !== 'Point') {
          return
        }

        const coordinates = [...feature.geometry.coordinates] as [
          number,
          number,
        ]
        const properties = feature.properties as
          | {
              id?: string
              hotelName?: string
              city?: string
              country?: string
            }
          | undefined
        const hotelStat = properties?.id
          ? latestHotelStatsRef.current.get(properties.id)
          : undefined
        const stayDates =
          hotelStat?.checkInDate || hotelStat?.checkOutDate
            ? `${formatStayDate(hotelStat?.checkInDate ?? null)} → ${formatStayDate(hotelStat?.checkOutDate ?? null)}`
            : 'Dates not captured'
        const pricing =
          hotelStat?.pricingTotal !== null &&
          hotelStat?.pricingTotal !== undefined
            ? `${hotelStat.pricingCurrency ?? 'Currency unknown'} ${hotelStat.pricingTotal}`
            : 'Pricing not captured'

        popupRef.current
          ?.setLngLat(coordinates)
          .setHTML(
            `<div class="space-y-1.5"><div class="text-sm font-semibold">${properties?.hotelName ?? 'Unknown hotel'}</div><div class="text-xs text-muted-foreground">${properties?.city ?? hotelStat?.city ?? 'Unknown city'}, ${properties?.country ?? hotelStat?.country ?? 'Unknown country'}</div><div class="text-xs font-medium">${stayDates}</div><div class="text-xs text-muted-foreground">Nights: ${hotelStat?.nights ?? 'Unknown'}</div><div class="text-xs text-muted-foreground">${pricing}</div><div class="text-xs text-sky-200">Click to select</div></div>`,
          )
          .addTo(map)
      },
    )

    map.on(
      'click',
      HOTEL_HIT_LAYER_ID,
      (event: maplibregl.MapLayerMouseEvent) => {
        const feature = event.features?.[0]
        if (!feature) {
          return
        }

        const hotelId =
          feature.properties && 'id' in feature.properties
            ? String(feature.properties.id)
            : null

        if (!hotelId) {
          return
        }

        setSelectedHotelId(hotelId)

        if (feature.geometry.type === 'Point') {
          map.easeTo({
            center: [...feature.geometry.coordinates] as [number, number],
            zoom: Math.max(map.getZoom(), 14),
            pitch: Math.max(map.getPitch(), 50),
            duration: 900,
            essential: true,
          })
        }
      },
    )

    map.on('click', (event) => {
      const clickedHotelFeatures = map.queryRenderedFeatures(event.point, {
        layers: [HOTEL_HIT_LAYER_ID],
      })

      if (clickedHotelFeatures.length === 0) {
        setSelectedHotelId(null)
      }
    })

    map.on('mouseleave', AIRPORT_HIT_LAYER_ID, () => {
      map.getCanvas().style.cursor = ''
      popupRef.current?.remove()
    })

    map.on('mouseleave', ROUTE_HIT_LAYER_ID, () => {
      map.getCanvas().style.cursor = ''
      popupRef.current?.remove()
    })

    map.on('mouseleave', HOTEL_HIT_LAYER_ID, () => {
      map.getCanvas().style.cursor = ''
      popupRef.current?.remove()
    })

    return () => {
      sceneControllerRef.current?.destroy()
      sceneControllerRef.current = null
      popupRef.current?.remove()
      popupRef.current = null
      map.remove()
      mapRef.current = null
      hasFittedRef.current = false
      baseStyleKeyRef.current = null
    }
  }, [baseStyleKey, isActive, syncMapPresentation])

  useEffect(() => {
    if (!isActive || !mapRef.current) {
      return
    }

    requestAnimationFrame(() => {
      mapRef.current?.resize()
      syncMapPresentation(true)
    })
  }, [isActive, syncMapPresentation])

  useEffect(() => {
    if (!displayData || !mapRef.current || !mapRef.current.isStyleLoaded()) {
      return
    }

    syncMapPresentation(true)
  }, [
    displayData,
    activeFlight,
    hotelMarkers,
    selectedHotelId,
    syncMapPresentation,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) {
      return
    }

    if (!sceneControllerRef.current) {
      return
    }

    applySettingsToMap(
      map,
      settings,
      sceneControllerRef.current,
      Boolean(activeFlight),
    )
  }, [
    settings.showHeatmap,
    settings.heatmap3d,
    settings.showRoutes,
    settings.showMarkers,
    settings.showLabels,
    settings.routeColor,
    settings.heatmapIntensity,
    settings.projection,
    activeFlight,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (baseStyleKeyRef.current === baseStyleKey) {
      return
    }

    baseStyleKeyRef.current = baseStyleKey
    map.setStyle(getMapStyle(settings))
  }, [baseStyleKey, settings])

  if (mapQuery.isLoading) {
    return <MapSkeleton />
  }

  if (mapQuery.isError || !mapQuery.data) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="px-4 py-6 text-sm text-destructive">
          We couldn’t load your travel map right now. Try again after your
          flight sync completes.
        </CardContent>
      </Card>
    )
  }

  if (
    mapQuery.data.summary.totalFlights === 0 ||
    mapQuery.data.airports.length === 0
  ) {
    return (
      <Card className="border-border/60">
        <CardContent className="px-4 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-4 text-base font-medium text-foreground">
            No mapped flights yet
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Sync flight confirmations first. Airports with known coordinates
            will appear here as soon as they are available.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          Travel Map
        </p>
        <h2 className="text-2xl font-semibold text-foreground">
          Interactive route visualization
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {hasActiveFilters && displayData
            ? `Current filters show ${formatDistance(displayData.summary.totalDistanceKm)} across ${displayData.summary.citiesVisited.toLocaleString()} cities and ${displayData.summary.countriesVisited.toLocaleString()} countries.`
            : `You have flown ${formatDistance(mapQuery.data.summary.totalDistanceKm)} across ${mapQuery.data.summary.citiesVisited.toLocaleString()} cities and ${mapQuery.data.summary.countriesVisited.toLocaleString()} countries.`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((item) => (
          <MetricTrendCard
            key={item.title}
            className="border-border/60 bg-card/95"
            title={item.title}
            value={item.value}
            description={item.description}
            icon={<item.icon className="h-4 w-4 text-primary" />}
            trendData={item.trendData}
            formatTrendValue={item.formatTrendValue}
          />
        ))}
      </div>

      <Card className="overflow-hidden border-border/60">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Travel Map</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Switch between flat and globe projection, enable terrain on
                  satellite, and control overlays without losing route state.
                  Hotel pins follow the main markers toggle.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {displayData?.airports.length ?? 0} airports
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {displayData?.routes.length ?? 0} routes
                </Badge>
                {totalHotelMarkers.length > 0 ? (
                  <Badge variant="outline" className="text-xs">
                    {hotelMarkers.length} / {totalHotelMarkers.length} hotels
                  </Badge>
                ) : null}
                {hasActiveHotelFilters && settings.showMarkers ? (
                  <Badge variant="outline" className="text-xs">
                    Hotel filters
                  </Badge>
                ) : null}
                {selectedHotel ? (
                  <Badge variant="outline" className="text-xs">
                    Hotel selected
                  </Badge>
                ) : null}
                {isPlaybackEnabled ? (
                  <Badge variant="outline" className="text-xs">
                    Playback
                  </Badge>
                ) : null}
                {hasActiveFilters ? (
                  <Badge variant="outline" className="text-xs">
                    Filtered
                  </Badge>
                ) : null}
                <Badge variant="outline" className="text-xs">
                  {settings.projection === 'globe' ? 'Globe' : 'Flat'}
                </Badge>
                {settings.terrainEnabled ? (
                  <Badge variant="outline" className="text-xs">
                    Terrain
                  </Badge>
                ) : null}
                <div className="lg:hidden">
                  <MapControlsPopover
                    settings={settings}
                    onChange={handleSettingsChange}
                  />
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <MapControlsInline
                settings={settings}
                onChange={handleSettingsChange}
              />
            </div>
            <TravelMapLegend />
            <HotelInteractionControls
              hotelCount={hotelMarkers.length}
              scope={hotelScope}
              startDate={hotelStartDate}
              endDate={hotelEndDate}
              onScopeChange={setHotelScope}
              onStartDateChange={setHotelStartDate}
              onEndDateChange={setHotelEndDate}
              onClear={() => {
                setHotelScope('all')
                setHotelStartDate('')
                setHotelEndDate('')
              }}
            />
            {settings.showMarkers &&
            hotelMarkers.length === 0 &&
            totalHotelMarkers.length > 0 ? (
              <div className="flex flex-col gap-3 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-sm lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    Hotel filters are hiding all pins
                  </p>
                  <p className="text-muted-foreground">
                    Clear the hotel filters or switch the scope to reveal the
                    available hotel markers.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHotelScope('all')
                    setHotelStartDate('')
                    setHotelEndDate('')
                  }}
                >
                  Show all hotels
                </Button>
              </div>
            ) : null}
            {selectedHotel ? (
              <div className="rounded-xl border border-sky-400/30 bg-sky-500/5 p-3 text-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">
                        {selectedHotel.hotelName}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        Selected hotel
                      </Badge>
                      {selectedHotel.archivedAt ? (
                        <Badge variant="secondary" className="text-xs">
                          Archived
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground">
                      {selectedHotel.city ?? 'Unknown city'},{' '}
                      {selectedHotel.country ?? 'Unknown country'}
                    </p>
                    <p className="text-muted-foreground">
                      {selectedHotel.checkInDate || selectedHotel.checkOutDate
                        ? `${formatStayDate(selectedHotel.checkInDate)} → ${formatStayDate(selectedHotel.checkOutDate)}`
                        : 'Dates not captured'}
                    </p>
                    <p className="text-muted-foreground">
                      {formatHotelPricing(selectedHotel)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedHotelId(null)}
                  >
                    Clear selection
                  </Button>
                </div>
              </div>
            ) : null}
            <FlightInteractionControls
              airlineOptions={airlineOptions}
              routeOptions={routeOptions}
              routeScope={routeScope}
              selectedAirline={selectedAirline}
              selectedRoute={selectedRoute}
              selectedYear={selectedYear}
              topRoutesOnly={topRoutesOnly}
              yearOptions={yearOptions}
              onAirlineChange={(value) => {
                setSelectedAirline(value)
                setSelectedRoute('all')
              }}
              onRouteChange={setSelectedRoute}
              onRouteScopeChange={(value) => {
                setRouteScope(value)
                setSelectedRoute('all')
              }}
              onTopRoutesChange={setTopRoutesOnly}
              onYearChange={(value) => {
                setSelectedYear(value)
                setSelectedRoute('all')
              }}
            />
            {filteredFlights.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No flights match the current filters. Clear a filter to bring
                routes back into view.
              </p>
            ) : null}
            <TimelinePlaybackControls
              activeFlight={activeFlight}
              currentIndex={boundedPlaybackIndex}
              enabled={isPlaybackEnabled}
              isPlaying={isPlaying}
              onEnabledChange={handlePlaybackEnabledChange}
              onPlayPause={() => {
                if (!isPlaybackEnabled) {
                  setIsPlaybackEnabled(true)
                }
                if (boundedPlaybackIndex >= filteredFlights.length - 1) {
                  setPlaybackIndex(0)
                }
                setIsPlaying((previous) => !previous)
              }}
              onReset={() => {
                setIsPlaying(false)
                setPlaybackIndex(0)
              }}
              onStep={handlePlaybackStep}
              onValueChange={(nextIndex) => {
                setIsPlaying(false)
                setPlaybackIndex(nextIndex)
              }}
              setSpeed={setPlaybackSpeed}
              speed={playbackSpeed}
              totalFlights={filteredFlights.length}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="h-140 w-full"
            data-map-active={isActive ? 'true' : 'false'}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export {
  AIRPORT_LAYER_ID,
  AIRPORT_HIT_LAYER_ID,
  AIRPORT_LABEL_LAYER_ID,
  AIRPORT_OVERVIEW_LAYER_ID,
  HEATMAP_LAYER_ID,
  HOTEL_HIT_LAYER_ID,
  HOTEL_LABEL_LAYER_ID,
  HOTEL_LAYER_ID,
  ROUTE_GLOW_LAYER_ID,
  ROUTE_LINE_LAYER_ID,
  STORAGE_KEY,
  SATELLITE_LABEL_LAYER_ID,
}

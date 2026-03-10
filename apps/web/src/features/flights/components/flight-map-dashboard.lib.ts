import type { FlightMap } from '@workspace/domain'
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

export type MapStyleName = 'satellite' | 'light' | 'dark' | 'voyager'
export type MapProjection = 'mercator' | 'globe'

export interface MapSettings {
  mapStyle: MapStyleName
  projection: MapProjection
  terrainEnabled: boolean
  showHeatmap: boolean
  showRoutes: boolean
  showMarkers: boolean
  showLabels: boolean
  routeColor: string
  heatmapIntensity: number
}

export const ROUTE_COLOR_PRESETS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#eab308', label: 'Gold' },
  { value: '#84cc16', label: 'Lime' },
  { value: '#a855f7', label: 'Purple' },
] as const

export const MAP_STYLE_OPTIONS: { value: MapStyleName, label: string }[] = [
  { value: 'satellite', label: 'Satellite' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'voyager', label: 'Voyager' },
]

export const DEFAULT_SETTINGS: MapSettings = {
  mapStyle: 'satellite',
  projection: 'mercator',
  terrainEnabled: false,
  showHeatmap: true,
  showRoutes: true,
  showMarkers: true,
  showLabels: true,
  routeColor: '#ef4444',
  heatmapIntensity: 1,
}

export const STORAGE_KEY = 'flight-map-settings'

export const SATELLITE_BASE_LAYER_ID = 'satellite-layer'
export const SATELLITE_LABEL_LAYER_ID = 'satellite-labels'
export const TERRAIN_HILLSHADE_LAYER_ID = 'terrain-hillshade'

const SATELLITE_TILE_URL
  = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const SATELLITE_LABEL_TILE_URL
  = 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
const TERRAIN_TILEJSON_URL
  = 'https://demotiles.maplibre.org/terrain-tiles/tiles.json'

export function supportsTerrain(mapStyle: MapStyleName): boolean {
  return mapStyle === 'satellite'
}

export function sanitizeSettings(input: Partial<MapSettings>): MapSettings {
  const next = {
    ...DEFAULT_SETTINGS,
    ...input,
  } satisfies MapSettings

  if (!supportsTerrain(next.mapStyle)) {
    next.terrainEnabled = false
  }

  return next
}

export function loadSettings(): MapSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return sanitizeSettings(JSON.parse(raw) as Partial<MapSettings>)
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: MapSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage failures in unsupported environments.
  }
}

export function getMapStyle(settings: MapSettings): StyleSpecification | string {
  switch (settings.mapStyle) {
    case 'satellite': {
      return {
        version: 8,
        projection: { type: settings.projection },
        sources: {
          satellite: {
            type: 'raster',
            tiles: [SATELLITE_TILE_URL],
            tileSize: 256,
            attribution:
              '&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
          },
          satelliteLabels: {
            type: 'raster',
            tiles: [SATELLITE_LABEL_TILE_URL],
            tileSize: 256,
            attribution: '&copy; Esri',
          },
          ...(settings.terrainEnabled
            ? {
                terrainDem: {
                  type: 'raster-dem',
                  url: TERRAIN_TILEJSON_URL,
                  tileSize: 256,
                },
                terrainHillshade: {
                  type: 'raster-dem',
                  url: TERRAIN_TILEJSON_URL,
                  tileSize: 256,
                },
              }
            : {}),
        },
        layers: [
          {
            id: SATELLITE_BASE_LAYER_ID,
            type: 'raster',
            source: 'satellite',
            paint: {
              'raster-brightness-max': 0.88,
              'raster-saturation': -0.1,
              'raster-contrast': 0.08,
            },
          },
          ...(settings.terrainEnabled
            ? ([
                {
                  id: TERRAIN_HILLSHADE_LAYER_ID,
                  type: 'hillshade',
                  source: 'terrainHillshade',
                  paint: {
                    'hillshade-exaggeration': 0.3,
                    'hillshade-shadow-color': 'rgba(15, 23, 42, 0.45)',
                    'hillshade-highlight-color': 'rgba(255, 255, 255, 0.28)',
                    'hillshade-accent-color': 'rgba(56, 189, 248, 0.12)',
                  },
                } satisfies LayerSpecification,
              ] as LayerSpecification[])
            : []),
          {
            id: SATELLITE_LABEL_LAYER_ID,
            type: 'raster',
            source: 'satelliteLabels',
            paint: {
              'raster-opacity': 0.95,
            },
          },
        ],
      }
    }
    case 'light': {
      return 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
    }
    case 'dark': {
      return 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    }
    case 'voyager': {
      return 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
    }
  }
}

export function buildAirportFeatureCollection(data: FlightMap) {
  return {
    type: 'FeatureCollection' as const,
    features: data.airports.map((airport) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [airport.lng, airport.lat],
      },
      properties: {
        iata: airport.iata,
        city: airport.city ?? 'Unknown city',
        country: airport.country ?? 'Unknown country',
        visits: airport.visits,
      },
    })),
  }
}

export function buildRouteFeatureCollection(data: FlightMap) {
  return {
    type: 'FeatureCollection' as const,
    features: data.routes.map((route) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: route.path,
      },
      properties: {
        from: route.from,
        to: route.to,
        count: route.count,
      },
    })),
  }
}

export function getOverlayAnchorId(
  layers: LayerSpecification[] | undefined,
  customLayerIds: string[] = [],
): string | undefined {
  if (!layers) {
    return undefined
  }

  for (const layer of layers) {
    if (customLayerIds.includes(layer.id)) {
      continue
    }

    if (layer.id === SATELLITE_LABEL_LAYER_ID) {
      return layer.id
    }

    if (layer.type === 'symbol' && hasTextField(layer)) {
      return layer.id
    }
  }

  return undefined
}

export function getBaseLabelLayerIds(
  layers: LayerSpecification[] | undefined,
  customLayerIds: string[] = [],
): string[] {
  if (!layers) {
    return []
  }

  return layers
    .filter((layer) => {
      if (customLayerIds.includes(layer.id)) {
        return false
      }

      if (layer.id === SATELLITE_LABEL_LAYER_ID) {
        return true
      }

      return layer.type === 'symbol' && hasTextField(layer)
    })
    .map((layer) => layer.id)
}

function hasTextField(layer: LayerSpecification): boolean {
  if (layer.type !== 'symbol') {
    return false
  }

  const textField = layer.layout?.['text-field']
  return textField !== undefined && textField !== null
}

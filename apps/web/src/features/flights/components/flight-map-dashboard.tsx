import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl/dist/maplibre-gl-csp";
import maplibreglWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?url";
import {
  Globe2,
  MapPinned,
  Palette,
  Route,
  Settings2,
  Sparkles,
} from "lucide-react";

import { useFlightMap } from "@/features/flights/api/flights";
import {
  AIRPORT_MIN_ZOOM,
  FLIGHT_SCENE_LAYER_ID,
  FlightMap3DLayerController,
} from "@/features/flights/components/flight-map-dashboard.3d";
import {
  DEFAULT_SETTINGS,
  MAP_STYLE_OPTIONS,
  ROUTE_COLOR_PRESETS,
  SATELLITE_LABEL_LAYER_ID,
  STORAGE_KEY,
  TERRAIN_HILLSHADE_LAYER_ID,
  buildAirportFeatureCollection,
  buildRouteFeatureCollection,
  getBaseLabelLayerIds,
  getMapStyle,
  getOverlayAnchorId,
  loadSettings,
  sanitizeSettings,
  saveSettings,
  supportsTerrain,
  type MapSettings,
  type MapStyleName,
} from "@/features/flights/components/flight-map-dashboard.lib";
import { Badge } from "@workspace/ui/components/ui/badge";
import { Button } from "@workspace/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/ui/card";
import { Label } from "@workspace/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/ui/select";
import { Separator } from "@workspace/ui/components/ui/separator";
import { Skeleton } from "@workspace/ui/components/ui/skeleton";
import { Slider } from "@workspace/ui/components/ui/slider";
import { Switch } from "@workspace/ui/components/ui/switch";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/ui/toggle-group";

import type { FlightMap } from "@workspace/domain";
import type { LayerSpecification } from "maplibre-gl";

maplibregl.setWorkerUrl(maplibreglWorkerUrl);

const AIRPORT_SOURCE_ID = "flight-map-airports";
const ROUTE_SOURCE_ID = "flight-map-routes";
const HEATMAP_LAYER_ID = "flight-map-heatmap";
const AIRPORT_OVERVIEW_LAYER_ID = "flight-map-airports-overview";
const AIRPORT_HIT_LAYER_ID = "flight-map-airports-hit";
const AIRPORT_LABEL_LAYER_ID = "flight-map-airports-labels";
const AIRPORT_LAYER_ID = AIRPORT_OVERVIEW_LAYER_ID;
const ROUTE_GLOW_LAYER_ID = FLIGHT_SCENE_LAYER_ID;
const ROUTE_LINE_LAYER_ID = FLIGHT_SCENE_LAYER_ID;
const DEFAULT_MAP_PITCH = 54;
const DEFAULT_MAP_BEARING = -18;
const CUSTOM_LAYER_IDS = [
  HEATMAP_LAYER_ID,
  AIRPORT_OVERVIEW_LAYER_ID,
  AIRPORT_HIT_LAYER_ID,
  AIRPORT_LABEL_LAYER_ID,
  FLIGHT_SCENE_LAYER_ID,
];

function formatDistance(value: number) {
  return `${value.toLocaleString()} km`;
}

function hasVisibleSize(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function MapSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-[560px] w-full rounded-3xl" />
    </div>
  );
}

function getOverlayBeforeId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle().layers as LayerSpecification[] | undefined;
  return getOverlayAnchorId(layers, CUSTOM_LAYER_IDS);
}

function ensureMapSources(map: maplibregl.Map) {
  if (!map.getSource(AIRPORT_SOURCE_ID)) {
    map.addSource(AIRPORT_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getSource(ROUTE_SOURCE_ID)) {
    map.addSource(ROUTE_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
}

function addLayerIfMissing(
  map: maplibregl.Map,
  layer: LayerSpecification,
  beforeId?: string,
) {
  if (map.getLayer(layer.id)) {
    return;
  }

  map.addLayer(layer, beforeId);
}

function ensureMapLayers(map: maplibregl.Map, settings: MapSettings) {
  ensureMapSources(map);

  const beforeId = getOverlayBeforeId(map);

  addLayerIfMissing(
    map,
    {
      id: HEATMAP_LAYER_ID,
      type: "heatmap",
      source: AIRPORT_SOURCE_ID,
      maxzoom: 7,
      paint: {
        "heatmap-weight": [
          "interpolate",
          ["linear"],
          ["get", "visits"],
          1,
          0.35,
          12,
          1.45,
        ],
        "heatmap-intensity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          1.5 * settings.heatmapIntensity,
          7,
          3 * settings.heatmapIntensity,
        ],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 28, 7, 64],
        "heatmap-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.92,
          8,
          0.32,
        ],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(29, 78, 216, 0.08)",
          0.2,
          "rgba(59, 130, 246, 0.5)",
          0.45,
          "rgba(14, 165, 233, 0.72)",
          0.7,
          "rgba(34, 197, 94, 0.82)",
          1,
          "rgba(249, 115, 22, 0.95)",
        ],
      },
    },
    beforeId,
  );

  addLayerIfMissing(
    map,
    {
      id: AIRPORT_OVERVIEW_LAYER_ID,
      type: "circle",
      source: AIRPORT_SOURCE_ID,
      minzoom: 2,
      maxzoom: AIRPORT_MIN_ZOOM + 0.2,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "visits"],
          1,
          8,
          12,
          20,
        ],
        "circle-color": "#f97316",
        "circle-opacity": 0.98,
        "circle-stroke-color": "#fff7ed",
        "circle-stroke-width": 2,
      },
    },
    beforeId,
  );

  addLayerIfMissing(
    map,
    {
      id: AIRPORT_HIT_LAYER_ID,
      type: "circle",
      source: AIRPORT_SOURCE_ID,
      minzoom: 2,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "visits"],
          1,
          14,
          12,
          30,
        ],
        "circle-color": "#f8fafc",
        "circle-opacity": 0,
        "circle-stroke-opacity": 0,
      },
    },
    beforeId,
  );

  addLayerIfMissing(
    map,
    {
      id: AIRPORT_LABEL_LAYER_ID,
      type: "symbol",
      source: AIRPORT_SOURCE_ID,
      minzoom: Math.max(0, AIRPORT_MIN_ZOOM - 0.2),
      layout: {
        "text-field": [
          "format",
          ["get", "iata"],
          { "font-scale": 1 },
          "\n",
          {},
          ["get", "city"],
          { "font-scale": 0.82 },
        ],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 8, 13],
        "text-line-height": 1.1,
        "text-letter-spacing": 0.04,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Regular"],
      },
      paint: {
        "text-color": "#f8fafc",
        "text-halo-color": "rgba(15, 23, 42, 0.94)",
        "text-halo-width": 1.35,
      },
    },
    beforeId,
  );
}

function ensureFlightSceneLayer(
  map: maplibregl.Map,
  sceneController: FlightMap3DLayerController,
) {
  if (map.getLayer(FLIGHT_SCENE_LAYER_ID)) {
    return;
  }

  map.addLayer(sceneController.layer, getOverlayBeforeId(map));
}

function updateMapData(
  map: maplibregl.Map,
  data: FlightMap,
  sceneController: FlightMap3DLayerController,
) {
  const airportSource = map.getSource(AIRPORT_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;
  const routeSource = map.getSource(ROUTE_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;

  airportSource?.setData(buildAirportFeatureCollection(data));
  routeSource?.setData(buildRouteFeatureCollection(data));
  sceneController.setData(data);
}

function fitMapToAirports(map: maplibregl.Map, data: FlightMap) {
  if (data.airports.length === 0) {
    return;
  }

  if (data.airports.length === 1) {
    map.flyTo({
      center: [data.airports[0].lng, data.airports[0].lat],
      zoom: 4,
      pitch: DEFAULT_MAP_PITCH,
      bearing: DEFAULT_MAP_BEARING,
      essential: true,
    });
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  for (const airport of data.airports) {
    bounds.extend([airport.lng, airport.lat]);
  }

  map.fitBounds(bounds, {
    padding: 72,
    duration: 1200,
    pitch: DEFAULT_MAP_PITCH,
    bearing: DEFAULT_MAP_BEARING,
    essential: true,
  });
}

function applySettingsToMap(
  map: maplibregl.Map,
  settings: MapSettings,
  sceneController: FlightMap3DLayerController,
) {
  const setVis = (id: string, visible: boolean) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  };

  setVis(HEATMAP_LAYER_ID, settings.showHeatmap);
  setVis(AIRPORT_OVERVIEW_LAYER_ID, true);
  setVis(AIRPORT_HIT_LAYER_ID, true);
  setVis(AIRPORT_LABEL_LAYER_ID, settings.showLabels);

  const labelLayerIds = getBaseLabelLayerIds(
    map.getStyle().layers as LayerSpecification[] | undefined,
    CUSTOM_LAYER_IDS,
  );

  for (const layerId of labelLayerIds) {
    setVis(layerId, settings.showLabels);
  }

  if (map.getLayer(HEATMAP_LAYER_ID)) {
    map.setPaintProperty(HEATMAP_LAYER_ID, "heatmap-intensity", [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      1.5 * settings.heatmapIntensity,
      7,
      3 * settings.heatmapIntensity,
    ]);
  }

  map.setProjection({ type: settings.projection });

  if (supportsTerrain(settings.mapStyle) && settings.terrainEnabled) {
    if (map.getSource("terrainDem")) {
      map.setTerrain({ source: "terrainDem", exaggeration: 1.18 });
    }
    if (map.getLayer(TERRAIN_HILLSHADE_LAYER_ID)) {
      map.setLayoutProperty(
        TERRAIN_HILLSHADE_LAYER_ID,
        "visibility",
        "visible",
      );
    }
  } else {
    map.setTerrain(null);
    if (map.getLayer(TERRAIN_HILLSHADE_LAYER_ID)) {
      map.setLayoutProperty(TERRAIN_HILLSHADE_LAYER_ID, "visibility", "none");
    }
  }
  sceneController.setSettings({
    showMarkers: settings.showMarkers,
    showRoutes: settings.showRoutes,
    glowTint: settings.routeColor,
  });

  if (settings.terrainEnabled && map.getPitch() < 45) {
    map.easeTo({
      pitch: DEFAULT_MAP_PITCH,
      bearing: DEFAULT_MAP_BEARING,
      duration: 900,
      essential: true,
    });
  } else if (!settings.terrainEnabled && map.getPitch() < 30) {
    map.easeTo({
      pitch: DEFAULT_MAP_PITCH,
      bearing: DEFAULT_MAP_BEARING,
      duration: 900,
      essential: true,
    });
  }
}

function MapControlsInline({
  settings,
  onChange,
}: {
  settings: MapSettings;
  onChange: (patch: Partial<MapSettings>) => void;
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
          <SelectTrigger className="h-7 w-[110px] text-xs">
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
            if (value === "mercator" || value === "globe") {
              onChange({ projection: value });
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

      <Separator orientation="vertical" className="hidden h-5 lg:block" />

      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">
          <Palette className="inline h-3 w-3 mr-1" />
          Route
        </Label>
        <ToggleGroup
          type="single"
          value={settings.routeColor}
          onValueChange={(value) => {
            if (value) {
              onChange({ routeColor: value });
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
      </div>

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
  );
}

function MapControlsPopover({
  settings,
  onChange,
}: {
  settings: MapSettings;
  onChange: (patch: Partial<MapSettings>) => void;
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
              if (value === "mercator" || value === "globe") {
                onChange({ projection: value });
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
              { key: "showHeatmap", label: "Heatmap" },
              { key: "showRoutes", label: "Routes" },
              { key: "showMarkers", label: "Markers" },
              { key: "showLabels", label: "Labels" },
              { key: "terrainEnabled", label: "Terrain" },
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
                  item.key === "terrainEnabled" &&
                  !supportsTerrain(settings.mapStyle)
                }
                className="scale-75"
              />
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label className="text-xs">Route Color</Label>
          <ToggleGroup
            type="single"
            value={settings.routeColor}
            onValueChange={(value) => {
              if (value) {
                onChange({ routeColor: value });
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
        </div>

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
  );
}

export interface FlightMapDashboardProps {
  isActive: boolean;
}

export function FlightMapDashboard({ isActive }: FlightMapDashboardProps) {
  const mapQuery = useFlightMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const sceneControllerRef = useRef<FlightMap3DLayerController | null>(null);
  const hasFittedRef = useRef(false);
  const latestDataRef = useRef<FlightMap | null>(null);
  const settingsRef = useRef<MapSettings>(DEFAULT_SETTINGS);
  const baseStyleKeyRef = useRef<string | null>(null);

  const [settings, setSettings] = useState<MapSettings>(loadSettings);

  settingsRef.current = settings;
  latestDataRef.current = mapQuery.data ?? null;

  const baseStyleKey = `${settings.mapStyle}:${settings.terrainEnabled ? "terrain" : "flat"}`;

  const handleSettingsChange = useCallback((patch: Partial<MapSettings>) => {
    setSettings((previous) => {
      const next = sanitizeSettings({ ...previous, ...patch });
      saveSettings(next);
      return next;
    });
  }, []);

  const syncMapPresentation = useCallback(
    (fitToData: boolean) => {
      const map = mapRef.current;
      const data = latestDataRef.current;

      if (!map || !map.isStyleLoaded()) {
        return;
      }

      const currentSettings = settingsRef.current;
      ensureMapLayers(map, currentSettings);
      if (!sceneControllerRef.current) {
        sceneControllerRef.current = new FlightMap3DLayerController();
      }
      ensureFlightSceneLayer(map, sceneControllerRef.current);
      applySettingsToMap(map, currentSettings, sceneControllerRef.current);

      if (!data) {
        return;
      }

      updateMapData(map, data, sceneControllerRef.current);
      applySettingsToMap(map, currentSettings, sceneControllerRef.current);

      if (fitToData && !hasFittedRef.current && isActive) {
        fitMapToAirports(map, data);
        hasFittedRef.current = true;
      }

      requestAnimationFrame(() => {
        map.resize();
        map.triggerRepaint();
      });
    },
    [isActive, mapQuery.data],
  );

  const summaryCards = useMemo(() => {
    if (!mapQuery.data) {
      return [];
    }

    return [
      {
        title: "Distance Flown",
        value: formatDistance(mapQuery.data.summary.totalDistanceKm),
        description: "Backend-calculated across mapped routes",
        icon: Globe2,
      },
      {
        title: "Cities Reached",
        value: mapQuery.data.summary.citiesVisited.toLocaleString(),
        description: "Unique airport cities across your history",
        icon: MapPinned,
      },
      {
        title: "Routes Visualized",
        value: mapQuery.data.routes.length.toLocaleString(),
        description: `${mapQuery.data.summary.totalFlights.toLocaleString()} mapped flights`,
        icon: Route,
      },
    ];
  }, [mapQuery.data]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateReadyState = () => {
      if (hasVisibleSize(container) && mapRef.current) {
        requestAnimationFrame(() => mapRef.current?.resize());
      }
    };

    updateReadyState();

    const observer = new ResizeObserver(updateReadyState);
    observer.observe(container);
    window.addEventListener("resize", updateReadyState);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateReadyState);
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !containerRef.current || mapRef.current) {
      return;
    }

    const initialSettings = settingsRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(initialSettings),
      center: [78.9629, 20.5937],
      zoom: 2.2,
      pitch: DEFAULT_MAP_PITCH,
      bearing: DEFAULT_MAP_BEARING,
      cooperativeGestures: true,
      maxPitch: 85,
    });

    baseStyleKeyRef.current = baseStyleKey;
    mapRef.current = map;
    sceneControllerRef.current = new FlightMap3DLayerController();
    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "flight-map-popup",
      maxWidth: "240px",
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );

    const handleStyleLoad = () => {
      syncMapPresentation(true);
    };

    map.on("style.load", handleStyleLoad);
    map.on("load", () => {
      requestAnimationFrame(() => {
        if (mapRef.current !== map) {
          return;
        }

        map.resize();
        syncMapPresentation(true);
      });
    });

    requestAnimationFrame(() => {
      if (mapRef.current !== map) {
        return;
      }

      if (map.isStyleLoaded()) {
        syncMapPresentation(true);
      }
    });

    map.on(
      "mouseenter",
      AIRPORT_HIT_LAYER_ID,
      (event: maplibregl.MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") {
          return;
        }

        const coordinates = [...feature.geometry.coordinates] as [
          number,
          number,
        ];
        const properties = feature.properties as
          | {
              city?: string;
              country?: string;
              iata?: string;
              visits?: number | string;
            }
          | undefined;

        popupRef.current
          ?.setLngLat(coordinates)
          .setHTML(
            `<div class="space-y-1"><div class="text-sm font-semibold">${properties?.iata ?? "Unknown"}</div><div class="text-xs text-muted-foreground">${properties?.city ?? "Unknown city"}, ${properties?.country ?? "Unknown country"}</div><div class="text-xs font-medium">Visits: ${properties?.visits ?? 0}</div></div>`,
          )
          .addTo(map);
      },
    );

    map.on("mouseleave", AIRPORT_HIT_LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
      popupRef.current?.remove();
    });

    return () => {
      sceneControllerRef.current?.destroy();
      sceneControllerRef.current = null;
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      hasFittedRef.current = false;
      baseStyleKeyRef.current = null;
    };
  }, [isActive, mapQuery.data, syncMapPresentation]);

  useEffect(() => {
    if (!isActive || !mapRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      mapRef.current?.resize();
      syncMapPresentation(true);
    });
  }, [isActive, syncMapPresentation]);

  useEffect(() => {
    if (!mapQuery.data || !mapRef.current || !mapRef.current.isStyleLoaded()) {
      return;
    }

    syncMapPresentation(true);
  }, [mapQuery.data, syncMapPresentation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    if (!sceneControllerRef.current) {
      return;
    }

    applySettingsToMap(map, settings, sceneControllerRef.current);
  }, [
    settings.showHeatmap,
    settings.showRoutes,
    settings.showMarkers,
    settings.showLabels,
    settings.routeColor,
    settings.heatmapIntensity,
    settings.projection,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (baseStyleKeyRef.current === baseStyleKey) {
      return;
    }

    baseStyleKeyRef.current = baseStyleKey;
    map.setStyle(getMapStyle(settings));
  }, [baseStyleKey, settings]);

  if (mapQuery.isLoading) {
    return <MapSkeleton />;
  }

  if (mapQuery.isError || !mapQuery.data) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="px-4 py-6 text-sm text-destructive">
          We couldn’t load your travel map right now. Try again after your
          flight sync completes.
        </CardContent>
      </Card>
    );
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
    );
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
          You have flown {formatDistance(mapQuery.data.summary.totalDistanceKm)}{" "}
          across {mapQuery.data.summary.citiesVisited.toLocaleString()} cities
          and {mapQuery.data.summary.countriesVisited.toLocaleString()}{" "}
          countries.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((item) => (
          <Card key={item.title} className="border-border/60 bg-card/95">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.title}
              </CardTitle>
              <span data-slot="badge">
                <item.icon className="h-4 w-4 text-primary" />
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">
                {item.value}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.description}
              </p>
            </CardContent>
          </Card>
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
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {mapQuery.data.airports.length} airports
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {mapQuery.data.routes.length} routes
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {settings.projection === "globe" ? "Globe" : "Flat"}
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
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="h-[560px] w-full"
            data-map-active={isActive ? "true" : "false"}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export {
  AIRPORT_LAYER_ID,
  AIRPORT_HIT_LAYER_ID,
  AIRPORT_LABEL_LAYER_ID,
  AIRPORT_OVERVIEW_LAYER_ID,
  HEATMAP_LAYER_ID,
  ROUTE_GLOW_LAYER_ID,
  ROUTE_LINE_LAYER_ID,
  STORAGE_KEY,
  SATELLITE_LABEL_LAYER_ID,
};

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import {
  Globe2,
  MapPinned,
  Palette,
  Route,
  Settings2,
  Sparkles,
} from "lucide-react";

import { useFlightMap } from "@/features/flights/api/flights";
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

// ---------------------------------------------------------------------------
// Map settings types & defaults
// ---------------------------------------------------------------------------

type MapStyleName = "satellite" | "light" | "dark" | "voyager";

interface MapSettings {
  mapStyle: MapStyleName;
  showHeatmap: boolean;
  showRoutes: boolean;
  showMarkers: boolean;
  showLabels: boolean;
  routeColor: string;
  heatmapIntensity: number;
}

const ROUTE_COLOR_PRESETS = [
  { value: "#ef4444", label: "Red" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#eab308", label: "Gold" },
  { value: "#84cc16", label: "Lime" },
  { value: "#a855f7", label: "Purple" },
] as const;

const MAP_STYLE_OPTIONS: { value: MapStyleName; label: string }[] = [
  { value: "satellite", label: "Satellite" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "voyager", label: "Voyager" },
];

const DEFAULT_SETTINGS: MapSettings = {
  mapStyle: "satellite",
  showHeatmap: true,
  showRoutes: true,
  showMarkers: true,
  showLabels: true,
  routeColor: "#ef4444",
  heatmapIntensity: 1.0,
};

const STORAGE_KEY = "flight-map-settings";

function loadSettings(): MapSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as MapSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: MapSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Silently ignore storage errors
  }
}

// ---------------------------------------------------------------------------
// Map style specs — all public, no API key
// ---------------------------------------------------------------------------

function getMapStyle(
  name: MapStyleName,
): maplibregl.StyleSpecification | string {
  switch (name) {
    case "satellite":
      return {
        version: 8,
        sources: {
          satellite: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            attribution:
              "&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
          },
          labels: {
            type: "vector",
            url: "https://demotiles.maplibre.org/tiles/tiles.json",
          },
        },
        layers: [
          {
            id: "satellite-layer",
            type: "raster",
            source: "satellite",
            paint: {
              "raster-brightness-max": 0.85,
              "raster-saturation": -0.2,
              "raster-contrast": 0.1,
            },
          },
          {
            id: "country-label",
            type: "symbol",
            source: "labels",
            "source-layer": "country",
            layout: {
              "text-field": ["get", "name_en"],
              "text-size": 14,
            },
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "#000000",
              "text-halo-width": 1,
            },
          },
          {
            id: "city-label",
            type: "symbol",
            source: "labels",
            "source-layer": "place",
            layout: {
              "text-field": ["get", "name"],
              "text-size": 12,
            },
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "#000000",
              "text-halo-width": 1,
            },
          },
        ],
      };
    case "light":
      return "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
    case "dark":
      return "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
    case "voyager":
      return "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AIRPORT_SOURCE_ID = "flight-map-airports";
const ROUTE_SOURCE_ID = "flight-map-routes";
const HEATMAP_LAYER_ID = "flight-map-heatmap";
const AIRPORT_LAYER_ID = "flight-map-airports-circle";
const ROUTE_GLOW_LAYER_ID = "flight-map-routes-glow";
const ROUTE_LINE_LAYER_ID = "flight-map-routes-line";

function lightenColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lighten = (c: number) => Math.min(255, c + Math.round((255 - c) * 0.5));
  return `rgba(${lighten(r)}, ${lighten(g)}, ${lighten(b)}, 0.55)`;
}

function createAirportMarkerElement(visits: number) {
  const marker = document.createElement("button");
  const size = Math.max(18, Math.min(34, 14 + visits * 2));

  marker.type = "button";
  marker.setAttribute("aria-label", `Airport marker with ${visits} visits`);
  marker.style.width = `${size}px`;
  marker.style.height = `${size}px`;
  marker.style.borderRadius = "9999px";
  marker.style.border = "2px solid rgba(255, 247, 237, 0.95)";
  marker.style.background =
    "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.96), rgba(249,115,22,0.95) 45%, rgba(194,65,12,0.98) 100%)";
  marker.style.boxShadow =
    "0 0 0 6px rgba(249, 115, 22, 0.18), 0 10px 30px rgba(15, 23, 42, 0.24)";
  marker.style.cursor = "pointer";
  marker.style.padding = "0";

  return marker;
}

function formatDistance(value: number) {
  return `${value.toLocaleString()} km`;
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

function buildAirportFeatureCollection(data: FlightMap) {
  return {
    type: "FeatureCollection" as const,
    features: data.airports.map((airport) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [airport.lng, airport.lat],
      },
      properties: {
        iata: airport.iata,
        city: airport.city ?? "Unknown city",
        country: airport.country ?? "Unknown country",
        visits: airport.visits,
      },
    })),
  };
}

function buildRouteFeatureCollection(data: FlightMap) {
  return {
    type: "FeatureCollection" as const,
    features: data.routes.map((route) => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: route.path,
      },
      properties: {
        from: route.from,
        to: route.to,
        count: route.count,
      },
    })),
  };
}

function ensureMapLayers(map: maplibregl.Map, settings: MapSettings) {
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

  if (!map.getLayer(HEATMAP_LAYER_ID)) {
    map.addLayer({
      id: HEATMAP_LAYER_ID,
      type: "heatmap",
      source: AIRPORT_SOURCE_ID,
      maxzoom: 6,
      layout: { visibility: settings.showHeatmap ? "visible" : "none" },
      paint: {
        "heatmap-weight": [
          "interpolate",
          ["linear"],
          ["get", "visits"],
          1,
          0.4,
          12,
          1.4,
        ],
        "heatmap-intensity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          1.1 * settings.heatmapIntensity,
          7,
          2.2 * settings.heatmapIntensity,
        ],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 22, 7, 48],
        "heatmap-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.82,
          8,
          0.2,
        ],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(29, 78, 216, 0.08)",
          0.2,
          "rgba(59, 130, 246, 0.52)",
          0.45,
          "rgba(14, 165, 233, 0.7)",
          0.7,
          "rgba(34, 197, 94, 0.82)",
          1,
          "rgba(249, 115, 22, 0.96)",
        ],
      },
    });
  }

  if (!map.getLayer(ROUTE_GLOW_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_GLOW_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: settings.showRoutes ? "visible" : "none",
      },
      paint: {
        "line-color": lightenColor(settings.routeColor),
        "line-opacity": 0.55,
        "line-blur": 6,
        "line-width": [
          "interpolate",
          ["linear"],
          ["get", "count"],
          1,
          6,
          6,
          16,
        ],
      },
    });
  }

  if (!map.getLayer(ROUTE_LINE_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_LINE_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: settings.showRoutes ? "visible" : "none",
      },
      paint: {
        "line-color": settings.routeColor,
        "line-opacity": 0.96,
        "line-width": [
          "interpolate",
          ["linear"],
          ["get", "count"],
          1,
          2.5,
          6,
          7,
        ],
      },
    });
  }

  if (!map.getLayer(AIRPORT_LAYER_ID)) {
    map.addLayer({
      id: AIRPORT_LAYER_ID,
      type: "circle",
      source: AIRPORT_SOURCE_ID,
      minzoom: 2,
      layout: { visibility: settings.showMarkers ? "visible" : "none" },
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
    });
  }
}

function updateMapData(map: maplibregl.Map, data: FlightMap) {
  const airportSource = map.getSource(AIRPORT_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;
  const routeSource = map.getSource(ROUTE_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;

  airportSource?.setData(buildAirportFeatureCollection(data));
  routeSource?.setData(buildRouteFeatureCollection(data));
}

function syncAirportMarkers(
  map: maplibregl.Map,
  data: FlightMap,
  markerRefs: { current: maplibregl.Marker[] },
) {
  for (const marker of markerRefs.current) {
    marker.remove();
  }

  markerRefs.current = data.airports.map((airport) => {
    const popup = new maplibregl.Popup({
      offset: 18,
      closeButton: false,
    }).setHTML(
      `<div><div style="font-weight:600;font-size:13px;">${airport.iata}</div><div style="font-size:12px;opacity:0.78;">${airport.city ?? "Unknown city"}, ${airport.country ?? "Unknown country"}</div><div style="font-size:12px;font-weight:600;margin-top:2px;">Visits: ${airport.visits}</div></div>`,
    );

    return new maplibregl.Marker({
      element: createAirportMarkerElement(airport.visits),
    })
      .setLngLat([airport.lng, airport.lat])
      .setPopup(popup)
      .addTo(map);
  });
}

function fitMapToAirports(map: maplibregl.Map, data: FlightMap) {
  if (data.airports.length === 0) {
    return;
  }

  if (data.airports.length === 1) {
    map.flyTo({
      center: [data.airports[0].lng, data.airports[0].lat],
      zoom: 4,
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
    essential: true,
  });
}

// ---------------------------------------------------------------------------
// Apply settings to a live map instance
// ---------------------------------------------------------------------------

function applySettingsToMap(map: maplibregl.Map, settings: MapSettings) {
  const setVis = (id: string, visible: boolean) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  };

  setVis(HEATMAP_LAYER_ID, settings.showHeatmap);
  setVis(ROUTE_GLOW_LAYER_ID, settings.showRoutes);
  setVis(ROUTE_LINE_LAYER_ID, settings.showRoutes);
  setVis(AIRPORT_LAYER_ID, settings.showMarkers);
  setVis("country-label", settings.showLabels);
  setVis("city-label", settings.showLabels);

  if (map.getLayer(ROUTE_LINE_LAYER_ID)) {
    map.setPaintProperty(
      ROUTE_LINE_LAYER_ID,
      "line-color",
      settings.routeColor,
    );
  }
  if (map.getLayer(ROUTE_GLOW_LAYER_ID)) {
    map.setPaintProperty(
      ROUTE_GLOW_LAYER_ID,
      "line-color",
      lightenColor(settings.routeColor),
    );
  }

  if (map.getLayer(HEATMAP_LAYER_ID)) {
    map.setPaintProperty(HEATMAP_LAYER_ID, "heatmap-intensity", [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      1.1 * settings.heatmapIntensity,
      7,
      2.2 * settings.heatmapIntensity,
    ]);
  }
}

// ---------------------------------------------------------------------------
// MapControls — inline (desktop)
// ---------------------------------------------------------------------------

function MapControlsInline({
  settings,
  onChange,
}: {
  settings: MapSettings;
  onChange: (patch: Partial<MapSettings>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      {/* Map style */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">
          Style
        </Label>
        <Select
          value={settings.mapStyle}
          onValueChange={(v) => onChange({ mapStyle: v as MapStyleName })}
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

      {/* Layer toggles */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Switch
            id="toggle-heatmap"
            checked={settings.showHeatmap}
            onCheckedChange={(v) => onChange({ showHeatmap: v })}
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
            onCheckedChange={(v) => onChange({ showRoutes: v })}
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
            onCheckedChange={(v) => onChange({ showMarkers: v })}
            className="scale-75"
          />
          <Label htmlFor="toggle-markers" className="text-xs cursor-pointer">
            Markers
          </Label>
        </div>
        {settings.mapStyle === "satellite" && (
          <div className="flex items-center gap-1.5">
            <Switch
              id="toggle-labels"
              checked={settings.showLabels}
              onCheckedChange={(v) => onChange({ showLabels: v })}
              className="scale-75"
            />
            <Label htmlFor="toggle-labels" className="text-xs cursor-pointer">
              Labels
            </Label>
          </div>
        )}
      </div>

      <Separator orientation="vertical" className="hidden h-5 lg:block" />

      {/* Route color presets */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">
          <Palette className="inline h-3 w-3 mr-1" />
          Route
        </Label>
        <ToggleGroup
          type="single"
          value={settings.routeColor}
          onValueChange={(v) => {
            if (v) onChange({ routeColor: v });
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

      {/* Heatmap intensity slider */}
      {settings.showHeatmap && (
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
              onValueChange={([v]) => onChange({ heatmapIntensity: v })}
              className="w-20"
            />
            <span className="text-xs tabular-nums text-muted-foreground w-7">
              {settings.heatmapIntensity.toFixed(1)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MapControls — popover (mobile)
// ---------------------------------------------------------------------------

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

        {/* Map style */}
        <div className="space-y-1.5">
          <Label className="text-xs">Base Map</Label>
          <Select
            value={settings.mapStyle}
            onValueChange={(v) => onChange({ mapStyle: v as MapStyleName })}
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

        {/* Layer toggles */}
        <div className="space-y-2">
          <Label className="text-xs">Layers</Label>
          {(
            [
              { key: "showHeatmap", label: "Heatmap" },
              { key: "showRoutes", label: "Routes" },
              { key: "showMarkers", label: "Markers" },
              ...(settings.mapStyle === "satellite"
                ? [{ key: "showLabels", label: "Labels" }]
                : []),
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
                onCheckedChange={(v) => onChange({ [item.key]: v })}
                className="scale-75"
              />
            </div>
          ))}
        </div>

        <Separator />

        {/* Route color */}
        <div className="space-y-1.5">
          <Label className="text-xs">Route Color</Label>
          <ToggleGroup
            type="single"
            value={settings.routeColor}
            onValueChange={(v) => {
              if (v) onChange({ routeColor: v });
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

        {/* Heatmap intensity */}
        {settings.showHeatmap && (
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
                onValueChange={([v]) => onChange({ heatmapIntensity: v })}
              />
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// FlightMapDashboard
// ---------------------------------------------------------------------------

export function FlightMapDashboard() {
  const mapQuery = useFlightMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const hasFittedRef = useRef(false);
  const latestDataRef = useRef<FlightMap | null>(null);
  const settingsRef = useRef<MapSettings>(DEFAULT_SETTINGS);

  const [settings, setSettings] = useState<MapSettings>(loadSettings);

  settingsRef.current = settings;
  latestDataRef.current = mapQuery.data ?? null;

  const handleSettingsChange = useCallback((patch: Partial<MapSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const summaryCards = useMemo(() => {
    if (!mapQuery.data) return [];

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

  // --- Initialize map ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(settingsRef.current.mapStyle),
      center: [78.9629, 20.5937],
      zoom: 2.2,
      cooperativeGestures: true,
    });

    mapRef.current = map;
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

    map.on("load", () => {
      const s = settingsRef.current;
      ensureMapLayers(map, s);

      if (latestDataRef.current) {
        updateMapData(map, latestDataRef.current);
        syncAirportMarkers(map, latestDataRef.current, markerRefs);
        applySettingsToMap(map, s);

        for (const m of markerRefs.current) {
          m.getElement().style.display = s.showMarkers ? "" : "none";
        }

        if (!hasFittedRef.current) {
          fitMapToAirports(map, latestDataRef.current);
          hasFittedRef.current = true;
        }
      }
    });

    map.on("mouseenter", AIRPORT_LAYER_ID, (event) => {
      map.getCanvas().style.cursor = "pointer";
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;

      const coordinates = [...feature.geometry.coordinates] as [number, number];
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
    });

    map.on("mouseleave", AIRPORT_LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
      popupRef.current?.remove();
    });

    return () => {
      for (const marker of markerRefs.current) marker.remove();
      markerRefs.current = [];
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      hasFittedRef.current = false;
    };
  }, []);

  // --- ResizeObserver ---
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [mapQuery.data]);

  // --- Sync data onto map ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapQuery.data) return;

    const applyLatestData = () => {
      const s = settingsRef.current;
      ensureMapLayers(map, s);
      updateMapData(map, mapQuery.data);
      syncAirportMarkers(map, mapQuery.data, markerRefs);
      applySettingsToMap(map, s);

      for (const m of markerRefs.current) {
        m.getElement().style.display = s.showMarkers ? "" : "none";
      }

      if (!hasFittedRef.current) {
        fitMapToAirports(map, mapQuery.data);
        hasFittedRef.current = true;
      }

      requestAnimationFrame(() => map.resize());
    };

    if (!map.isStyleLoaded()) {
      map.once("idle", applyLatestData);
      return () => {
        map.off("idle", applyLatestData);
      };
    }

    applyLatestData();
  }, [mapQuery.data]);

  // --- React to settings changes (layer visibility, colors, intensity) ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    applySettingsToMap(map, settings);

    for (const m of markerRefs.current) {
      m.getElement().style.display = settings.showMarkers ? "" : "none";
    }
  }, [
    settings.showHeatmap,
    settings.showRoutes,
    settings.showMarkers,
    settings.showLabels,
    settings.routeColor,
    settings.heatmapIntensity,
  ]);

  // --- React to map style change (full style swap) ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const newStyle = getMapStyle(settings.mapStyle);
    map.setStyle(newStyle);

    const reapply = () => {
      const s = settingsRef.current;
      ensureMapLayers(map, s);

      if (latestDataRef.current) {
        updateMapData(map, latestDataRef.current);
        syncAirportMarkers(map, latestDataRef.current, markerRefs);

        for (const m of markerRefs.current) {
          m.getElement().style.display = s.showMarkers ? "" : "none";
        }
      }

      applySettingsToMap(map, s);
    };

    map.once("idle", reapply);
    return () => {
      map.off("idle", reapply);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.mapStyle]);

  // --- Render ---

  if (mapQuery.isLoading) return <MapSkeleton />;

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
        <CardHeader className="border-b border-border/60 bg-card/90">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Travel Map</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Customize layers, colors, and base map to your preference.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {mapQuery.data.airports.length} airports
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {mapQuery.data.routes.length} routes
                </Badge>
                {/* Mobile: popover */}
                <div className="lg:hidden">
                  <MapControlsPopover
                    settings={settings}
                    onChange={handleSettingsChange}
                  />
                </div>
              </div>
            </div>
            {/* Desktop: inline controls */}
            <div className="hidden lg:block">
              <MapControlsInline
                settings={settings}
                onChange={handleSettingsChange}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={containerRef} className="h-[560px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

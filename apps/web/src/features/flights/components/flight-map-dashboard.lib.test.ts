import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  SATELLITE_LABEL_LAYER_ID,
  STORAGE_KEY,
  buildRouteFeatureCollection,
  getOverlayAnchorId,
  loadSettings,
  saveSettings,
} from "@/features/flights/components/flight-map-dashboard.lib";

import type { FlightMap } from "@workspace/domain";
import type { LayerSpecification } from "maplibre-gl";

describe("flight-map-dashboard helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses backend route geometry for the route feature collection", () => {
    const mapData = {
      airports: [],
      flights: [],
      summary: {
        totalFlights: 1,
        totalDistanceKm: 1234,
        citiesVisited: 2,
        countriesVisited: 1,
      },
      routes: [
        {
          from: "BLR",
          to: "IXB",
          fromLat: 13.1979,
          fromLng: 77.7063,
          toLat: 26.6812,
          toLng: 88.3286,
          count: 3,
          path: [
            [77.7063, 13.1979],
            [82.5, 20.4],
            [88.3286, 26.6812],
          ],
        },
      ],
    } satisfies FlightMap;

    expect(buildRouteFeatureCollection(mapData)).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: mapData.routes[0].path,
          },
          properties: {
            from: "BLR",
            to: "IXB",
            count: 3,
          },
        },
      ],
    });
  });

  it("chooses the first text or label anchor layer for overlay insertion", () => {
    const layers = [
      {
        id: "background",
        type: "background",
      },
      {
        id: "water",
        type: "fill",
      },
      {
        id: SATELLITE_LABEL_LAYER_ID,
        type: "raster",
      },
    ] as LayerSpecification[];

    expect(getOverlayAnchorId(layers)).toBe(SATELLITE_LABEL_LAYER_ID);

    const vectorLayers = [
      {
        id: "background",
        type: "background",
      },
      {
        id: "road",
        type: "line",
      },
      {
        id: "place-label",
        type: "symbol",
        layout: {
          "text-field": ["get", "name"],
        },
      },
    ] as LayerSpecification[];

    expect(getOverlayAnchorId(vectorLayers)).toBe("place-label");
  });

  it("round-trips projection and terrain settings through localStorage", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      projection: "globe" as const,
      terrainEnabled: true,
      routeColor: "#06b6d4",
    };

    saveSettings(settings);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject(
      settings,
    );
    expect(loadSettings()).toEqual(settings);
  });
});

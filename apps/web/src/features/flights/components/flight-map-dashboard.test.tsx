import { render, screen, waitFor } from "@/testing";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AIRPORT_LAYER_ID,
  HEATMAP_LAYER_ID,
  ROUTE_GLOW_LAYER_ID,
  ROUTE_LINE_LAYER_ID,
  SATELLITE_LABEL_LAYER_ID,
  FlightMapDashboard,
} from "@/features/flights/components/flight-map-dashboard";

import type { FlightMap } from "@workspace/domain";

const mapRuntime = vi.hoisted(() => ({
  useFlightMapMock: vi.fn(),
  mapInstances: [] as any[],
}));

vi.mock("@/features/flights/api/flights", () => ({
  useFlightMap: () => mapRuntime.useFlightMapMock(),
}));

vi.mock("maplibre-gl", () => {
  class MockGeoJSONSource {
    setData = vi.fn();
  }

  class MockPopup {
    setLngLat = vi.fn(() => this);
    setHTML = vi.fn(() => this);
    addTo = vi.fn(() => this);
    remove = vi.fn();
  }

  class MockMarker {
    element: HTMLElement;

    constructor(options?: { element?: HTMLElement }) {
      this.element = options?.element ?? document.createElement("div");
    }

    setLngLat = vi.fn(() => this);
    setPopup = vi.fn(() => this);
    addTo = vi.fn(() => this);
    remove = vi.fn();
    getElement = vi.fn(() => this.element);
  }

  class MockBounds {
    extend = vi.fn(() => this);
  }

  class MockMap {
    style: {
      layers: Array<Record<string, unknown>>;
      sources: Record<string, unknown>;
    };
    sources = new Map<string, unknown>();
    eventHandlers = new Map<string, Set<(...args: unknown[]) => void>>();
    canvas = { style: { cursor: "" } };
    currentPitch = 0;

    addControl = vi.fn();
    addLayer = vi.fn((layer: Record<string, unknown>, beforeId?: string) => {
      const nextLayer = { ...layer, beforeId };
      const layers = [...this.style.layers];
      const insertIndex =
        beforeId !== undefined
          ? layers.findIndex((entry) => entry.id === beforeId)
          : -1;

      if (insertIndex >= 0) {
        layers.splice(insertIndex, 0, nextLayer);
      } else {
        layers.push(nextLayer);
      }

      this.style.layers = layers;
    });
    addSource = vi.fn((id: string, source: Record<string, unknown>) => {
      const nextSource =
        source.type === "geojson" ? new MockGeoJSONSource() : source;
      this.sources.set(id, nextSource);
    });
    easeTo = vi.fn((options: { pitch?: number }) => {
      this.currentPitch = options.pitch ?? this.currentPitch;
    });
    fitBounds = vi.fn();
    flyTo = vi.fn();
    getCanvas = vi.fn(() => this.canvas);
    getLayer = vi.fn((id: string) =>
      this.style.layers.find((layer) => layer.id === id) ?? undefined,
    );
    getPitch = vi.fn(() => this.currentPitch);
    getSource = vi.fn((id: string) => this.sources.get(id));
    getStyle = vi.fn(() => this.style);
    isStyleLoaded = vi.fn(() => true);
    off = vi.fn((event: string, handler?: (...args: unknown[]) => void) => {
      if (!handler) {
        return;
      }
      this.eventHandlers.get(event)?.delete(handler);
    });
    on = vi.fn(
      (
        event: string,
        layerIdOrHandler: string | ((...args: unknown[]) => void),
        handlerMaybe?: (...args: unknown[]) => void,
      ) => {
        const handler =
          typeof layerIdOrHandler === "function"
            ? layerIdOrHandler
            : handlerMaybe;

        if (!handler) {
          return this;
        }

        if (!this.eventHandlers.has(event)) {
          this.eventHandlers.set(event, new Set());
        }

        this.eventHandlers.get(event)?.add(handler);
        return this;
      },
    );
    remove = vi.fn();
    resize = vi.fn();
    setLayoutProperty = vi.fn();
    setPaintProperty = vi.fn();
    setProjection = vi.fn();
    setStyle = vi.fn((style: Record<string, unknown>) => {
      this.setBaseStyle(style);
      this.emit("style.load");
    });
    setTerrain = vi.fn();
    triggerRepaint = vi.fn();

    constructor(options: { style: Record<string, unknown> }) {
      this.style = { layers: [], sources: {} };
      this.setBaseStyle(options.style);
    }

    emit(event: string) {
      for (const handler of this.eventHandlers.get(event) ?? []) {
        handler();
      }
    }

    private setBaseStyle(style: Record<string, unknown>) {
      const styleLayers = Array.isArray(style.layers) ? style.layers : [];
      const styleSources =
        style.sources && typeof style.sources === "object"
          ? (style.sources as Record<string, unknown>)
          : {};

      this.style = {
        layers: styleLayers as Array<Record<string, unknown>>,
        sources: styleSources,
      };
      this.sources = new Map(Object.entries(styleSources));
    }
  }

  return {
    default: {
      Map: class extends MockMap {
        constructor(options: { style: Record<string, unknown> }) {
          super(options);
          mapRuntime.mapInstances.push(this);
        }
      },
      NavigationControl: class {
        constructor(_options?: unknown) {}
      },
      Popup: MockPopup,
      Marker: MockMarker,
      LngLatBounds: MockBounds,
    },
  };
});

const sampleMap = {
  airports: [
    {
      iata: "BLR",
      lat: 13.1979,
      lng: 77.7063,
      city: "Bengaluru",
      country: "India",
      timezone: "Asia/Kolkata",
      visits: 4,
    },
    {
      iata: "IXB",
      lat: 26.6812,
      lng: 88.3286,
      city: "Bagdogra",
      country: "India",
      timezone: "Asia/Kolkata",
      visits: 2,
    },
  ],
  routes: [
    {
      from: "BLR",
      to: "IXB",
      fromLat: 13.1979,
      fromLng: 77.7063,
      toLat: 26.6812,
      toLng: 88.3286,
      count: 2,
      path: [
        [77.7063, 13.1979],
        [88.3286, 26.6812],
      ],
    },
  ],
  flights: [
    {
      date: "2025-10-20",
      from: "BLR",
      to: "IXB",
      fromLat: 13.1979,
      fromLng: 77.7063,
      toLat: 26.6812,
      toLng: 88.3286,
      airline: "Air India",
      flightNumber: "AI123",
    },
  ],
  summary: {
    totalFlights: 1,
    totalDistanceKm: 1864,
    citiesVisited: 2,
    countriesVisited: 1,
  },
} satisfies FlightMap;

describe("FlightMapDashboard", () => {
  beforeEach(() => {
    mapRuntime.mapInstances.length = 0;
    localStorage.clear();
    mapRuntime.useFlightMapMock.mockReturnValue({
      data: sampleMap,
      isLoading: false,
      isError: false,
    });

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 960,
      height: 560,
      top: 0,
      left: 0,
      right: 960,
      bottom: 560,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes only after the map tab becomes active and resizes immediately", async () => {
    const { rerender } = render(<FlightMapDashboard isActive={false} />);

    expect(mapRuntime.mapInstances).toHaveLength(0);

    rerender(<FlightMapDashboard isActive />);

    await waitFor(() => {
      expect(mapRuntime.mapInstances).toHaveLength(1);
      expect(mapRuntime.mapInstances[0]?.resize).toHaveBeenCalled();
    });
  });

  it("toggles overlays and projection against the live map instance", async () => {
    const user = userEvent.setup();
    render(<FlightMapDashboard isActive />);

    await waitFor(() => {
      expect(mapRuntime.mapInstances).toHaveLength(1);
    });

    const map = mapRuntime.mapInstances[0]!;

    await waitFor(() => {
      expect(map.getLayer(ROUTE_GLOW_LAYER_ID)).toBeTruthy();
      expect(map.getLayer(ROUTE_LINE_LAYER_ID)).toBeTruthy();
      expect(map.getLayer(HEATMAP_LAYER_ID)).toBeTruthy();
    });

    const [heatmapSwitch, routesSwitch, , labelsSwitch, terrainSwitch] =
      screen.getAllByRole("switch");
    const globeButton = screen.getByRole("radio", { name: "Globe" });

    await user.click(routesSwitch);

    await waitFor(() => {
      expect(map.setLayoutProperty.mock.calls).toContainEqual([
        ROUTE_GLOW_LAYER_ID,
        "visibility",
        "none",
      ]);
      expect(map.setLayoutProperty.mock.calls).toContainEqual([
        ROUTE_LINE_LAYER_ID,
        "visibility",
        "none",
      ]);
    });

    await user.click(heatmapSwitch);

    await waitFor(() => {
      expect(map.setLayoutProperty.mock.calls).toContainEqual([
        HEATMAP_LAYER_ID,
        "visibility",
        "none",
      ]);
    });

    await user.click(labelsSwitch);

    await waitFor(() => {
      expect(map.setLayoutProperty.mock.calls).toContainEqual([
        SATELLITE_LABEL_LAYER_ID,
        "visibility",
        "none",
      ]);
    });

    await user.click(globeButton);

    await waitFor(() => {
      expect(map.setProjection).toHaveBeenCalledWith({ type: "globe" });
    });

    await user.click(terrainSwitch);

    await waitFor(() => {
      expect(map.setStyle).toHaveBeenCalled();
      expect(map.getLayer(AIRPORT_LAYER_ID)).toBeTruthy();
    });
  });
});

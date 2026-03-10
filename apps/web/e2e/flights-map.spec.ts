import { expect, test } from "./fixtures";

const sessionResponse = {
  user: {
    id: "user-1",
    email: "traveler@example.com",
    name: "Traveler",
  },
  session: {
    id: "session-1",
    userId: "user-1",
    expiresAt: "2026-12-31T00:00:00.000Z",
  },
};

const flightActivitiesResponse = {
  object: "list",
  data: [
    {
      id: "activity-1",
      userId: "user-1",
      sourceEmailId: "email-1",
      activityType: "booking_confirmation",
      extractionMethod: ["json_ld"],
      canonicalHash: "hash-1",
      segmentIndex: 0,
      pnr: "H5LTYZ",
      airlineName: "Air India",
      flightNumber: "AI123",
      fromAirport: "BLR",
      toAirport: "IXB",
      departureDate: "2025-10-20",
      departureTime: "08:00",
      arrivalDate: "2025-10-20",
      arrivalTime: "10:45",
      departureAt: null,
      arrivalAt: null,
      departureTimezone: null,
      arrivalTimezone: null,
      travelClass: "economy",
      confidence: 1,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
  ],
  page: 1,
  page_size: 20,
  total: 1,
  has_more: false,
};

const flightAnalyticsResponse = {
  overview: {
    totalFlights: 1,
    totalDistanceKm: 1864,
    countriesVisited: 1,
    citiesVisited: 2,
    totalFlightTimeHours: 2.8,
  },
  insights: {
    mostVisitedAirport: {
      iata: "BLR",
      count: 4,
    },
    mostFrequentRoute: {
      from: "BLR",
      to: "IXB",
      count: 1,
    },
    favoriteAirline: {
      airline: "Air India",
      count: 1,
    },
    longestFlight: {
      from: "BLR",
      to: "IXB",
      distanceKm: 1864,
    },
    domesticFlights: 1,
    internationalFlights: 0,
  },
  breakdowns: {
    flightsByYear: [{ year: 2025, count: 1 }],
    airlineDistribution: [{ airline: "Air India", count: 1 }],
    airportFrequency: [
      { airport: "BLR", count: 4 },
      { airport: "IXB", count: 2 },
    ],
  },
  timeline: [
    {
      date: "2025-10-20",
      fromAirport: "BLR",
      toAirport: "IXB",
      airline: "Air India",
      flightNumber: "AI123",
    },
  ],
};

const flightMapResponse = {
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
};

test("renders the map on first tab visit and keeps controls interactive", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("access_token", "test-access-token");
    window.localStorage.setItem("refresh_token", "test-refresh-token");
  });

  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ status: 200, json: sessionResponse }),
  );
  await page.route("**/api/expenses/gmail/status", (route) =>
    route.fulfill({
      status: 200,
      json: { connected: true, email: "traveler@example.com" },
    }),
  );
  await page.route("**/api/flights/activities**", (route) =>
    route.fulfill({ status: 200, json: flightActivitiesResponse }),
  );
  await page.route("**/api/flights/analytics", (route) =>
    route.fulfill({ status: 200, json: flightAnalyticsResponse }),
  );
  await page.route("**/api/flights/map", (route) =>
    route.fulfill({ status: 200, json: flightMapResponse }),
  );

  await page.goto("/flights");
  await page.getByRole("tab", { name: "Map" }).click();

  await expect(page.locator(".maplibregl-canvas")).toBeVisible();

  await page.getByRole("button", { name: "Globe" }).click();
  await expect(page.locator('[data-slot="badge"]').filter({ hasText: "Globe" })).toBeVisible();

  const terrainSwitch = page.getByRole("switch", { name: "Terrain" });
  await terrainSwitch.click();
  await expect(page.locator('[data-slot="badge"]').filter({ hasText: "Terrain" })).toBeVisible();

  const routesSwitch = page.getByRole("switch", { name: "Routes" });
  await expect(routesSwitch).toHaveAttribute("aria-checked", "true");
  await routesSwitch.click();
  await expect(routesSwitch).toHaveAttribute("aria-checked", "false");
  await routesSwitch.click();
  await expect(routesSwitch).toHaveAttribute("aria-checked", "true");
});

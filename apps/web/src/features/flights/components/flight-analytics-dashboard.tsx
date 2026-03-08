import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Flag, Globe2, Map, Plane, Route, Timer, Trophy } from "lucide-react";

import { useFlightAnalytics } from "@/features/flights/api/flights";
import { Badge } from "@workspace/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/ui/chart";
import { ScrollArea } from "@workspace/ui/components/ui/scroll-area";
import { Separator } from "@workspace/ui/components/ui/separator";
import { Skeleton } from "@workspace/ui/components/ui/skeleton";

import type { FlightAnalytics } from "@workspace/domain";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const yearChartConfig = {
  count: { label: "Flights", color: "var(--color-chart-1)" },
} satisfies ChartConfig;

const airlineChartConfig = {
  count: { label: "Flights", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

const airportChartConfig = {
  count: { label: "Visits", color: "var(--color-chart-3)" },
} satisfies ChartConfig;

function formatDistance(value: number) {
  return `${value.toLocaleString()} km`;
}

function formatHours(value: number) {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })} hrs`;
}

function formatTimelineDate(value: string) {
  try {
    return format(parseISO(value), "MMM d");
  } catch {
    return value;
  }
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

function OverviewCards({ data }: { data: FlightAnalytics }) {
  const items = [
    {
      title: "Total Flights",
      value: data.overview.totalFlights.toLocaleString(),
      description: "Captured flight segments",
      icon: Plane,
    },
    {
      title: "Total Distance",
      value: formatDistance(data.overview.totalDistanceKm),
      description: "All enriched routes combined",
      icon: Globe2,
    },
    {
      title: "Countries Visited",
      value: data.overview.countriesVisited.toLocaleString(),
      description: "Unique countries touched",
      icon: Flag,
    },
    {
      title: "Cities Visited",
      value: data.overview.citiesVisited.toLocaleString(),
      description: "Unique airport cities touched",
      icon: Map,
    },
    {
      title: "Total Time Flying",
      value: formatHours(data.overview.totalFlightTimeHours),
      description: "Summed across known durations",
      icon: Timer,
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.title} className="border-border/60">
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
  );
}

function InsightCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-lg font-semibold text-foreground">{value}</div>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function InsightsSection({ data }: { data: FlightAnalytics }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Travel Insights
        </h2>
        <p className="text-sm text-muted-foreground">
          Ranked patterns computed on the backend from your stored itineraries.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <InsightCard
          title="Most Visited Airport"
          value={
            data.insights.mostVisitedAirport
              ? `${data.insights.mostVisitedAirport.iata} (${data.insights.mostVisitedAirport.count})`
              : "No airport data yet"
          }
          description="Departure and arrival touches both count as airport visits."
        />
        <InsightCard
          title="Most Frequent Route"
          value={
            data.insights.mostFrequentRoute
              ? `${data.insights.mostFrequentRoute.from} → ${data.insights.mostFrequentRoute.to} (${data.insights.mostFrequentRoute.count})`
              : "No route data yet"
          }
          description="Repeated segment pair across all captured flights."
        />
        <InsightCard
          title="Favorite Airline"
          value={
            data.insights.favoriteAirline
              ? `${data.insights.favoriteAirline.airline} (${data.insights.favoriteAirline.count})`
              : "No airline data yet"
          }
          description="Based on airline names present in stored segments."
        />
        <InsightCard
          title="Longest Flight"
          value={
            data.insights.longestFlight
              ? `${data.insights.longestFlight.from} → ${data.insights.longestFlight.to} (${data.insights.longestFlight.distanceKm} km)`
              : "No distance data yet"
          }
          description="Great-circle distance from airport coordinates."
        />
        <InsightCard
          title="Domestic vs International"
          value={`${data.insights.domesticFlights} domestic / ${data.insights.internationalFlights} international`}
          description="Computed from origin and destination country metadata."
        />
        <Card className="border-border/60 bg-card/90">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dashboard Scope
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Total timeline entries</span>
              <Badge variant="outline">{data.timeline.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Airlines represented</span>
              <Badge variant="outline">
                {data.breakdowns.airlineDistribution.length}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Airports represented</span>
              <Badge variant="outline">
                {data.breakdowns.airportFrequency.length}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function BreakdownSection({ data }: { data: FlightAnalytics }) {
  const airportPieData = data.breakdowns.airportFrequency.slice(0, 5);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Travel Breakdown
        </h2>
        <p className="text-sm text-muted-foreground">
          Visual summaries sourced directly from the analytics endpoint.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Flights by Year</CardTitle>
            <CardDescription>Year-over-year segment count</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={yearChartConfig}
              className="h-[280px] w-full"
            >
              <BarChart data={data.breakdowns.flightsByYear}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="year" tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  radius={[10, 10, 0, 0]}
                  fill="var(--color-count)"
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Airline Distribution</CardTitle>
            <CardDescription>Which carriers show up most often</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={airlineChartConfig}
              className="h-[280px] w-full"
            >
              <BarChart
                data={data.breakdowns.airlineDistribution.slice(0, 8)}
                layout="vertical"
              >
                <CartesianGrid horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  dataKey="airline"
                  type="category"
                  width={100}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  radius={[0, 10, 10, 0]}
                  fill="var(--color-count)"
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Airport Frequency</CardTitle>
            <CardDescription>
              Top airport touches across departures and arrivals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <ChartContainer
                config={airportChartConfig}
                chartType="pie"
                className="h-[260px] w-full"
              >
                <PieChart>
                  <ChartTooltip
                    content={<ChartTooltipContent nameKey="airport" />}
                  />
                  <Pie
                    data={airportPieData}
                    dataKey="count"
                    nameKey="airport"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={3}
                  >
                    {airportPieData.map((entry, index) => (
                      <Cell
                        key={entry.airport}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <ChartLegend
                    content={<ChartLegendContent nameKey="airport" />}
                  />
                </PieChart>
              </ChartContainer>

              <div className="space-y-3">
                {data.breakdowns.airportFrequency
                  .slice(0, 8)
                  .map((entry, index) => (
                    <div
                      key={entry.airport}
                      className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor:
                              CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                        <div>
                          <div className="font-medium text-foreground">
                            {entry.airport}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Airport touch count
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">{entry.count}</Badge>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Breakdown Highlights</CardTitle>
            <CardDescription>
              Quick rankings from the same backend payload
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {data.breakdowns.airlineDistribution
                .slice(0, 5)
                .map((entry, index) => (
                  <div key={entry.airline} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">
                        {entry.airline}
                      </span>
                      <span className="text-muted-foreground">
                        {entry.count} flights
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${(entry.count / Math.max(data.overview.totalFlights, 1)) * 100}%`,
                          backgroundColor:
                            CHART_COLORS[index % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>

            <Separator />

            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Years with travel</span>
                <span className="font-medium text-foreground">
                  {data.breakdowns.flightsByYear.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Top route occurrences</span>
                <span className="font-medium text-foreground">
                  {data.insights.mostFrequentRoute?.count ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Most visited airport touches</span>
                <span className="font-medium text-foreground">
                  {data.insights.mostVisitedAirport?.count ?? 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function TimelineSection({ data }: { data: FlightAnalytics }) {
  const groupedTimeline = useMemo(() => {
    return data.timeline.reduce<Record<string, FlightAnalytics["timeline"]>>(
      (accumulator, entry) => {
        const year = entry.date.slice(0, 4);
        accumulator[year] ??= [];
        accumulator[year].push(entry);
        return accumulator;
      },
      {},
    );
  }, [data.timeline]);

  const years = Object.keys(groupedTimeline).sort((left, right) =>
    right.localeCompare(left),
  );

  return (
    <section className="space-y-4 mb-10">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Flight Timeline
        </h2>
        <p className="text-sm text-muted-foreground">
          Chronological flight history, grouped by departure year.
        </p>
      </div>

      <Card className="border-border/60">
        <CardContent className="pt-6">
          {years.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center">
              <p className="text-base font-medium text-foreground">
                No timeline yet
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Sync flights first to build your travel history.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[420px] pr-4">
              <div className="space-y-8">
                {years.map((year) => (
                  <div key={year} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{year}</Badge>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                    <div className="space-y-3">
                      {groupedTimeline[year].map((entry, index) => (
                        <div
                          key={`${year}-${entry.date}-${entry.fromAirport}-${entry.toAirport}-${index}`}
                          className="rounded-xl border border-border/60 px-4 py-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="flex items-center gap-2 text-base font-medium text-foreground">
                                <Route className="h-4 w-4 text-primary" />
                                <span>
                                  {entry.fromAirport} → {entry.toAirport}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {entry.airline}
                                {entry.flightNumber
                                  ? ` ${entry.flightNumber}`
                                  : ""}
                              </p>
                            </div>
                            <Badge variant="secondary">
                              {formatTimelineDate(entry.date)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export function FlightAnalyticsDashboard() {
  const analyticsQuery = useFlightAnalytics();

  if (analyticsQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (analyticsQuery.isError || !analyticsQuery.data) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="px-4 py-6 text-sm text-destructive">
          We couldn’t load travel analytics right now. Try again once flight
          sync is complete.
        </CardContent>
      </Card>
    );
  }

  if (analyticsQuery.data.overview.totalFlights === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="px-4 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-4 text-base font-medium text-foreground">
            No flight analytics yet
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect Gmail and sync booking emails to generate your travel
            dashboard.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <OverviewCards data={analyticsQuery.data} />
      <InsightsSection data={analyticsQuery.data} />
      <BreakdownSection data={analyticsQuery.data} />
      <TimelineSection data={analyticsQuery.data} />
    </div>
  );
}

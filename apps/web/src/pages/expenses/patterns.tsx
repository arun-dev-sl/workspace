import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { MainLayout } from "@/components/layouts";
import { fetchBusAnalytics } from "@/features/expenses/api/bus-analytics";
import { fetchInvestmentAnalytics } from "@/features/expenses/api/investment-analytics";
import { PrincipalInvestmentTab } from "@/features/principal/components/principal-tab";

import type {
  AnalyticsPeriod,
  BusAnalytics,
  InvestmentAnalytics,
} from "@workspace/domain";

import { Badge } from "@workspace/ui/components/ui/badge";
import { Button } from "@workspace/ui/components/ui/button";
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
import { Skeleton } from "@workspace/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/ui/tabs";
import {
  Bus,
  Calendar,
  Clock,
  IndianRupee,
  MapPin,
  TrendingUp,
  Coins,
  Activity,
  Repeat,
  Wallet,
} from "lucide-react";
import { Separator } from "@workspace/ui/components/ui/separator";

// ── Helpers ──

const PERIODS: { label: string; value: AnalyticsPeriod }[] = [
  { label: "30 days", value: "month" },
  { label: "90 days", value: "quarter" },
  { label: "1 year", value: "year" },
];

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const DAY_COLORS: Record<string, string> = {
  Mon: "var(--color-chart-1)",
  Tue: "var(--color-chart-2)",
  Wed: "var(--color-chart-3)",
  Thu: "var(--color-chart-4)",
  Fri: "var(--color-chart-5)",
  Sat: "var(--color-chart-1)",
  Sun: "var(--color-chart-2)",
};

// ── Chart Configs ──

const monthlyChartConfig: ChartConfig = {
  trips: { label: "Trips", color: "var(--color-chart-1)" },
  amount: { label: "Spent", color: "var(--color-chart-2)" },
};

const dayOfWeekChartConfig: ChartConfig = {
  trips: { label: "Trips", color: "var(--color-chart-1)" },
};

const timeOfDayChartConfig: ChartConfig = {
  trips: { label: "Trips", color: "var(--color-chart-3)" },
};

const dailyFrequencyChartConfig: ChartConfig = {
  trips: { label: "Trips", color: "var(--color-chart-4)" },
};

// ── Summary Cards ──

function SummaryCards({ data }: { data: BusAnalytics }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
          <IndianRupee className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {fmtCurrency(data.totalSpent)}
          </div>
          <p className="text-muted-foreground text-xs">
            across {data.totalTrips} trips
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Fare</CardTitle>
          <TrendingUp className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{fmtCurrency(data.avgFare)}</div>
          <p className="text-muted-foreground text-xs">per bus trip</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unique Buses</CardTitle>
          <Bus className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.uniqueBuses}</div>
          <p className="text-muted-foreground text-xs">different bus numbers</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Trip Range</CardTitle>
          <Calendar className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {data.firstTrip ? format(parseISO(data.firstTrip), "dd MMM") : "—"}
          </div>
          <p className="text-muted-foreground text-xs">
            {data.lastTrip
              ? `to ${format(parseISO(data.lastTrip), "dd MMM yyyy")}`
              : "no trips yet"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Top Bus Routes Table ──

function TopRoutesTable({ routes }: { routes: BusAnalytics["routes"] }) {
  if (routes.length === 0) return null;

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Top Bus Routes
        </CardTitle>
        <CardDescription>
          Most frequently taken buses, ranked by trip count
        </CardDescription>
        <Separator className="w-full mt-2" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bus #</TableHead>
              <TableHead className="text-center">Trips</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Avg Fare</TableHead>
              <TableHead className="text-right">Last Trip</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.map((r) => (
              <TableRow key={r.busNumber}>
                <TableCell className="font-mono font-medium">
                  {r.busNumber}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{r.tripCount}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {fmtCurrency(r.totalSpent)}
                </TableCell>
                <TableCell className="text-right">
                  {fmtCurrency(r.avgFare)}
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-sm">
                  {format(parseISO(r.lastTrip), "dd MMM yyyy")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Monthly Trend Chart ──

function MonthlyTrendChart({ data }: { data: BusAnalytics["monthlyTrend"] }) {
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    ...d,
    label: format(parseISO(d.month + "-01"), "MMM yy"),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Monthly Bus Spending
        </CardTitle>
        <CardDescription>Trips and spend per month</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={monthlyChartConfig}
          className="h-[300px] w-full"
        >
          <BarChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `₹${v}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {name === "amount" ? "Amount" : "Trips"}
                      </span>
                      <span className="font-mono font-medium tabular-nums">
                        {name === "amount"
                          ? fmtCurrency(value as number)
                          : `${value} trips`}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar
              yAxisId="left"
              dataKey="trips"
              fill="var(--color-chart-1)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="right"
              dataKey="amount"
              fill="var(--color-chart-2)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ── Day of Week Chart ──

function DayOfWeekChart({ data }: { data: BusAnalytics["dayOfWeek"] }) {
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Trips by Day of Week
        </CardTitle>
        <CardDescription>Which days you ride the most</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={dayOfWeekChartConfig}
          className="h-[250px] w-full"
        >
          <BarChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="dayName" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {name === "trips" ? "Trips" : "Amount"}
                      </span>
                      <span className="font-mono font-medium tabular-nums">
                        {name === "trips"
                          ? `${value} trips`
                          : fmtCurrency(value as number)}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="trips" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <rect
                  key={entry.dayName}
                  fill={DAY_COLORS[entry.dayName] ?? "var(--color-chart-1)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ── Time of Day Chart ──

function TimeOfDayChart({ data }: { data: BusAnalytics["timeOfDay"] }) {
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    ...d,
    label: `${d.hour.toString().padStart(2, "0")}:00`,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Time of Day
        </CardTitle>
        <CardDescription>When you typically take the bus</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={timeOfDayChartConfig}
          className="h-[250px] w-full"
        >
          <BarChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Trips</span>
                      <span className="font-mono font-medium tabular-nums">
                        {value} trips
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar
              dataKey="trips"
              fill="var(--color-chart-3)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ── Daily Frequency Timeline ──

function DailyFrequencyChart({
  data,
}: {
  data: BusAnalytics["dailyFrequency"];
}) {
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    ...d,
    label: format(parseISO(d.date), "dd MMM"),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Daily Trip Timeline
        </CardTitle>
        <CardDescription>
          Number of bus trips per day over the selected period
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={dailyFrequencyChartConfig}
          className="h-[250px] w-full"
        >
          <LineChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Trips</span>
                      <span className="font-mono font-medium tabular-nums">
                        {value} trips
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="trips"
              stroke="var(--color-chart-4)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ── Loading Skeleton ──

function BusTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="mt-1 h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

// ── Empty State ──

function BusEmptyState() {
  return (
    <Card className="py-16">
      <CardContent className="flex flex-col items-center justify-center text-center">
        <Bus className="text-muted-foreground mb-4 h-12 w-12" />
        <h3 className="text-lg font-semibold">No bus transactions found</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          Bus transactions are identified by merchant names matching vehicle
          registration patterns (e.g., KA01AR4188, BMTC BUS KA57F0015).
        </p>
      </CardContent>
    </Card>
  );
}

// ── Bus Tab ──

function BusPatternTab() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("year");

  const { data, isLoading } = useQuery({
    queryKey: ["patterns", "bus", period],
    queryFn: () => fetchBusAnalytics(period),
  });

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p.value}
            size="sm"
            variant={period === p.value ? "default" : "outline"}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {isLoading && <BusTabSkeleton />}

      {!isLoading && (!data || data.totalTrips === 0) && <BusEmptyState />}

      {!isLoading && data && data.totalTrips > 0 && (
        <div className="space-y-6">
          <SummaryCards data={data} />
          <TopRoutesTable routes={data.routes} />

          <div className="grid gap-6 lg:grid-cols-2">
            <MonthlyTrendChart data={data.monthlyTrend} />
            <DayOfWeekChart data={data.dayOfWeek} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TimeOfDayChart data={data.timeOfDay} />
            <DailyFrequencyChart data={data.dailyFrequency} />
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INVESTMENTS TAB
// ══════════════════════════════════════════════════════════════════════════════

const ASSET_TYPE_LABELS: Record<string, string> = {
  stocks: "Stocks",
  mutual_funds: "Mutual Funds",
  gold: "Gold",
};

const ASSET_TYPE_COLORS: Record<string, string> = {
  stocks: "var(--color-chart-1)",
  mutual_funds: "var(--color-chart-2)",
  gold: "var(--color-chart-3)",
};

// ── Investment Summary Cards ──

function InvestmentSummaryCards({ data }: { data: InvestmentAnalytics }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
          <IndianRupee className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {fmtCurrency(data.totalInvested)}
          </div>
          <p className="text-muted-foreground text-xs">
            across {data.transactionCount} transactions
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Investment</CardTitle>
          <TrendingUp className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {fmtCurrency(data.avgInvestment)}
          </div>
          <p className="text-muted-foreground text-xs">
            {data.avgDaysBetweenInvestments
              ? `every ${Math.round(data.avgDaysBetweenInvestments)} days`
              : "per transaction"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Consistency Score
          </CardTitle>
          <Activity className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {Math.round(data.consistencyScore)}%
          </div>
          <p className="text-muted-foreground text-xs">
            months with investments
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          <Calendar className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {data.daysSinceLastInvestment !== null
              ? `${data.daysSinceLastInvestment}d`
              : "—"}
          </div>
          <p className="text-muted-foreground text-xs">
            {data.lastInvestment
              ? `since ${format(parseISO(data.lastInvestment), "dd MMM")}`
              : "no investments yet"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Asset Allocation Pie Chart ──

function AssetAllocationChart({
  data,
}: {
  data: InvestmentAnalytics["assetTypeBreakdown"];
}) {
  if (data.length === 0) return null;

  const chartData = data.map((asset) => ({
    name: ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType,
    value: asset.totalInvested,
    fill: ASSET_TYPE_COLORS[asset.assetType] ?? "var(--color-chart-1)",
    percentage: asset.percentageOfTotal,
  }));

  const chartConfig: ChartConfig = Object.fromEntries(
    data.map((asset) => [
      ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType,
      {
        label: ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType,
        color: ASSET_TYPE_COLORS[asset.assetType] ?? "var(--color-chart-1)",
      },
    ]),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Asset Allocation
        </CardTitle>
        <CardDescription>Investment distribution by asset type</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          chartType="pie"
          className="h-[300px] w-full"
        >
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex items-center gap-2">
                      <span>{name}:</span>
                      <span className="font-semibold">
                        {fmtCurrency(value as number)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        (
                        {chartData
                          .find((d) => d.name === name)
                          ?.percentage.toFixed(1)}
                        %)
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              label={(entry) =>
                entry.percent ? `${(entry.percent * 100).toFixed(0)}%` : ""
              }
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ── Asset Type Breakdown Table ──

function AssetBreakdownTable({
  data,
}: {
  data: InvestmentAnalytics["assetTypeBreakdown"];
}) {
  if (data.length === 0) return null;

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Asset Type Breakdown</CardTitle>
        <CardDescription>
          Detailed metrics for each investment category
        </CardDescription>
        <Separator className="w-full mt-2" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset Type</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Count</TableHead>
              <TableHead className="text-right">Avg</TableHead>
              <TableHead className="text-right">Min</TableHead>
              <TableHead className="text-right">Max</TableHead>
              <TableHead className="text-right">% of Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((asset) => (
              <TableRow key={asset.assetType}>
                <TableCell className="font-medium">
                  {ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType}
                </TableCell>
                <TableCell className="text-right">
                  {fmtCurrency(asset.totalInvested)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{asset.transactionCount}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {fmtCurrency(asset.avgAmount)}
                </TableCell>
                <TableCell className="text-right">
                  {fmtCurrency(asset.minAmount)}
                </TableCell>
                <TableCell className="text-right">
                  {fmtCurrency(asset.maxAmount)}
                </TableCell>
                <TableCell className="text-right">
                  {asset.percentageOfTotal.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Platform Breakdown Table ──

function PlatformBreakdownTable({
  data,
}: {
  data: InvestmentAnalytics["platformBreakdown"];
}) {
  if (data.length === 0) return null;

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Platform Distribution</CardTitle>
        <CardDescription>
          Investment activity across different platforms
        </CardDescription>
        <Separator className="w-full mt-2" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Platform</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Transactions</TableHead>
              <TableHead className="text-right">Avg Amount</TableHead>
              <TableHead>Primary Asset</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((platform) => (
              <TableRow key={platform.platform}>
                <TableCell className="font-medium">
                  {platform.platform}
                </TableCell>
                <TableCell className="text-right">
                  {fmtCurrency(platform.totalInvested)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{platform.transactionCount}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {fmtCurrency(platform.avgAmount)}
                </TableCell>
                <TableCell>
                  {platform.primaryAssetType
                    ? (ASSET_TYPE_LABELS[platform.primaryAssetType] ??
                      platform.primaryAssetType)
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Monthly Investment Trend (Stacked) ──

function MonthlyInvestmentTrendChart({
  data,
}: {
  data: InvestmentAnalytics["monthlyTrend"];
}) {
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    ...d,
    label: format(parseISO(d.month + "-01"), "MMM yy"),
  }));

  const chartConfig: ChartConfig = {
    stocks: { label: "Stocks", color: "var(--color-chart-1)" },
    mutualFunds: { label: "Mutual Funds", color: "var(--color-chart-2)" },
    gold: { label: "Gold", color: "var(--color-chart-3)" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Monthly Investment Trend
        </CardTitle>
        <CardDescription>
          Investment breakdown by asset type over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {name === "stocks"
                          ? "Stocks"
                          : name === "mutualFunds"
                            ? "Mutual Funds"
                            : "Gold"}
                      </span>
                      <span className="font-mono font-medium tabular-nums">
                        {fmtCurrency(value as number)}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="stocks"
              stackId="a"
              fill="var(--color-chart-1)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="mutualFunds"
              stackId="a"
              fill="var(--color-chart-2)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="gold"
              stackId="a"
              fill="var(--color-chart-3)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ── Largest Investments Table ──

function LargestInvestmentsTable({
  data,
}: {
  data: InvestmentAnalytics["largestInvestments"];
}) {
  if (data.length === 0) return null;

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Largest Investments</CardTitle>
        <CardDescription>Top 10 single transactions by amount</CardDescription>
        <Separator className="w-full mt-2" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Asset Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="text-muted-foreground text-sm">
                  {format(parseISO(inv.date), "dd MMM yyyy")}
                </TableCell>
                <TableCell className="font-medium">{inv.merchant}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {ASSET_TYPE_LABELS[inv.assetType] ?? inv.assetType}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {fmtCurrency(inv.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── SIP Detection Table ──

function SipDetectionTable({
  data,
}: {
  data: InvestmentAnalytics["detectedSips"];
}) {
  if (data.length === 0) return null;

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Repeat className="h-5 w-5" />
          Detected SIPs
        </CardTitle>
        <CardDescription>
          Recurring investments identified from transaction patterns
        </CardDescription>
        <Separator className="w-full mt-2" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Platform</TableHead>
              <TableHead>Asset Type</TableHead>
              <TableHead className="text-right">Avg Amount</TableHead>
              <TableHead className="text-center">Count</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead className="text-right">Last Investment</TableHead>
              <TableHead className="text-right">Estimated Next</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((sip) => (
              <TableRow key={sip.merchant}>
                <TableCell className="font-medium">{sip.merchant}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {ASSET_TYPE_LABELS[sip.assetType] ?? sip.assetType}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {fmtCurrency(sip.avgAmount)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge>{sip.transactionCount}</Badge>
                </TableCell>
                <TableCell>{sip.frequency}</TableCell>
                <TableCell className="text-muted-foreground text-right text-sm">
                  {format(parseISO(sip.lastInvestment), "dd MMM yyyy")}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {sip.estimatedNext
                    ? format(parseISO(sip.estimatedNext), "dd MMM yyyy")
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Investment Day of Week Chart ──

function InvestmentDayOfWeekChart({
  data,
}: {
  data: InvestmentAnalytics["dayOfWeek"];
}) {
  if (data.length === 0) return null;

  const chartConfig: ChartConfig = {
    transactionCount: { label: "Investments", color: "var(--color-chart-1)" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Investment Day Patterns
        </CardTitle>
        <CardDescription>Which days you typically invest</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="dayName" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {name === "transactionCount" ? "Investments" : "Amount"}
                      </span>
                      <span className="font-mono font-medium tabular-nums">
                        {name === "transactionCount"
                          ? `${value} investments`
                          : fmtCurrency(value as number)}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar
              dataKey="transactionCount"
              fill="var(--color-chart-1)"
              radius={[4, 4, 0, 0]}
            >
              {data.map((entry) => (
                <rect
                  key={entry.dayName}
                  fill={DAY_COLORS[entry.dayName] ?? "var(--color-chart-1)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ── Investment Time of Day Chart ──

function InvestmentTimeOfDayChart({
  data,
}: {
  data: InvestmentAnalytics["timeOfDay"];
}) {
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    ...d,
    label: `${d.hour.toString().padStart(2, "0")}:00`,
  }));

  const chartConfig: ChartConfig = {
    transactionCount: { label: "Investments", color: "var(--color-chart-4)" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Investment Time Patterns
        </CardTitle>
        <CardDescription>
          When you typically invest during the day
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Investments</span>
                      <span className="font-mono font-medium tabular-nums">
                        {value} investments
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar
              dataKey="transactionCount"
              fill="var(--color-chart-4)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ── Investment Loading Skeleton ──

function InvestmentTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="mt-1 h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

// ── Investment Empty State ──

function InvestmentEmptyState() {
  return (
    <Card className="py-16">
      <CardContent className="flex flex-col items-center justify-center text-center">
        <Coins className="text-muted-foreground mb-4 h-12 w-12" />
        <h3 className="text-lg font-semibold">
          No investment transactions found
        </h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          Investment transactions from platforms like Groww, Zerodha, ICCL
          Mutual Funds, and MMTC-PAMP will appear here.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Investments Tab Component ──

function InvestmentsPatternTab() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("year");

  const { data, isLoading } = useQuery({
    queryKey: ["patterns", "investments", period],
    queryFn: () => fetchInvestmentAnalytics(period),
  });

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p.value}
            size="sm"
            variant={period === p.value ? "default" : "outline"}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {isLoading && <InvestmentTabSkeleton />}

      {!isLoading && (!data || data.transactionCount === 0) && (
        <InvestmentEmptyState />
      )}

      {!isLoading && data && data.transactionCount > 0 && (
        <div className="space-y-6">
          <InvestmentSummaryCards data={data} />

          <div className="grid gap-6 lg:grid-cols-2">
            <AssetAllocationChart data={data.assetTypeBreakdown} />
            <MonthlyInvestmentTrendChart data={data.monthlyTrend} />
          </div>

          <AssetBreakdownTable data={data.assetTypeBreakdown} />
          <PlatformBreakdownTable data={data.platformBreakdown} />

          {data.detectedSips.length > 0 && (
            <SipDetectionTable data={data.detectedSips} />
          )}

          <LargestInvestmentsTable data={data.largestInvestments} />

          <div className="grid gap-6 lg:grid-cols-2">
            <InvestmentDayOfWeekChart data={data.dayOfWeek} />
            <InvestmentTimeOfDayChart data={data.timeOfDay} />
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

const PatternsPage = () => {
  return (
    <MainLayout>
      <div className="flex flex-1 flex-col gap-6 px-6 py-10 mx-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Patterns
            </p>
            <h1 className="text-2xl font-semibold text-foreground">
              Spending Patterns
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Discover insights from your recurring spending habits
            </p>
          </div>
        </header>

        <Tabs defaultValue="bus">
          <TabsList>
            <TabsTrigger value="bus" className="gap-2">
              <Bus className="h-4 w-4" />
              Bus
            </TabsTrigger>
            <TabsTrigger value="investments" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Investments
            </TabsTrigger>
            <TabsTrigger value="principal" className="gap-2">
              <Wallet className="h-4 w-4" />
              Principal
            </TabsTrigger>
            {/* Future tabs: Auto, Food, Subscriptions, etc. */}
          </TabsList>

          <TabsContent value="bus" className="mt-6">
            <BusPatternTab />
          </TabsContent>

          <TabsContent value="investments" className="mt-6">
            <InvestmentsPatternTab />
          </TabsContent>

          <TabsContent value="principal" className="mt-6">
            <PrincipalInvestmentTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default PatternsPage;

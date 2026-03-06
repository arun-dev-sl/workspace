import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Banknote,
  Building2,
  CalendarDays,
  Repeat,
  Trophy,
  BarChart3,
} from "lucide-react";

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
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@workspace/ui/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/ui/table";
import { Badge } from "@workspace/ui/components/ui/badge";
import { Skeleton } from "@workspace/ui/components/ui/skeleton";
import { ScrollArea } from "@workspace/ui/components/ui/scroll-area";

import { useDividendDashboard } from "@/features/dividends/api/dividends";
import type { DividendDashboard } from "@workspace/domain";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const fmtCurrency = (v: number) =>
  `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtCurrencyCompact = (v: number) => {
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
};

// ── Loading skeleton ────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

// ── A. Yearly Growth Summary Cards ──────────────────────────────────────

function YearlyGrowthCards({ data }: { data: DividendDashboard }) {
  const {
    yearlyGrowth,
    totalDividendAllTime,
    distinctCompanies,
    totalPayouts,
    monthlyAverage,
  } = data;
  const isPositive = yearlyGrowth.growthPercent >= 0;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Dividends {yearlyGrowth.currentYear}
          </CardTitle>
          <Banknote className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {fmtCurrency(yearlyGrowth.currentYearTotal)}
          </div>
          <p className="text-xs text-muted-foreground">
            vs {fmtCurrency(yearlyGrowth.previousYearTotal)} last year
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">YoY Growth</CardTitle>
          {isPositive ? (
            <ArrowUpRight className="h-4 w-4 text-green-600" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-red-600" />
          )}
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${isPositive ? "text-green-600" : "text-red-600"}`}
          >
            {isPositive ? "+" : ""}
            {yearlyGrowth.growthPercent.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {isPositive ? "+" : ""}
            {fmtCurrency(yearlyGrowth.absoluteIncrease)} absolute
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Avg</CardTitle>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {fmtCurrency(monthlyAverage)}
          </div>
          <p className="text-xs text-muted-foreground">
            across months with payouts
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">All-Time</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {fmtCurrency(totalDividendAllTime)}
          </div>
          <p className="text-xs text-muted-foreground">
            {distinctCompanies} companies · {totalPayouts} payouts
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Lifetime Dividend Per Company (Small Widget) ────────────────────────

function LifetimeDividendPerCompany({ data }: { data: DividendDashboard }) {
  const items = data.lifetimePerCompany ?? [];

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Lifetime Dividend by Company
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
          No data yet
        </CardContent>
      </Card>
    );
  }

  const grandTotal = items.reduce((sum, c) => sum + c.totalAmount, 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Lifetime Dividend by Company
        </CardTitle>
        <CardDescription>
          All-time cumulative dividend received per company
        </CardDescription>
      </CardHeader>
      <CardContent className="">
        <ScrollArea className="h-[320px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="flex items-center gap-1">
                  <span data-slot="badge">
                    <Building2 className="size-4" />
                  </span>
                  Company
                </TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right w-[80px]">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.isin}>
                  <TableCell className="font-medium text-sm">
                    {c.companyName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {fmtCurrency(c.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                    {grandTotal > 0
                      ? `${((c.totalAmount / grandTotal) * 100).toFixed(1)}%`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ── C. Monthly Dividend Trend (Area Chart) ──────────────────────────────

const monthlyChartConfig: ChartConfig = {
  totalAmount: {
    label: "Dividend",
    color: "var(--color-chart-1)",
  },
};

function MonthlyTrendChart({ data }: { data: DividendDashboard }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" />
          Monthly Dividend Trend
        </CardTitle>
        <CardDescription>Dividend income received each month</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={monthlyChartConfig}
          className="h-[280px] w-full"
        >
          <AreaChart
            data={data.monthlyTrend}
            margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="monthName" className="text-xs" />
            <YAxis
              tickFormatter={(v) => fmtCurrencyCompact(v)}
              className="text-xs"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => fmtCurrency(Number(value))}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="totalAmount"
              stroke="var(--color-chart-1)"
              fill="var(--color-chart-1)"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ── F. Top Dividend Stocks (Pie Chart) ──────────────────────────────────

function TopStocksPieChart({ data }: { data: DividendDashboard }) {
  const pieData = data.topStocks.slice(0, 6).map((s, i) => ({
    name:
      s.companyName.length > 18
        ? `${s.companyName.slice(0, 18)}…`
        : s.companyName,
    value: s.totalAmount,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const pieConfig: ChartConfig = Object.fromEntries(
    pieData.map((d) => [d.name, { label: d.name, color: d.fill }]),
  );

  if (pieData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" />
            Top Dividend Stocks
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
          No data yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" />
          Top Dividend Stocks
        </CardTitle>
        <CardDescription>
          Highest dividend-paying companies this year
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={pieConfig}
          className="h-[280px] w-full"
          chartType="pie"
        >
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => fmtCurrency(Number(value))}
                />
              }
            />
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={50}
              paddingAngle={2}
            >
              {pieData.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ── B. Cumulative Per-Company (Horizontal Bar Chart) ────────────────────

const perCompanyConfig: ChartConfig = {
  totalAmount: {
    label: "Total Dividend",
    color: "var(--color-chart-2)",
  },
};

function PerCompanyBarChart({ data }: { data: DividendDashboard }) {
  const chartData = data.perCompany.slice(0, 12).map((c) => ({
    name:
      c.companyName.length > 22
        ? `${c.companyName.slice(0, 22)}…`
        : c.companyName,
    totalAmount: c.totalAmount,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Dividend by Company
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
          No data yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Dividend by Company
        </CardTitle>
        <CardDescription>Cumulative dividend earned per stock</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={perCompanyConfig}
          className="w-full"
          style={{ height: Math.max(280, chartData.length * 36) }}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              type="number"
              tickFormatter={(v) => fmtCurrencyCompact(v)}
              className="text-xs"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              className="text-xs"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => fmtCurrency(Number(value))}
                />
              }
            />
            <Bar
              dataKey="totalAmount"
              fill="var(--color-chart-2)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ── D. Dividend Yield Analysis (Bar Chart) ──────────────────────────────

const yieldConfig: ChartConfig = {
  yieldPercent: {
    label: "Yield %",
    color: "var(--color-chart-3)",
  },
};

function YieldAnalysisChart({ data }: { data: DividendDashboard }) {
  const chartData = data.yieldAnalysis.map((y) => ({
    name:
      y.companyName.length > 20
        ? `${y.companyName.slice(0, 20)}…`
        : y.companyName,
    yieldPercent: Math.round(y.yieldPercent * 100) / 100,
    totalDividend: y.totalDividend,
    investedValue: y.investedValue,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Dividend Yield Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[280px] text-muted-foreground text-sm gap-2">
          <p>No yield data available</p>
          <p className="text-xs">
            Set "Invested Value" on individual dividends in the All Dividends
            tab to enable yield analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Dividend Yield Analysis
        </CardTitle>
        <CardDescription>
          Yield = Total Dividend ÷ Invested Value × 100
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={yieldConfig}
          className="w-full"
          style={{ height: Math.max(280, chartData.length * 36) }}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" className="text-xs" unit="%" />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              className="text-xs"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    if (name === "yieldPercent") return `${value}%`;
                    return fmtCurrency(Number(value));
                  }}
                />
              }
            />
            <Bar
              dataKey="yieldPercent"
              fill="var(--color-chart-3)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ── E. Repeat Payout Analysis (Table) ───────────────────────────────────

function RepeatPayoutTable({ data }: { data: DividendDashboard }) {
  if (data.repeatPayouts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Repeat className="h-4 w-4" />
            Repeat Payouts
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
          No companies with multiple payouts this year
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Repeat className="h-4 w-4" />
          Repeat Payouts
        </CardTitle>
        <CardDescription>
          Companies that paid dividends multiple times this year
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Payouts</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Ex-Dates</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.repeatPayouts.map((r) => (
              <TableRow key={r.isin}>
                <TableCell className="font-medium">{r.companyName}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">{r.payoutCount}×</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtCurrency(r.totalAmount)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.exDates.join(", ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── H. Avg Dividend Per Share (Bar Chart) ───────────────────────────────

const avgDpsConfig: ChartConfig = {
  avgDividendPerShare: {
    label: "Avg Div/Share",
    color: "var(--color-chart-4)",
  },
};

function AvgDividendPerShareChart({ data }: { data: DividendDashboard }) {
  const chartData = data.perCompany
    .filter((c) => c.avgDividendPerShare > 0)
    .sort((a, b) => b.avgDividendPerShare - a.avgDividendPerShare)
    .slice(0, 12)
    .map((c) => ({
      name:
        c.companyName.length > 22
          ? `${c.companyName.slice(0, 22)}…`
          : c.companyName,
      avgDividendPerShare: Math.round(c.avgDividendPerShare * 100) / 100,
    }));

  if (chartData.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Banknote className="h-4 w-4" />
          Avg Dividend Per Share
        </CardTitle>
        <CardDescription>Which stocks pay the most per share</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={avgDpsConfig}
          className="w-full"
          style={{ height: Math.max(280, chartData.length * 36) }}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" className="text-xs" />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              className="text-xs"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => `₹${Number(value).toFixed(2)}`}
                />
              }
            />
            <Bar
              dataKey="avgDividendPerShare"
              fill="var(--color-chart-4)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ── G. Dividend Calendar (Monthly Heatmap-style grid) ───────────────────

function DividendCalendar({ data }: { data: DividendDashboard }) {
  const maxAmount = Math.max(...data.monthlyTrend.map((m) => m.totalAmount), 1);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" />
          Dividend Calendar
        </CardTitle>
        <CardDescription>Monthly payout overview</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
          {data.monthlyTrend.map((m) => {
            const intensity =
              m.totalAmount > 0 ? Math.max(0.15, m.totalAmount / maxAmount) : 0;
            return (
              <div
                key={m.month}
                data-slot="badge"
                className="flex flex-col items-center rounded-md border p-2 text-center transition-colors"
                style={{
                  backgroundColor:
                    intensity > 0
                      ? `color-mix(in srgb, var(--accent) ${Math.round(intensity * 100)}%, transparent)`
                      : undefined,
                }}
              >
                <span className="text-[10px] font-medium uppercase text-primary">
                  {m.monthName}
                </span>
                <span className="mt-0.5 text-xs font-semibold tabular-nums">
                  {m.totalAmount > 0 ? fmtCurrencyCompact(m.totalAmount) : "—"}
                </span>
                {m.entryCount > 0 && (
                  <span className="text-[9px] text-muted-foreground">
                    {m.entryCount} payout{m.entryCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Dashboard Export ────────────────────────────────────────────────

interface DividendDashboardProps {
  year?: number;
}

export function DividendDashboardView({ year }: DividendDashboardProps) {
  const { data, isLoading } = useDividendDashboard(year);

  if (isLoading || !data) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* A. Summary Cards */}
      <YearlyGrowthCards data={data} />

      {/* Lifetime Per-Company Widget */}
      <LifetimeDividendPerCompany data={data} />

      {/* G. Calendar Heatmap */}
      <DividendCalendar data={data} />

      {/* C + F — Trend + Top Stocks side by side */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <MonthlyTrendChart data={data} />
        <TopStocksPieChart data={data} />
      </div>

      {/* B. Per-Company Bar */}
      <PerCompanyBarChart data={data} />

      {/* D. Yield Analysis */}
      <YieldAnalysisChart data={data} />

      {/* H. Avg Div Per Share */}
      <AvgDividendPerShareChart data={data} />

      {/* E. Repeat Payouts */}
      <RepeatPayoutTable data={data} />
    </div>
  );
}

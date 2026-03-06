import { Pie, PieChart, Cell } from "recharts";
import { Coins } from "lucide-react";
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
import type { DistributionMetrics } from "@workspace/domain";

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

interface AssetDonutChartProps {
  distribution: DistributionMetrics;
}

export function AssetDonutChart({ distribution }: AssetDonutChartProps) {
  if (distribution.allocations.length === 0) return null;

  const chartData = distribution.allocations.map((a, i) => ({
    name: a.name,
    value: a.value,
    fill: COLORS[i % COLORS.length],
    percentage: a.percentage,
  }));

  const chartConfig: ChartConfig = Object.fromEntries(
    chartData.map((d) => [d.name, { label: d.name, color: d.fill }]),
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Asset Allocation
        </CardTitle>
        <CardDescription>
          Portfolio distribution — Total:{" "}
          {fmtCurrency(distribution.totalPortfolioValue)}
        </CardDescription>
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

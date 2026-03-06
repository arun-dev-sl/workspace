import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { TrendingUp } from "lucide-react";
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
} from "@workspace/ui/components/ui/chart";
import { Badge } from "@workspace/ui/components/ui/badge";
import type {
  PrincipalContributionDto,
  ContributionMetrics,
} from "@workspace/domain";

const chartConfig: ChartConfig = {
  amountLakhs: { label: "Investment", color: "var(--color-chart-1)" },
};

interface MonthlyInvestmentChartProps {
  contributions: PrincipalContributionDto[];
  metrics: ContributionMetrics;
}

export function MonthlyInvestmentChart({
  contributions,
  metrics,
}: MonthlyInvestmentChartProps) {
  if (contributions.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Monthly Investment
            </CardTitle>
            <CardDescription>
              Per-month principal deployed (in Lakhs)
            </CardDescription>
          </div>
          <Badge variant={metrics.trendIncreasing ? "default" : "secondary"}>
            {metrics.trendIncreasing ? "📈 Trending Up" : "📉 Trending Down"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={contributions} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}L`}
            />
            <ReferenceLine
              y={metrics.averageMonthlyLakhs}
              stroke="var(--color-chart-3)"
              strokeDasharray="4 4"
              label={{
                value: `Avg: ${metrics.averageMonthlyLakhs}L`,
                position: "insideTopRight",
                fontSize: 11,
                fill: "var(--color-chart-3)",
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Invested</span>
                      <span className="font-mono font-medium tabular-nums">
                        ₹{((value as number) * 100000).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="amountLakhs"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              dot={{ r: 4, fill: "var(--color-chart-1)" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

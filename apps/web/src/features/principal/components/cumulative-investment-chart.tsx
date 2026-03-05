import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import type { ContributionMetrics } from "@workspace/domain";

const chartConfig: ChartConfig = {
  cumulative: { label: "Cumulative", color: "var(--color-chart-2)" },
};

interface CumulativeInvestmentChartProps {
  cumulativeSeries: ContributionMetrics["cumulativeSeries"];
}

export function CumulativeInvestmentChart({
  cumulativeSeries,
}: CumulativeInvestmentChartProps) {
  if (cumulativeSeries.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Cumulative Investment
        </CardTitle>
        <CardDescription>
          Running total of principal deployed (in Lakhs)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={cumulativeSeries} accessibilityLayer>
            <defs>
              <linearGradient
                id="cumulativeGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--color-chart-2)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-chart-2)"
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
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
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        Total Invested
                      </span>
                      <span className="font-mono font-medium tabular-nums">
                        ₹{((value as number) * 100000).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="var(--color-chart-2)"
              strokeWidth={2}
              fill="url(#cumulativeGradient)"
              dot={{ r: 3, fill: "var(--color-chart-2)" }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

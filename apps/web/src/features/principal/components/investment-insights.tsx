import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/ui/card";
import { Badge } from "@workspace/ui/components/ui/badge";
import type { ContributionMetrics } from "@workspace/domain";

interface InvestmentInsightsProps {
  metrics: ContributionMetrics;
}

export function InvestmentInsights({ metrics }: InvestmentInsightsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {metrics.trendIncreasing ? (
            <TrendingUp className="h-5 w-5 text-green-500" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-500" />
          )}
          Investment Insights
        </CardTitle>
        <CardDescription>Key observations from your data</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Overall Trend */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">Overall Trend</span>
            <Badge variant={metrics.trendIncreasing ? "default" : "secondary"}>
              {metrics.trendIncreasing ? "📈 Increasing" : "📉 Decreasing"}
            </Badge>
          </div>

          {/* Largest Increase */}
          {metrics.largestIncrease && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">
                  Largest Monthly Jump
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold">
                  +{metrics.largestIncrease.change.toFixed(2)}L
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {metrics.largestIncrease.label}
                </span>
              </div>
            </div>
          )}

          {/* Largest Drop */}
          {metrics.largestDrop && metrics.largestDrop.change < 0 && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">
                  Largest Monthly Drop
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold">
                  {metrics.largestDrop.change.toFixed(2)}L
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {metrics.largestDrop.label}
                </span>
              </div>
            </div>
          )}

          {/* Consistency */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">Consistency</span>
            <span className="text-sm">
              {metrics.consistencyScore >= 0.7
                ? "🟢 Highly consistent"
                : metrics.consistencyScore >= 0.4
                  ? "🟡 Moderately consistent"
                  : "🔴 Highly variable"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

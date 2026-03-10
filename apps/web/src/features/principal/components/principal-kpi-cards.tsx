import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Activity,
  Award,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/ui/card";
import type { ContributionMetrics } from "@workspace/domain";

const LAKHS = 100_000;

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

interface PrincipalKpiCardsProps {
  metrics: ContributionMetrics;
}

export function PrincipalKpiCards({ metrics }: PrincipalKpiCardsProps) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Principal */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Principal Invested
          </CardTitle>
          <span data-slot="badge">
            <IndianRupee className="text-primary h-4 w-4" />
          </span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {fmtCurrency(metrics.totalINR)}
          </div>
          <p className="text-muted-foreground text-xs">
            {metrics.totalLakhs.toFixed(2)}L across{" "}
            {metrics.cumulativeSeries.length} months
          </p>
        </CardContent>
      </Card>

      {/* Average Monthly */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Avg Monthly Contribution
          </CardTitle>
          <span data-slot="badge">
            {metrics.trendIncreasing ? (
              <TrendingUp className="text-primary h-4 w-4" />
            ) : (
              <TrendingDown className="text-primary h-4 w-4" />
            )}
          </span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {fmtCurrency(metrics.averageMonthlyLakhs * LAKHS)}
          </div>
          <p className="text-muted-foreground text-xs">
            {metrics.averageMonthlyLakhs.toFixed(2)}L per month
          </p>
        </CardContent>
      </Card>

      {/* Best Month */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Best Month</CardTitle>
          <span data-slot="badge">
            <Award className="text-primary h-4 w-4" />
          </span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {fmtCurrency(metrics.highestMonth.amountLakhs * LAKHS)}
          </div>
          <p className="text-muted-foreground text-xs">
            {metrics.highestMonth.label} — worst: {metrics.lowestMonth.label} (
            {metrics.lowestMonth.amountLakhs.toFixed(2)}L)
          </p>
        </CardContent>
      </Card>

      {/* Consistency Score */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Consistency Score
          </CardTitle>
          <span data-slot="badge">
            <Activity className="text-primary h-4 w-4" />
          </span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(metrics.consistencyScore * 100).toFixed(0)}%
          </div>
          <p className="text-muted-foreground text-xs">
            {metrics.consistencyScore >= 0.7
              ? "Great consistency!"
              : metrics.consistencyScore >= 0.4
                ? "Moderate consistency"
                : "Highly variable"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

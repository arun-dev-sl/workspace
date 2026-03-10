import { Target, Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/ui/card";
import { Separator } from "@workspace/ui/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/ui/table";
import { Badge } from "@workspace/ui/components/ui/badge";
import { Progress } from "@workspace/ui/components/ui/progress";
import type { MilestoneProjection } from "@workspace/domain";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

interface MilestoneProjectionsTableProps {
  milestones: MilestoneProjection[];
  currentPortfolio: number;
}

export function MilestoneProjectionsTable({
  milestones,
  currentPortfolio,
}: MilestoneProjectionsTableProps) {
  if (milestones.length === 0) return null;

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span data-slot="badge">
            <Target className="h-5 w-5" />
          </span>
          Wealth Milestone Projections
        </CardTitle>
        <CardDescription>
          Estimated time to reach milestones at 12% CAGR using your average
          monthly contribution. Current portfolio:{" "}
          {fmtCurrency(currentPortfolio)}.
        </CardDescription>
        <Separator className="w-full mt-2" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Milestone</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead className="text-right">Estimated Time</TableHead>
              <TableHead className="text-right">Years</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {milestones.map((m) => {
              const progressPct = Math.min(
                100,
                (currentPortfolio / m.targetINR) * 100,
              );
              return (
                <TableRow key={m.label}>
                  <TableCell className="font-semibold">{m.label}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtCurrency(m.targetINR)}
                  </TableCell>
                  <TableCell className="min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <Progress value={progressPct} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {progressPct.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {m.achieved ? (
                      <Badge variant="default" className="gap-1">
                        <Check className="h-3 w-3" />
                        Achieved
                      </Badge>
                    ) : (
                      <span className="font-mono">
                        {Math.floor(m.monthsToTarget / 12)}y{" "}
                        {m.monthsToTarget % 12}m
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {m.achieved ? "—" : `${m.yearsToTarget} yrs`}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

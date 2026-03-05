import { useMemo, useState } from "react";
import { Plus, Check, X, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/ui/card";
import { Button } from "@workspace/ui/components/ui/button";
import { Input } from "@workspace/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/ui/select";
import { toast } from "sonner";

import {
  useCreateContribution,
  useUpdateContribution,
  useDeleteContribution,
} from "../api/principal";

import type { PrincipalContributionRow } from "@workspace/domain";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const fmt = (v: number) =>
  v.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

interface ContributionsTableProps {
  contributions: PrincipalContributionRow[];
}

export function ContributionsTable({ contributions }: ContributionsTableProps) {
  const createMutation = useCreateContribution();
  const updateMutation = useUpdateContribution();
  const deleteMutation = useDeleteContribution();

  // Sort contributions by date (newest first)
  const sortedContributions = useMemo(() => {
    const monthIndex = (m: string) =>
      MONTHS.indexOf(m as (typeof MONTHS)[number]);
    return [...contributions].sort((a, b) => {
      const yearDiff = b.year - a.year;
      if (yearDiff !== 0) return yearDiff;
      return monthIndex(b.month) - monthIndex(a.month);
    });
  }, [contributions]);

  // Build chronological order for MoM calculation (oldest first)
  const chronologicalOrder = useMemo(() => {
    const monthIndex = (m: string) =>
      MONTHS.indexOf(m as (typeof MONTHS)[number]);
    return [...contributions].sort((a, b) => {
      const yearDiff = a.year - b.year;
      if (yearDiff !== 0) return yearDiff;
      return monthIndex(a.month) - monthIndex(b.month);
    });
  }, [contributions]);

  // MoM change map: id → change ratio
  const momChangeMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (let i = 0; i < chronologicalOrder.length; i++) {
      const curr = chronologicalOrder[i]!;
      if (i === 0) {
        map.set(curr.id, null);
      } else {
        const prev = chronologicalOrder[i - 1]!;
        if (prev.amountLakhs === 0) {
          map.set(curr.id, null);
        } else {
          map.set(
            curr.id,
            (curr.amountLakhs - prev.amountLakhs) / prev.amountLakhs,
          );
        }
      }
    }
    return map;
  }, [chronologicalOrder]);

  // Average savings rate (only rows where salary exists)
  const avgSavingsRate = useMemo(() => {
    const withSalary = contributions.filter(
      (c) => c.salaryLakhs != null && c.salaryLakhs > 0,
    );
    if (withSalary.length === 0) return null;
    const totalInvested = withSalary.reduce((s, c) => s + c.amountLakhs, 0);
    const totalSalary = withSalary.reduce((s, c) => s + c.salaryLakhs!, 0);
    return totalInvested / totalSalary;
  }, [contributions]);

  // ── Inline edit state ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editSalary, setEditSalary] = useState("");

  // ── Add-row state ──
  const [isAdding, setIsAdding] = useState(false);
  const [newMonth, setNewMonth] = useState<string>("Jan");
  const [newYear, setNewYear] = useState(
    String(new Date().getFullYear() % 100),
  );
  const [newAmount, setNewAmount] = useState("");
  const [newSalary, setNewSalary] = useState("");

  // ── Handlers ──

  const handleStartEdit = (row: PrincipalContributionRow) => {
    setEditingId(row.id);
    setEditAmount(String(row.amountLakhs));
    setEditSalary(row.salaryLakhs != null ? String(row.salaryLakhs) : "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditAmount("");
    setEditSalary("");
  };

  const handleSaveEdit = (id: string) => {
    const val = Number.parseFloat(editAmount);
    if (Number.isNaN(val) || val <= 0) {
      toast.error("Enter a valid investment amount");
      return;
    }

    const data: {
      amountLakhs?: number;
      salaryLakhs?: number | null;
    } = { amountLakhs: val };

    if (editSalary.trim() === "") {
      data.salaryLakhs = null;
    } else {
      const salaryVal = Number.parseFloat(editSalary);
      if (Number.isNaN(salaryVal) || salaryVal <= 0) {
        toast.error("Enter a valid salary or leave blank");
        return;
      }
      data.salaryLakhs = salaryVal;
    }

    updateMutation.mutate(
      { id, data },
      {
        onSuccess: () => {
          toast.success("Contribution updated");
          handleCancelEdit();
        },
        onError: () => toast.error("Update failed"),
      },
    );
  };

  const handleDelete = (row: PrincipalContributionRow) => {
    deleteMutation.mutate(row.id, {
      onSuccess: () => toast.success(`Deleted ${row.label}`),
      onError: () => toast.error("Delete failed"),
    });
  };

  const handleAdd = () => {
    const val = Number.parseFloat(newAmount);
    if (Number.isNaN(val) || val <= 0) {
      toast.error("Enter a valid amount in Lakhs");
      return;
    }
    const yearNum = Number.parseInt(newYear, 10);
    if (Number.isNaN(yearNum) || yearNum < 0 || yearNum > 99) {
      toast.error("Enter a valid 2-digit year (e.g. 25)");
      return;
    }

    let salaryLakhs: number | null = null;
    if (newSalary.trim()) {
      const salaryVal = Number.parseFloat(newSalary);
      if (Number.isNaN(salaryVal) || salaryVal <= 0) {
        toast.error("Enter a valid salary or leave blank");
        return;
      }
      salaryLakhs = salaryVal;
    }

    createMutation.mutate(
      { month: newMonth, year: yearNum, amountLakhs: val, salaryLakhs },
      {
        onSuccess: () => {
          toast.success(`Added ${newMonth} ${newYear}`);
          setNewAmount("");
          setNewSalary("");
          setIsAdding(false);
        },
        onError: (error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Failed to add";
          toast.error(message);
        },
      },
    );
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
    if (e.key === "Escape") setIsAdding(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Monthly Contributions</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Month
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="mx-6 mb-6 overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Invested (₹L)</TableHead>
                <TableHead className="text-right">Salary (₹L)</TableHead>
                <TableHead className="text-right">Savings Rate</TableHead>
                <TableHead className="text-right">MoM Change</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Add-row */}
              {isAdding && (
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select value={newMonth} onValueChange={setNewMonth}>
                        <SelectTrigger className="h-8 w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="YY"
                        value={newYear}
                        onChange={(e) => setNewYear(e.target.value)}
                        className="h-8 w-16 text-center"
                        onKeyDown={handleAddKeyDown}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="1.14"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      className="ml-auto h-8 w-24 text-right text-sm"
                      autoFocus
                      onKeyDown={handleAddKeyDown}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="(opt)"
                      value={newSalary}
                      onChange={(e) => setNewSalary(e.target.value)}
                      className="ml-auto h-8 w-24 text-right text-sm"
                      onKeyDown={handleAddKeyDown}
                    />
                  </TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleAdd}
                        disabled={createMutation.isPending}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setIsAdding(false)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {contributions.length === 0 && !isAdding ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No contributions yet. Click &quot;Add Month&quot; to start.
                  </TableCell>
                </TableRow>
              ) : (
                sortedContributions.map((row) => {
                  const isEditing = editingId === row.id;
                  const savingsRate =
                    row.salaryLakhs != null && row.salaryLakhs > 0
                      ? row.amountLakhs / row.salaryLakhs
                      : null;
                  const momChange = momChangeMap.get(row.id) ?? null;

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.label}</TableCell>

                      {/* Invested */}
                      <TableCell className="text-right tabular-nums">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="ml-auto h-7 w-24 text-right text-xs"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(row.id);
                              if (e.key === "Escape") handleCancelEdit();
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="inline-flex cursor-pointer items-center gap-1 tabular-nums hover:underline"
                            onClick={() => handleStartEdit(row)}
                          >
                            {fmt(row.amountLakhs)}
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                      </TableCell>

                      {/* Salary */}
                      <TableCell className="text-right tabular-nums">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="—"
                            value={editSalary}
                            onChange={(e) => setEditSalary(e.target.value)}
                            className="ml-auto h-7 w-24 text-right text-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(row.id);
                              if (e.key === "Escape") handleCancelEdit();
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="inline-flex cursor-pointer items-center gap-1 tabular-nums hover:underline"
                            onClick={() => handleStartEdit(row)}
                          >
                            {row.salaryLakhs != null
                              ? fmt(row.salaryLakhs)
                              : "—"}
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                      </TableCell>

                      {/* Savings Rate */}
                      <TableCell className="text-right tabular-nums text-sm">
                        {savingsRate != null ? (
                          <span
                            className={
                              savingsRate >= 0.3
                                ? "text-green-600 dark:text-green-400"
                                : savingsRate >= 0.15
                                  ? "text-yellow-600 dark:text-yellow-400"
                                  : "text-red-600 dark:text-red-400"
                            }
                          >
                            {fmtPct(savingsRate)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>

                      {/* MoM Change */}
                      <TableCell className="text-right tabular-nums text-sm">
                        {momChange != null ? (
                          <span
                            className={
                              momChange > 0
                                ? "text-green-600 dark:text-green-400"
                                : momChange < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-muted-foreground"
                            }
                          >
                            {momChange > 0 ? "+" : ""}
                            {fmtPct(momChange)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleSaveEdit(row.id)}
                              disabled={updateMutation.isPending}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(row)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            {contributions.length > 0 && (
              <TableFooter>
                <TableRow className="bg-muted/50">
                  <TableCell className="font-semibold">Average</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right tabular-nums text-sm font-semibold">
                    {avgSavingsRate != null ? (
                      <span
                        className={
                          avgSavingsRate >= 0.3
                            ? "text-green-600 dark:text-green-400"
                            : avgSavingsRate >= 0.15
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-red-600 dark:text-red-400"
                        }
                      >
                        {fmtPct(avgSavingsRate)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

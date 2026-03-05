import { useMemo, useState } from "react";
import { Plus, Check, X, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
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

  // ── Inline edit state ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

  // ── Add-row state ──
  const [isAdding, setIsAdding] = useState(false);
  const [newMonth, setNewMonth] = useState<string>("Jan");
  const [newYear, setNewYear] = useState(
    String(new Date().getFullYear() % 100),
  );
  const [newAmount, setNewAmount] = useState("");

  // ── Handlers ──

  const handleStartEdit = (row: PrincipalContributionRow) => {
    setEditingId(row.id);
    setEditAmount(String(row.amountLakhs));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditAmount("");
  };

  const handleSaveEdit = (id: string) => {
    const val = Number.parseFloat(editAmount);
    if (Number.isNaN(val) || val <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    updateMutation.mutate(
      { id, data: { amountLakhs: val } },
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

    createMutation.mutate(
      { month: newMonth, year: yearNum, amountLakhs: val },
      {
        onSuccess: () => {
          toast.success(`Added ${newMonth} ${newYear}`);
          setNewAmount("");
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
        <div className="mx-6 mb-6 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Amount (₹ Lakhs)</TableHead>
                <TableHead className="text-right">Amount (₹)</TableHead>
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
                      className="ml-auto h-8 w-28 text-right text-sm"
                      autoFocus
                      onKeyDown={handleAddKeyDown}
                    />
                  </TableCell>
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
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No contributions yet. Click &quot;Add Month&quot; to start.
                  </TableCell>
                </TableRow>
              ) : (
                sortedContributions.map((row) => {
                  const isEditing = editingId === row.id;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="h-7 w-28 text-right text-xs"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit(row.id);
                                if (e.key === "Escape") handleCancelEdit();
                              }}
                            />
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
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        ₹
                        {(row.amountLakhs * 100_000).toLocaleString("en-IN", {
                          maximumFractionDigits: 0,
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

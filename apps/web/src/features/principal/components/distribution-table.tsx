import { useState } from "react";
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
import { toast } from "sonner";

import {
  useCreateDistribution,
  useUpdateDistribution,
  useDeleteDistribution,
} from "../api/principal";

import type { PrincipalDistributionRow } from "@workspace/domain";

const fmtINR = (v: number) =>
  v.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface DistributionTableProps {
  distribution: PrincipalDistributionRow[];
}

export function DistributionTable({ distribution }: DistributionTableProps) {
  const createMutation = useCreateDistribution();
  const updateMutation = useUpdateDistribution();
  const deleteMutation = useDeleteDistribution();

  // ── Inline edit state ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editValue, setEditValue] = useState("");

  // ── Add-row state ──
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");

  // ── Handlers ──

  const handleStartEdit = (row: PrincipalDistributionRow) => {
    setEditingId(row.id);
    setEditName(row.name);
    setEditValue(String(row.value));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditValue("");
  };

  const handleSaveEdit = (id: string, originalName: string) => {
    const val = Number.parseFloat(editValue);
    if (Number.isNaN(val) || val < 0) {
      toast.error("Enter a valid value");
      return;
    }
    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast.error("Asset name is required");
      return;
    }

    const data: { name?: string; value?: number } = {};
    if (trimmedName !== originalName) data.name = trimmedName;
    if (val !== Number.parseFloat(editValue)) data.value = val;
    // Always send value to ensure update
    data.value = val;

    updateMutation.mutate(
      { id, data },
      {
        onSuccess: () => {
          toast.success("Distribution updated");
          handleCancelEdit();
        },
        onError: () => toast.error("Update failed"),
      },
    );
  };

  const handleDelete = (row: PrincipalDistributionRow) => {
    deleteMutation.mutate(row.id, {
      onSuccess: () => toast.success(`Deleted ${row.name}`),
      onError: () => toast.error("Delete failed"),
    });
  };

  const handleAdd = () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast.error("Enter an asset name (e.g. Stocks, PF, Gold)");
      return;
    }
    const val = Number.parseFloat(newValue);
    if (Number.isNaN(val) || val < 0) {
      toast.error("Enter a valid value in Lakhs");
      return;
    }

    createMutation.mutate(
      { name: trimmedName, value: val },
      {
        onSuccess: () => {
          toast.success(`Added ${trimmedName}`);
          setNewName("");
          setNewValue("");
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

  const total = distribution.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Asset Distribution</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Asset
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="mx-6 mb-6 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Value (₹ Lakhs)</TableHead>
                <TableHead className="text-right">% Share</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Add-row */}
              {isAdding && (
                <TableRow>
                  <TableCell>
                    <Input
                      type="text"
                      placeholder="e.g. Stocks"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="h-8 w-40"
                      autoFocus
                      onKeyDown={handleAddKeyDown}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="12.50"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="ml-auto h-8 w-28 text-right text-sm"
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

              {distribution.length === 0 && !isAdding ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No distribution data yet. Click &quot;Add Asset&quot; to
                    start.
                  </TableCell>
                </TableRow>
              ) : (
                distribution.map((row) => {
                  const isEditing = editingId === row.id;
                  const pct = total > 0 ? (row.value / total) * 100 : 0;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {isEditing ? (
                          <Input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-7 w-40 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleSaveEdit(row.id, row.name);
                              if (e.key === "Escape") handleCancelEdit();
                            }}
                          />
                        ) : (
                          row.name
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-7 w-28 text-right text-xs"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  handleSaveEdit(row.id, row.name);
                                if (e.key === "Escape") handleCancelEdit();
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleSaveEdit(row.id, row.name)}
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
                            {fmtINR(row.value)}
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {pct.toFixed(1)}%
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

              {/* Total row */}
              {distribution.length > 0 && (
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtINR(total)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    100%
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

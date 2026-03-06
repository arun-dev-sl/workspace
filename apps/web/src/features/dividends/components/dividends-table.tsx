import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Trash2, Check, X, Building2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/ui/table";
import { Button } from "@workspace/ui/components/ui/button";
import { Input } from "@workspace/ui/components/ui/input";
import { Skeleton } from "@workspace/ui/components/ui/skeleton";
import { Badge } from "@workspace/ui/components/ui/badge";
import {
  useDividends,
  useEnrichDividendYield,
  useDeleteDividend,
} from "@/features/dividends/api/dividends";
import { toast } from "sonner";

const fmt = (v: string | null, decimals = 2) =>
  v != null
    ? Number(v).toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : "—";

export function DividendsTable() {
  const { data: dividends = [], isLoading } = useDividends();
  const enrichMutation = useEnrichDividendYield();
  const deleteMutation = useDeleteDividend();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleSaveYield = (id: string) => {
    const val = Number.parseFloat(editValue);
    if (Number.isNaN(val) || val <= 0) {
      toast.error("Invalid invested value");
      return;
    }
    enrichMutation.mutate(
      { id, investedValue: val },
      {
        onSuccess: () => {
          toast.success("Invested value updated");
          setEditingId(null);
        },
        onError: () => toast.error("Update failed"),
      },
    );
  };

  const handleDelete = (id: string, companyName: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success(`Deleted ${companyName}`),
      onError: () => toast.error("Delete failed"),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (dividends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">No dividends imported yet.</p>
        <p className="text-xs mt-1">
          Use the "Import Dividends" button to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="flex items-center gap-1">
              <span data-slot="badge">
                <Building2 className="size-4" />
              </span>
              Company
            </TableHead>
            <TableHead>ISIN</TableHead>
            <TableHead className="text-right">Ex-Date</TableHead>
            <TableHead className="text-right">Shares</TableHead>
            <TableHead className="text-right">Div/Share</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Invested Value</TableHead>
            <TableHead className="text-right">Yield %</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {dividends.map((d) => {
            const yieldPct =
              d.investedValue && Number(d.investedValue) > 0
                ? ((Number(d.amount) / Number(d.investedValue)) * 100).toFixed(
                    2,
                  )
                : null;
            const isEditing = editingId === d.id;

            return (
              <TableRow key={d.id}>
                <TableCell className="font-medium max-w-50 truncate">
                  {d.companyName}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">
                  {d.isin}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {format(parseISO(d.exDate), "dd MMM yyyy")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {d.shares}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ₹{fmt(d.dividendPerShare, 4)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  ₹{fmt(d.amount)}
                </TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <div className="flex items-center justify-end gap-1">
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-7 w-28 text-right text-xs"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveYield(d.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleSaveYield(d.id)}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-sm tabular-nums hover:underline cursor-pointer"
                      onClick={() => {
                        setEditingId(d.id);
                        setEditValue(d.investedValue ?? "");
                      }}
                    >
                      {d.investedValue ? (
                        `₹${fmt(d.investedValue)}`
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          click to set
                        </span>
                      )}
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {yieldPct ? (
                    <Badge variant="secondary">{yieldPct}%</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDelete(d.id, d.companyName)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

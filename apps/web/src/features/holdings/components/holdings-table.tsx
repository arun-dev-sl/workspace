import { useMemo, useState, useCallback } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/ui/table";
import { Badge } from "@workspace/ui/components/ui/badge";
import { Button } from "@workspace/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/ui/alert-dialog";
import { Skeleton } from "@workspace/ui/components/ui/skeleton";
import { useDeleteHolding } from "@/features/holdings/api/holdings";
import { formatCurrency } from "@/lib/utils";
import type { Holding } from "@workspace/domain";
import { toast } from "sonner";
import { HoldingFormDialog } from "./holding-form-dialog";

// --- Types & Constants ---

type SortKey =
  | "name"
  | "symbol"
  | "quantity"
  | "avgBuyPrice"
  | "currentPrice"
  | "investedValue"
  | "currentValue"
  | "totalReturns"
  | "returnsPercentage";

type SortDir = "asc" | "desc";
type AssetType = "stock" | "mutual_fund" | "gold" | "etf" | "pf";

interface AssetConfig {
  label: string; // plural label for empty state
  symbolLabel: string;
  qtyLabel: string;
  avgPriceLabel: string;
  cmpLabel: string;
  qtyDecimals: number;
}

const ASSET_CONFIG: Record<AssetType, AssetConfig> = {
  stock: {
    label: "stocks",
    symbolLabel: "Symbol",
    qtyLabel: "Qty",
    avgPriceLabel: "Avg Price",
    cmpLabel: "CMP",
    qtyDecimals: 0,
  },
  mutual_fund: {
    label: "mutual funds",
    symbolLabel: "Scheme",
    qtyLabel: "Units",
    avgPriceLabel: "Avg NAV",
    cmpLabel: "Current NAV",
    qtyDecimals: 3,
  },
  gold: {
    label: "gold holdings",
    symbolLabel: "Type",
    qtyLabel: "Grams/Units",
    avgPriceLabel: "Avg Buy Price",
    cmpLabel: "Current Price",
    qtyDecimals: 3,
  },
  etf: {
    label: "ETFs",
    symbolLabel: "Symbol",
    qtyLabel: "Qty",
    avgPriceLabel: "Avg Price",
    cmpLabel: "CMP",
    qtyDecimals: 0,
  },
  pf: {
    label: "provident fund entries",
    symbolLabel: "Account",
    qtyLabel: "Balance",
    avgPriceLabel: "Total Contrib.",
    cmpLabel: "Current Value",
    qtyDecimals: 2,
  },
};

// --- Utility Functions ---

const parseNum = (val: string | null | undefined): number =>
  val ? parseFloat(val) : 0;

// --- Sub-Components ---

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  direction: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}

const SortableHeader = ({
  label,
  sortKey,
  currentKey,
  direction,
  onSort,
  className,
}: SortableHeaderProps) => {
  const isActive = sortKey === currentKey;
  const Icon = isActive
    ? direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <TableHead
      className={`cursor-pointer select-none ${className || ""}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center">
        {label}
        <Icon
          className={`ml-1.5 h-3.5 w-3.5 ${isActive ? "" : "opacity-40"}`}
        />
      </span>
    </TableHead>
  );
};

interface HoldingRowProps {
  holding: Holding;
  config: AssetConfig;
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
}

const HoldingRow = ({ holding, config, onEdit, onDelete }: HoldingRowProps) => {
  const returns = parseNum(holding.totalReturns);
  const returnsPct = parseNum(holding.returnsPercentage);
  const isPositive = returns >= 0;

  return (
    <TableRow key={holding.id}>
      <TableCell className="font-medium">
        <div className="flex flex-col gap-1">
          <span className="truncate max-w-[220px]">{holding.name}</span>
          {holding.platform && (
            <Badge
              variant="info"
              className="text-xs text-muted-foreground w-fit"
            >
              {holding.platform}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-mono text-xs">
          {holding.symbol}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {parseNum(holding.quantity).toFixed(config.qtyDecimals)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatCurrency(parseNum(holding.avgBuyPrice))}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {holding.currentPrice
          ? formatCurrency(parseNum(holding.currentPrice))
          : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatCurrency(parseNum(holding.investedValue))}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {holding.currentValue
          ? formatCurrency(parseNum(holding.currentValue))
          : "—"}
      </TableCell>
      <TableCell className="text-right">
        <span
          className={`inline-flex items-center gap-1 tabular-nums font-medium ${
            isPositive ? "text-green-600" : "text-red-600"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {formatCurrency(Math.abs(returns))}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <Badge
          variant={isPositive ? "default" : "destructive"}
          className="tabular-nums font-mono text-xs"
        >
          {isPositive ? "+" : ""}
          {returnsPct.toFixed(2)}%
        </Badge>
      </TableCell>
      <TableCell className="w-[50px]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(holding)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(holding.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

// --- Main Component ---

interface HoldingsTableProps {
  holdings: Holding[];
  isLoading?: boolean;
  assetType: AssetType;
}

export function HoldingsTable({
  holdings,
  isLoading,
  assetType,
}: HoldingsTableProps) {
  const config = ASSET_CONFIG[assetType];

  // State
  const [editHolding, setEditHolding] = useState<Holding | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("investedValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // API
  const deleteMutation = useDeleteHolding();

  // Derived State
  const filtered = useMemo(
    () => holdings.filter((h) => h.assetType === assetType),
    [holdings, assetType],
  );

  const sorted = useMemo(() => {
    const sortedData = [...filtered];
    sortedData.sort((a, b) => {
      const key = sortKey;
      let cmp = 0;

      if (key === "name" || key === "symbol") {
        cmp = (a[key] ?? "").localeCompare(b[key] ?? "");
      } else {
        cmp = parseNum(a[key]) - parseNum(b[key]);
      }

      return sortDir === "asc" ? cmp : -cmp;
    });
    return sortedData;
  }, [filtered, sortKey, sortDir]);

  // Handlers
  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir(key === "name" || key === "symbol" ? "asc" : "desc");
      }
    },
    [sortKey],
  );

  const handleDelete = useCallback(() => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => {
        toast.success("Holding deleted");
        setDeleteId(null);
      },
      onError: () => {
        toast.error("Failed to delete holding");
      },
    });
  }, [deleteId, deleteMutation]);

  // UI States
  if (isLoading) {
    return (
      <div className="space-y-3 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">
          No {config.label} in your portfolio yet.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Import from Groww or add manually using the buttons above.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader
                label="Name"
                sortKey="name"
                currentKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                className="min-w-[220px]"
              />
              <SortableHeader
                label={config.symbolLabel}
                sortKey="symbol"
                currentKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label={config.qtyLabel}
                sortKey="quantity"
                currentKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                className="text-right"
              />
              <SortableHeader
                label={config.avgPriceLabel}
                sortKey="avgBuyPrice"
                currentKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                className="text-right"
              />
              <SortableHeader
                label={config.cmpLabel}
                sortKey="currentPrice"
                currentKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                className="text-right"
              />
              <SortableHeader
                label="Invested"
                sortKey="investedValue"
                currentKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                className="text-right"
              />
              <SortableHeader
                label="Current"
                sortKey="currentValue"
                currentKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                className="text-right"
              />
              <SortableHeader
                label="P&L"
                sortKey="totalReturns"
                currentKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                className="text-right"
              />
              <SortableHeader
                label="P&L %"
                sortKey="returnsPercentage"
                currentKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                className="text-right"
              />
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((holding) => (
              <HoldingRow
                key={holding.id}
                holding={holding}
                config={config}
                onEdit={setEditHolding}
                onDelete={setDeleteId}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      {editHolding && (
        <HoldingFormDialog
          open={!!editHolding}
          onOpenChange={(open) => !open && setEditHolding(null)}
          holding={editHolding}
        />
      )}

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete holding?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove this
              holding from your portfolio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

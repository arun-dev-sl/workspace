import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  bulkUpdateTransactions,
  type BulkUpdateRequest,
} from "@/features/expenses/api/bulk-update-transactions";
import { CATEGORY_OPTIONS } from "@/features/expenses/constants/category-options";
import { LlmCategorizeDialog } from "@/features/expenses/components/llm-categorize-dialog";

import { Badge } from "@workspace/ui/components/ui/badge";
import { Button } from "@workspace/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/ui/dialog";
import { Label } from "@workspace/ui/components/ui/label";
import { Input } from "@workspace/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/ui/select";
import { CheckCircle, CircleAlert, Layers, Sparkles, Tag, X } from "lucide-react";

import type { Transaction } from "@workspace/domain";

const TRANSACTION_MODES = [
  "upi",
  "credit_card",
  "neft",
  "imps",
  "rtgs",
] as const;

interface BulkActionsToolbarProps {
  /** IDs of selected transactions */
  selectedIds: string[];
  /** Full transaction objects for the selected rows */
  selectedTransactions: Transaction[];
  /** Callback to clear the selection after a successful operation */
  onClearSelection: () => void;
}

export function BulkActionsToolbar({
  selectedIds,
  selectedTransactions,
  onClearSelection,
}: BulkActionsToolbarProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [llmDialogOpen, setLlmDialogOpen] = useState(false);

  // ── Dialog form state ──
  const [formCategory, setFormCategory] = useState("");
  const [formSubcategory, setFormSubcategory] = useState("");
  const [formMode, setFormMode] = useState("");
  const [formReview, setFormReview] = useState<string>("");

  const resetForm = () => {
    setFormCategory("");
    setFormSubcategory("");
    setFormMode("");
    setFormReview("");
  };

  const mutation = useMutation({
    mutationFn: (req: BulkUpdateRequest) => bulkUpdateTransactions(req),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["expenses", "transactions"],
      });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      onClearSelection();
      setDialogOpen(false);
      resetForm();
    },
  });

  const handleQuickReview = (requiresReview: boolean) => {
    mutation.mutate({ ids: selectedIds, data: { requiresReview } });
  };

  const handleDialogSubmit = () => {
    const data: BulkUpdateRequest["data"] = {};
    if (formCategory) data.category = formCategory;
    if (formSubcategory) data.subcategory = formSubcategory;
    if (formMode) data.transactionMode = formMode;
    if (formReview === "true" || formReview === "false")
      data.requiresReview = formReview === "true";

    // Only submit if at least one field is set
    if (Object.keys(data).length === 0) return;

    mutation.mutate({ ids: selectedIds, data });
  };

  if (selectedIds.length === 0) return null;

  return (
    <>
      {/* ── Floating bar ── */}
      <div className="sticky bottom-4 z-30 mx-auto flex w-fit items-center gap-2 rounded-lg border bg-background px-4 py-2.5 shadow-lg">
        <Badge variant="secondary" className="tabular-nums">
          {selectedIds.length} selected
        </Badge>

        <div className="mx-1 h-5 w-px bg-border" />

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => handleQuickReview(false)}
          disabled={mutation.isPending}
        >
          <CheckCircle className="size-3.5" />
          Mark Reviewed
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => handleQuickReview(true)}
          disabled={mutation.isPending}
        >
          <CircleAlert className="size-3.5" />
          Needs Review
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => setLlmDialogOpen(true)}
          disabled={mutation.isPending}
        >
          <Sparkles className="size-3.5" />
          Refine with AI
        </Button>

        <Button
          variant="default"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
          disabled={mutation.isPending}
        >
          <Layers className="size-3.5" />
          Edit Details…
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onClearSelection}
        >
          <X className="size-3.5" />
          <span className="sr-only">Clear selection</span>
        </Button>
      </div>

      {/* ── Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit {selectedIds.length} transaction
              {selectedIds.length > 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Only the fields you fill in will be updated. Leave a field empty
              to keep its current value.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            {/* Category */}
            <div className="grid gap-2">
              <Label className="flex items-center gap-1.5">
                <Tag className="size-3.5" />
                Category
              </Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Don't change" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcategory */}
            <div className="grid gap-2">
              <Label>Subcategory</Label>
              <Input
                value={formSubcategory}
                onChange={(e) => setFormSubcategory(e.target.value)}
                placeholder="Optional"
              />
            </div>

            {/* Mode */}
            <div className="grid gap-2">
              <Label>Mode</Label>
              <Select value={formMode} onValueChange={setFormMode}>
                <SelectTrigger>
                  <SelectValue placeholder="Don't change" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_MODES.map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">
                      {m.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Review */}
            <div className="grid gap-2">
              <Label>Review status</Label>
              <Select value={formReview} onValueChange={setFormReview}>
                <SelectTrigger>
                  <SelectValue placeholder="Don't change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Reviewed</SelectItem>
                  <SelectItem value="true">Needs Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDialogSubmit}
              disabled={
                mutation.isPending ||
                (!formCategory && !formSubcategory && !formMode && !formReview)
              }
            >
              {mutation.isPending
                ? "Updating…"
                : `Update ${selectedIds.length} transaction${selectedIds.length > 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LlmCategorizeDialog
        open={llmDialogOpen}
        onOpenChange={setLlmDialogOpen}
        transactions={selectedTransactions}
        onComplete={onClearSelection}
      />
    </>
  );
}

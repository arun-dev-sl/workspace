import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Sparkles,
  Check,
  Info,
  ArrowRight,
  RotateCcw,
} from "lucide-react";

import { Badge } from "@workspace/ui/components/ui/badge";
import { Button } from "@workspace/ui/components/ui/button";
import { Checkbox } from "@workspace/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/ui/dialog";
import { Input } from "@workspace/ui/components/ui/input";
import { Label } from "@workspace/ui/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/ui/tooltip";

import {
  fetchLlmProviders,
  requestLlmCategorization,
  type LlmProvider,
  type LlmCategorizationSuggestion,
} from "@/features/expenses/api/llm-categorize";
import {
  bulkUpdateTransactions,
  type BulkUpdateRequest,
} from "@/features/expenses/api/bulk-update-transactions";
import { CATEGORY_OPTIONS } from "@/features/expenses/constants/category-options";

import type { Transaction } from "@workspace/domain";

interface LlmCategorizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
  onComplete: () => void;
}

type DialogStep = "select-provider" | "processing" | "review";

interface EditableSuggestion extends LlmCategorizationSuggestion {
  included: boolean;
  originalCategory: string;
  merchantName: string;
  amount: number;
}

function getCategoryMeta(value: string) {
  return CATEGORY_OPTIONS.find((c) => c.value === value);
}

function getConfidenceLabel(confidence: number) {
  if (confidence >= 0.9) return { text: "High", className: "text-emerald-600" };
  if (confidence >= 0.7)
    return { text: "Medium", className: "text-amber-600" };
  return { text: "Low", className: "text-red-500" };
}

export function LlmCategorizeDialog({
  open,
  onOpenChange,
  transactions,
  onComplete,
}: LlmCategorizeDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<DialogStep>("select-provider");
  const [provider, setProvider] = useState<LlmProvider>("openwire");
  const [suggestions, setSuggestions] = useState<EditableSuggestion[]>([]);

  const providersQuery = useQuery({
    queryKey: ["expenses", "llm-providers"],
    queryFn: fetchLlmProviders,
    enabled: open,
  });

  const categorizeMutation = useMutation({
    mutationFn: () =>
      requestLlmCategorization(
        transactions.map((t) => t.id),
        provider,
      ),
    onSuccess: (data) => {
      const txnMap = new Map(transactions.map((t) => [t.id, t]));
      const editable: EditableSuggestion[] = data.map((suggestion) => {
        const txn = txnMap.get(suggestion.id);
        return {
          ...suggestion,
          included: true,
          originalCategory: txn?.category ?? "uncategorized",
          merchantName: txn?.merchant ?? "Unknown",
          amount: txn?.amount ?? 0,
        };
      });
      setSuggestions(editable);
      setStep("review");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const included = suggestions.filter((s) => s.included);
      if (included.length === 0) return { updatedCount: 0 };

      const requests: Promise<{ updatedCount: number }>[] = [];
      const byCategory = new Map<
        string,
        { ids: string[]; category: string; subcategory: string }
      >();

      for (const s of included) {
        const key = `${s.category}::${s.subcategory}`;
        const existing = byCategory.get(key);
        if (existing) {
          existing.ids.push(s.id);
        } else {
          byCategory.set(key, {
            ids: [s.id],
            category: s.category,
            subcategory: s.subcategory,
          });
        }
      }

      for (const group of byCategory.values()) {
        const req: BulkUpdateRequest = {
          ids: group.ids,
          data: {
            category: group.category,
            subcategory: group.subcategory,
          },
        };
        requests.push(bulkUpdateTransactions(req));
      }

      const results = await Promise.all(requests);
      return {
        updatedCount: results.reduce((sum, r) => sum + r.updatedCount, 0),
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["expenses", "transactions"],
      });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      onComplete();
      handleClose();
    },
  });

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(() => {
      setStep("select-provider");
      setSuggestions([]);
      categorizeMutation.reset();
      saveMutation.reset();
    }, 200);
  }, [onOpenChange, categorizeMutation, saveMutation]);

  const handleCategorize = () => {
    setStep("processing");
    categorizeMutation.mutate();
  };

  const toggleSuggestion = (id: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, included: !s.included } : s)),
    );
  };

  const updateSuggestionCategory = (id: string, category: string) => {
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, category, subcategory: category } : s,
      ),
    );
  };

  const updateSuggestionSubcategory = (id: string, subcategory: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, subcategory } : s)),
    );
  };

  const includedCount = suggestions.filter((s) => s.included).length;
  const changedCount = suggestions.filter(
    (s) => s.included && s.category !== s.originalCategory,
  ).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        {step === "select-provider" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="size-5" />
                Refine with AI
              </DialogTitle>
              <DialogDescription>
                Send {transactions.length} transaction
                {transactions.length !== 1 ? "s" : ""} to an AI model for
                smarter categorization. You can review and edit the suggestions
                before saving.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Label className="mb-3 block text-sm font-medium">
                Choose AI Provider
              </Label>
              <RadioGroup
                value={provider}
                onValueChange={(v) => setProvider(v as LlmProvider)}
                className="grid grid-cols-2 gap-3"
              >
                <label
                  htmlFor="provider-openwire"
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                    provider === "openwire"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  } ${
                    providersQuery.data && !providersQuery.data.openwire
                      ? "cursor-not-allowed opacity-50"
                      : ""
                  }`}
                >
                  <RadioGroupItem
                    value="openwire"
                    id="provider-openwire"
                    disabled={
                      providersQuery.data && !providersQuery.data.openwire
                    }
                  />
                  <div>
                    <p className="text-sm font-medium">OpenWire</p>
                    <p className="text-xs text-muted-foreground">
                      Local AI via OpenWire proxy
                    </p>
                    {providersQuery.data && !providersQuery.data.openwire && (
                      <p className="mt-1 text-xs text-destructive">
                        Unavailable
                      </p>
                    )}
                  </div>
                </label>

                <label
                  htmlFor="provider-gemini"
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                    provider === "gemini"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  } ${
                    providersQuery.data && !providersQuery.data.gemini
                      ? "cursor-not-allowed opacity-50"
                      : ""
                  }`}
                >
                  <RadioGroupItem
                    value="gemini"
                    id="provider-gemini"
                    disabled={
                      providersQuery.data && !providersQuery.data.gemini
                    }
                  />
                  <div>
                    <p className="text-sm font-medium">Gemini</p>
                    <p className="text-xs text-muted-foreground">
                      Google Gemini 2.5 Flash
                    </p>
                    {providersQuery.data && !providersQuery.data.gemini && (
                      <p className="mt-1 text-xs text-destructive">
                        No API key configured
                      </p>
                    )}
                  </div>
                </label>
              </RadioGroup>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleCategorize}
                disabled={
                  providersQuery.isLoading ||
                  (providersQuery.data && !providersQuery.data[provider])
                }
              >
                <Sparkles className="mr-2 size-4" />
                Categorize {transactions.length} transaction
                {transactions.length !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "processing" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="size-5" />
                AI Categorization
              </DialogTitle>
              <DialogDescription>
                Analyzing {transactions.length} transaction
                {transactions.length !== 1 ? "s" : ""} with{" "}
                {provider === "openwire" ? "OpenWire" : "Gemini"}...
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center gap-4 py-12">
              {categorizeMutation.isError ? (
                <>
                  <p className="text-sm text-destructive">
                    {categorizeMutation.error instanceof Error
                      ? categorizeMutation.error.message
                      : "An error occurred during categorization"}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStep("select-provider");
                        categorizeMutation.reset();
                      }}
                    >
                      <RotateCcw className="mr-2 size-3.5" />
                      Try Again
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleClose}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    The AI is analyzing your transactions...
                  </p>
                </>
              )}
            </div>
          </>
        )}

        {step === "review" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="size-5" />
                Review Suggestions
              </DialogTitle>
              <DialogDescription>
                {suggestions.length} suggestion
                {suggestions.length !== 1 ? "s" : ""} returned.{" "}
                {changedCount > 0
                  ? `${changedCount} categor${changedCount !== 1 ? "ies" : "y"} changed.`
                  : "No category changes suggested."}{" "}
                Edit or uncheck any you want to skip.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="w-8 pb-2" />
                    <th className="pb-2">Merchant</th>
                    <th className="pb-2 text-right">Amount</th>
                    <th className="pb-2">Current</th>
                    <th className="w-6 pb-2" />
                    <th className="pb-2">Suggested</th>
                    <th className="pb-2">Subcategory</th>
                    <th className="w-20 pb-2">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {suggestions.map((s) => {
                    const currentMeta = getCategoryMeta(s.originalCategory);
                    const suggestedMeta = getCategoryMeta(s.category);
                    const confidenceInfo = getConfidenceLabel(s.confidence);
                    const changed = s.category !== s.originalCategory;

                    return (
                      <tr
                        key={s.id}
                        className={`${!s.included ? "opacity-40" : ""} transition-opacity`}
                      >
                        <td className="py-2.5 pr-2">
                          <Checkbox
                            checked={s.included}
                            onCheckedChange={() => toggleSuggestion(s.id)}
                          />
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="line-clamp-1 max-w-[140px] text-xs font-medium">
                            {s.merchantName}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-xs">
                          {s.amount.toLocaleString("en-IN", {
                            style: "currency",
                            currency: "INR",
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="py-2.5 pr-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] capitalize"
                            style={{
                              borderColor: currentMeta?.color,
                              color: currentMeta?.color,
                            }}
                          >
                            {currentMeta?.label ??
                              s.originalCategory.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-1">
                          {changed && (
                            <ArrowRight className="size-3 text-muted-foreground" />
                          )}
                        </td>
                        <td className="py-2.5 pr-2">
                          <Select
                            value={s.category}
                            onValueChange={(v) =>
                              updateSuggestionCategory(s.id, v)
                            }
                          >
                            <SelectTrigger className="h-7 w-[140px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORY_OPTIONS.map((cat) => (
                                <SelectItem
                                  key={cat.value}
                                  value={cat.value}
                                  className="text-xs"
                                >
                                  <span className="flex items-center gap-1.5">
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
                        </td>
                        <td className="py-2.5 pr-2">
                          <Input
                            value={s.subcategory}
                            onChange={(e) =>
                              updateSuggestionSubcategory(
                                s.id,
                                e.target.value,
                              )
                            }
                            className="h-7 w-[120px] text-xs"
                          />
                        </td>
                        <td className="py-2.5">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className={`flex items-center gap-1 text-xs ${confidenceInfo.className}`}
                                >
                                  {confidenceInfo.text}
                                  <Info className="size-3 text-muted-foreground" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="left"
                                className="max-w-xs text-xs"
                              >
                                <p>{s.reasoning}</p>
                                <p className="mt-1 font-mono text-muted-foreground">
                                  {(s.confidence * 100).toFixed(0)}% confidence
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <DialogFooter className="gap-2 border-t pt-4">
              <Button variant="outline" onClick={handleClose}>
                Discard
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={includedCount === 0 || saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 size-4" />
                    Save {includedCount} suggestion
                    {includedCount !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

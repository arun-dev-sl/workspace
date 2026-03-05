import { useState } from "react";
import { Upload, ClipboardPaste, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/ui/dialog";
import { Button } from "@workspace/ui/components/ui/button";
import { Textarea } from "@workspace/ui/components/ui/textarea";
import { Separator } from "@workspace/ui/components/ui/separator";
import { toast } from "sonner";

import { useImportPrincipal } from "../api/principal";

interface ImportPrincipalDialogProps {
  trigger?: React.ReactNode;
}

export function ImportPrincipalDialog({ trigger }: ImportPrincipalDialogProps) {
  const [open, setOpen] = useState(false);
  const [contributionText, setContributionText] = useState("");
  const [distributionText, setDistributionText] = useState("");
  const importMutation = useImportPrincipal();

  const handleImport = () => {
    if (!contributionText.trim() && !distributionText.trim()) {
      toast.error("No data to import", {
        description: "Paste at least one type of data.",
      });
      return;
    }

    importMutation.mutate(
      {
        contributions: contributionText || undefined,
        distribution: distributionText || undefined,
      },
      {
        onSuccess: (data) => {
          const parts: string[] = [];
          if (data.contributions.parsed > 0)
            parts.push(`${data.contributions.parsed} months`);
          if (data.distribution.parsed > 0)
            parts.push(`${data.distribution.parsed} asset classes`);

          toast.success(`Data imported: ${parts.join(", ")}`, {
            description: "Charts and metrics updated.",
          });

          setContributionText("");
          setDistributionText("");
          setOpen(false);
        },
        onError: (error: any) => {
          toast.error("Import failed", {
            description:
              error.response?.data?.message?.[0] ||
              error.response?.data?.message ||
              error.message,
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <ClipboardPaste className="mr-2 h-4 w-4" />
            Paste Investment Data
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Principal Investment Data</DialogTitle>
          <DialogDescription>
            Paste your monthly contribution data and/or asset distribution
            below. Data is saved to your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Monthly Contributions */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Monthly Contributions{" "}
              <span className="text-muted-foreground font-normal">
                (amounts in Lakhs)
              </span>
            </label>
            <Textarea
              placeholder={`Jan 25\t1.14\nFeb 25\t1.09\nMar 25\t2.14\nApr 25\t1.45\nMay 25\t1.31\nJun 25\t1.36`}
              value={contributionText}
              onChange={(e) => setContributionText(e.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Format: <code>Month [Year] Amount</code> — one per line. Tab or
              space separated. Year is optional (auto-inferred).
            </p>
          </div>

          <Separator />

          {/* Asset Distribution */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Asset Distribution{" "}
              <span className="text-muted-foreground font-normal">
                (amounts in INR)
              </span>
            </label>
            <Textarea
              placeholder={`Stocks 2,024,203.00\nMutual Funds 1,410,376.00\nPF 426,790.00\nGold 84,490.00`}
              value={distributionText}
              onChange={(e) => setDistributionText(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Format: <code>Asset Name Amount</code> — one per line. Commas in
              numbers are fine.
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importMutation.isPending}>
            {importMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {importMutation.isPending ? "Importing..." : "Parse & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

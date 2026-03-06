import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";
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
import { useImportDividends } from "@/features/dividends/api/dividends";
import { toast } from "sonner";

interface ImportDividendsDialogProps {
  trigger?: React.ReactNode;
}

export function ImportDividendsDialog({ trigger }: ImportDividendsDialogProps) {
  const [open, setOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const importMutation = useImportDividends();

  const handleImport = () => {
    if (!jsonInput.trim()) return;

    importMutation.mutate(jsonInput, {
      onSuccess: (data) => {
        const parts: string[] = [];
        if (data.imported > 0) parts.push(`${data.imported} new`);
        if (data.updated > 0) parts.push(`${data.updated} updated`);
        toast.success(`Dividends imported: ${parts.join(", ")}`, {
          description:
            data.errors.length > 0 ? `${data.errors.length} errors` : undefined,
        });
        setJsonInput("");
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
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import Dividends
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Dividend Report</DialogTitle>
          <DialogDescription>
            Paste the dividend report JSON. Existing entries with the same ISIN
            + ex-date will be updated; new entries will be created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            placeholder={`{
  "reportPeriod": {
    "from": "2025-04-01",
    "to": "2026-03-31"
  },
  "totalAmount": 12345.67,
  "entries": [
    {
      "companyName": "Infosys Ltd",
      "isin": "INE009A01021",
      "exDate": "2025-10-29",
      "shares": 100,
      "dividendPerShare": 20.50,
      "amount": 2050.00
    }
  ]
}`}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            rows={14}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Supports the DividendReport JSON format with reportPeriod,
            totalAmount, and entries array.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!jsonInput.trim() || importMutation.isPending}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

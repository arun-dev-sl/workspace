import { useState } from "react";
import { Plus } from "lucide-react";
import { MainLayout } from "@/components/layouts";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/ui/tabs";
import { Button } from "@workspace/ui/components/ui/button";
import { useHoldings } from "@/features/holdings/api/holdings";
import { PortfolioSummary } from "@/features/holdings/components/portfolio-summary";
import { HoldingsTable } from "@/features/holdings/components/holdings-table";
import { ImportGrowwDialog } from "@/features/holdings/components/import-groww-dialog";
import { HoldingFormDialog } from "@/features/holdings/components/holding-form-dialog";

export default function HoldingsPage() {
  const { data: holdings = [], isLoading } = useHoldings();
  const [addOpen, setAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("stocks");

  const stockCount = holdings.filter((h) => h.assetType === "stock").length;
  const mfCount = holdings.filter((h) => h.assetType === "mutual_fund").length;
  const goldCount = holdings.filter((h) => h.assetType === "gold").length;
  const pfCount = holdings.filter((h) => h.assetType === "pf").length;

  return (
    <MainLayout>
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        {/* Header */}
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                Holdings
              </p>
              <h1 className="text-2xl font-semibold text-foreground">
                Investment Allocation
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Track your complete investment portfolio
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ImportGrowwDialog />
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Holding
              </Button>
            </div>
          </div>
        </header>

        {/* Summary Cards */}
        <PortfolioSummary />

        {/* Tabs: Stocks / Mutual Funds */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full overflow-x-auto">
            <TabsTrigger value="stocks">
              Stocks{stockCount > 0 && ` (${stockCount})`}
            </TabsTrigger>
            <TabsTrigger value="mutual_funds">
              Mutual Funds{mfCount > 0 && ` (${mfCount})`}
            </TabsTrigger>
            <TabsTrigger value="gold">
              Gold{goldCount > 0 && ` (${goldCount})`}
            </TabsTrigger>
            <TabsTrigger value="pf">
              Provident Fund{pfCount > 0 && ` (${pfCount})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stocks" className="mt-4">
            <HoldingsTable
              holdings={holdings}
              isLoading={isLoading}
              assetType="stock"
            />
          </TabsContent>

          <TabsContent value="mutual_funds" className="mt-4">
            <HoldingsTable
              holdings={holdings}
              isLoading={isLoading}
              assetType="mutual_fund"
            />
          </TabsContent>

          <TabsContent value="gold" className="mt-4">
            <HoldingsTable
              holdings={holdings}
              isLoading={isLoading}
              assetType="gold"
            />
          </TabsContent>

          <TabsContent value="pf" className="mt-4">
            <HoldingsTable
              holdings={holdings}
              isLoading={isLoading}
              assetType="pf"
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Holding Dialog */}
      <HoldingFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultAssetType={
          activeTab === "mutual_funds"
            ? "mutual_fund"
            : activeTab === "gold"
              ? "gold"
              : activeTab === "pf"
                ? "pf"
                : "stock"
        }
      />
    </MainLayout>
  );
}

import { useMemo, useState } from 'react'
import { MainLayout } from '@/components/layouts'
import { useAiPageContext } from '@/features/ai-assistant/ai-assistant-context'
import { buildDividendsPageContext } from '@/features/ai-assistant/adapters/dividends-context'
import { useDividendDashboard } from '@/features/dividends/api/dividends'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@workspace/ui/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/ui/select'
import { ImportDividendsDialog } from '@/features/dividends/components/import-dividends-dialog'
import { DividendsTable } from '@/features/dividends/components/dividends-table'
import { DividendDashboardView } from '@/features/dividends/components/dividend-dashboard'

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

export default function DividendsPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const { data: dashboard } = useDividendDashboard(selectedYear)

  const aiPageContext = useMemo(
    () =>
      buildDividendsPageContext({
        activeTab,
        selectedYear,
        dashboard,
      }),
    [activeTab, dashboard, selectedYear],
  )

  useAiPageContext(aiPageContext)

  return (
    <MainLayout>
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        {/* Header */}
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                Dividends
              </p>
              <h1 className="text-2xl font-semibold text-foreground">
                Dividend Income
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Track and analyze your dividend income across all holdings
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      FY {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ImportDividendsDialog />
            </div>
          </div>
        </header>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="all">All Dividends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <DividendDashboardView year={selectedYear} />
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <DividendsTable />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type RowSelectionState,
} from '@tanstack/react-table'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { format } from 'date-fns'

import { MainLayout } from '@/components/layouts'
import { connectGmail } from '@/features/expenses/api/connect-gmail'
import { disconnectGmail } from '@/features/expenses/api/disconnect-gmail'
import { fetchGmailStatus } from '@/features/expenses/api/gmail-status'
import { listExpenseEmails } from '@/features/expenses/api/list-expense-emails'
import { listExpenses } from '@/features/expenses/api/list-expenses'
import {
  updateTransaction,
  type UpdateTransactionInput,
} from '@/features/expenses/api/update-transaction'
import { useSyncJob } from '@/features/expenses/hooks/use-sync-job'
import { MerchantCategorizeDialog } from '@/features/expenses/components/merchant-categorize-dialog'
import { BulkActionsToolbar } from '@/features/expenses/components/bulk-actions-toolbar'
import { CATEGORY_OPTIONS } from '@/features/expenses/constants/category-options'
import { Badge } from '@workspace/ui/components/ui/badge'
import { Button } from '@workspace/ui/components/ui/button'
import { Calendar } from '@workspace/ui/components/ui/calendar'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@workspace/ui/components/ui/alert'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/ui/card'
import { Checkbox } from '@workspace/ui/components/ui/checkbox'
import { Input } from '@workspace/ui/components/ui/input'
import { Label } from '@workspace/ui/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@workspace/ui/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@workspace/ui/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/ui/table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@workspace/ui/components/ui/tabs'
import {
  Dot,
  MailSearch,
  MoreVertical,
  Pencil,
  RotateCw,
  RefreshCcw,
  Unplug,
  AlertTriangle,
  IndianRupee,
  Send,
  ArrowLeft,
  ArrowRight,
  CreditCard,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { appPaths } from '@/config/app-paths'
import type { Transaction } from '@workspace/domain'
import {
  SelectFilter,
  DateRangeFilter,
  SearchFilter,
  type FilterOption,
} from '@/components/filters'
import { useDebounce } from '@/hooks/use-debounce'
import { Separator } from '@workspace/ui/components/ui/separator'
import { Skeleton } from '@workspace/ui/components/ui/skeleton'
import { cn } from '@workspace/ui/lib/utils'

const TRANSACTION_TYPES = ['debited', 'credited'] as const
const TRANSACTION_MODES = [
  'upi',
  'credit_card',
  'neft',
  'imps',
  'rtgs',
] as const
function getCategoryMeta(value: string) {
  return CATEGORY_OPTIONS.find((c) => c.value === value)
}

const CATEGORY_FILTER_OPTIONS: FilterOption[] = CATEGORY_OPTIONS.map((c) => ({
  value: c.value,
  label: c.label,
  color: c.color,
}))

const MODE_FILTER_OPTIONS: FilterOption[] = TRANSACTION_MODES.map((m) => ({
  value: m,
  label: m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}))

const REVIEW_FILTER_OPTIONS: FilterOption[] = [
  { value: 'true', label: 'Needs Review' },
  { value: 'false', label: 'Reviewed' },
]

type ExpenseView = 'expense' | 'emails'

type RawEmail = {
  id: string
  userId: string
  provider: string
  providerMessageId: string
  from: string
  subject: string
  receivedAt: string
  bodyText: string
  bodyHtml?: string
  rawHeaders: Record<string, string>
}

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return format(date, "MMM d, yyyy 'at' h:mm a")
}

const formatAmount = (transaction: Transaction) => {
  const signedAmount =
    transaction.transactionType === 'debited'
      ? -Math.abs(transaction.amount)
      : Math.abs(transaction.amount)

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: transaction.currency,
    }).format(signedAmount)
  } catch {
    const sign = signedAmount < 0 ? '-' : ''
    return `${sign}${transaction.currency} ${Math.abs(signedAmount).toFixed(2)}`
  }
}

const emailColumns: ColumnDef<RawEmail>[] = [
  {
    accessorKey: 'from',
    header: 'From',
    cell: ({ row }) => (
      <div className="font-medium text-foreground">
        {row.getValue('from') || 'Unknown sender'}
      </div>
    ),
  },
  {
    accessorKey: 'subject',
    header: 'Subject',
    cell: ({ row }) => (
      <div className="max-w-125 truncate">
        {row.getValue('subject') || '(no subject)'}
      </div>
    ),
  },
  {
    accessorKey: 'receivedAt',
    header: 'Received',
    cell: ({ row }) => formatDate(row.getValue('receivedAt')),
  },
  {
    accessorKey: 'provider',
    header: 'Provider',
    cell: ({ row }) => (
      <Badge variant="secondary" className="capitalize">
        {row.getValue('provider')}
      </Badge>
    ),
  },
]

const buildExpenseColumns = (
  onEdit: (transaction: Transaction) => void,
): ColumnDef<Transaction>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={
          table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-0.5"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-0.5"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'transactionDate',
    header: 'Date',
    cell: ({ row }) => formatDate(row.original.transactionDate),
  },
  {
    accessorKey: 'merchant',
    header: 'Merchant',
    cell: ({ row }) => (
      <div className="flex gap-2 items-center max-w-72">
        <div className="font-medium text-foreground">
          {row.original.merchant}
        </div>
        <Badge className="ml-2 text-[10px] p-0.5 px-2" variant={'outline'}>
          <div className="h-fit max-w-30 flex gap-1 items-center">
            <p className="truncate">
              {row.original.cardName ??
                row.original.vpa ??
                row.original.merchantRaw ??
                'Unknown source'}
            </p>
            {row.original.cardName && <CreditCard className={cn('size-3')} />}
          </div>
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => (
      <div
        className={
          row.original.transactionType === 'debited'
            ? 'font-medium text-red-600'
            : 'font-medium text-emerald-600'
        }
      >
        {formatAmount(row.original)}
      </div>
    ),
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => {
      const meta = getCategoryMeta(row.original.category)
      return (
        <Badge
          variant="secondary"
          className="capitalize"
          style={{
            borderColor: meta?.color,
            color: meta?.color,
          }}
        >
          <span
            className="inline-block size-2 rounded-full mr-1.5"
            style={{ backgroundColor: meta?.color ?? '#95A5A6' }}
          />
          {meta?.label ?? row.original.category.replace(/_/g, ' ')}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'transactionMode',
    header: 'Mode',
    cell: ({ row }) => (
      <span className="capitalize">
        {row.original.transactionMode.replace(/_/g, ' ')}
      </span>
    ),
  },
  {
    accessorKey: 'confidence',
    header: 'Confidence',
    cell: ({ row }) => (
      <span className="capitalize">{row.original.confidence}</span>
    ),
  },
  {
    accessorKey: 'requiresReview',
    header: 'Review',
    cell: ({ row }) =>
      row.original.requiresReview ? (
        <Badge variant="outline">Required</Badge>
      ) : (
        <Badge variant="secondary">Done</Badge>
      ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={(e) => {
          e.stopPropagation()
          onEdit(row.original)
        }}
      >
        <Pencil className="size-3.5" />
        <span className="sr-only">Edit transaction</span>
      </Button>
    ),
  },
]

function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, (latest) => Math.round(latest))

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.4,
      ease: 'easeOut',
    })
    return controls.stop
  }, [value, mv])

  return <motion.span>{rounded}</motion.span>
}

const ExpenseEmailsPage = () => {
  const queryClient = useQueryClient()
  const [activeView, setActiveView] = useState<ExpenseView>('expense')
  const [emailPageIndex, setEmailPageIndex] = useState(0)
  const [expensePageIndex, setExpensePageIndex] = useState(0)
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null)
  const pageSize = 20
  const navigate = useNavigate()

  // ── Row selection ──
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  // ── Filter state ──
  const [filterCategory, setFilterCategory] = useState('')
  const [filterMode, setFilterMode] = useState('')
  const [filterReview, setFilterReview] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState<string | undefined>()
  const [filterDateTo, setFilterDateTo] = useState<string | undefined>()
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 300)

  const hasActiveFilters =
    filterCategory ||
    filterMode ||
    filterReview ||
    filterDateFrom ||
    filterDateTo ||
    debouncedSearch

  // Reset to first page and clear selection whenever filters change
  useEffect(() => {
    setExpensePageIndex(0)
    setRowSelection({})
  }, [
    filterCategory,
    filterMode,
    filterReview,
    filterDateFrom,
    filterDateTo,
    debouncedSearch,
  ])

  // ── Edit form state ──
  const [editForm, setEditForm] = useState<UpdateTransactionInput>({})

  const openEditSheet = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setEditForm({
      merchant: transaction.merchant,
      category: transaction.category,
      subcategory: transaction.subcategory ?? '',
      transactionType: transaction.transactionType as
        | 'debited'
        | 'credited'
        | undefined,
      transactionMode: transaction.transactionMode as
        | 'upi'
        | 'credit_card'
        | 'neft'
        | 'imps'
        | 'rtgs'
        | undefined,
      amount: transaction.amount,
      currency: transaction.currency,
      requiresReview: transaction.requiresReview,
    })
  }

  const closeEditSheet = () => {
    setEditingTransaction(null)
    setEditForm({})
  }

  const updateMutation = useMutation({
    mutationFn: (params: { id: string; data: UpdateTransactionInput }) =>
      updateTransaction(params.id, params.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['expenses', 'transactions'],
      })
      closeEditSheet()
    },
  })

  const handleSaveEdit = () => {
    if (!editingTransaction) return
    updateMutation.mutate({
      id: editingTransaction.id,
      data: editForm,
    })
  }

  const expenseColumns = useMemo(
    () => buildExpenseColumns(openEditSheet),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const {
    data: emailData,
    isLoading: isEmailsLoading,
    isError: isEmailsError,
  } = useQuery({
    queryKey: ['expenses', 'emails', emailPageIndex + 1],
    queryFn: () =>
      listExpenseEmails({ page: emailPageIndex + 1, page_size: pageSize }),
    enabled: activeView === 'emails',
  })

  const {
    data: expensesData,
    isLoading: isExpensesLoading,
    isError: isExpensesError,
  } = useQuery({
    queryKey: [
      'expenses',
      'transactions',
      expensePageIndex + 1,
      filterCategory,
      filterMode,
      filterReview,
      filterDateFrom,
      filterDateTo,
      debouncedSearch,
    ],
    queryFn: () =>
      listExpenses({
        page: expensePageIndex + 1,
        page_size: pageSize,
        ...(filterCategory && { category: filterCategory }),
        ...(filterMode && { mode: filterMode }),
        ...(filterReview && { review: filterReview }),
        ...(filterDateFrom && { date_from: filterDateFrom }),
        ...(filterDateTo && { date_to: filterDateTo }),
        ...(debouncedSearch && { search: debouncedSearch }),
      }),
    enabled: activeView === 'expense',
  })

  const emailTable = useReactTable({
    data: emailData?.data ?? [],
    columns: emailColumns,
    pageCount: emailData ? Math.ceil(emailData.total / emailData.page_size) : 0,
    state: {
      pagination: {
        pageIndex: emailPageIndex,
        pageSize,
      },
    },
    onPaginationChange: (updater) => {
      if (typeof updater === 'function') {
        const newState = updater({ pageIndex: emailPageIndex, pageSize })
        setEmailPageIndex(newState.pageIndex)
      } else {
        setEmailPageIndex(updater.pageIndex)
      }
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  })

  const expenseTable = useReactTable({
    data: expensesData?.data ?? [],
    columns: expenseColumns,
    pageCount: expensesData
      ? Math.ceil(expensesData.total / expensesData.page_size)
      : 0,
    state: {
      pagination: {
        pageIndex: expensePageIndex,
        pageSize,
      },
      rowSelection,
    },
    onPaginationChange: (updater) => {
      if (typeof updater === 'function') {
        const newState = updater({ pageIndex: expensePageIndex, pageSize })
        setExpensePageIndex(newState.pageIndex)
      } else {
        setExpensePageIndex(updater.pageIndex)
      }
      setRowSelection({})
    },
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  })

  const statusQuery = useQuery({
    queryKey: ['expenses', 'gmail-status'],
    queryFn: fetchGmailStatus,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const connectMutation = useMutation({
    mutationFn: connectGmail,
    onSuccess: (data) => {
      window.location.assign(data.url)
    },
  })

  const {
    startSync,
    startReprocess,
    job,
    isSyncing,
    error: syncError,
    reset: resetSyncState,
  } = useSyncJob()
  const [syncDateOpen, setSyncDateOpen] = useState(false)
  const [syncFromDate, setSyncFromDate] = useState<Date | undefined>()
  const requiresGmailReconnect =
    syncError?.message.includes('Reconnect Gmail') ?? false
  const displayedProcessedEmails =
    job?.totalEmails != null
      ? Math.min(job.processedEmails, job.totalEmails)
      : (job?.processedEmails ?? 0)
  const syncProgressWidth =
    job?.totalEmails && job.totalEmails > 0
      ? `${Math.min((displayedProcessedEmails / job.totalEmails) * 100, 100)}%`
      : '5%'

  const disconnectMutation = useMutation({
    mutationFn: disconnectGmail,
    onSuccess: () => {
      queryClient.setQueryData(['expenses', 'gmail-status'], {
        connected: false,
        email: null,
      })
      queryClient
        .invalidateQueries({ queryKey: ['expenses', 'gmail-status'] })
        .then(() => {
          void statusQuery.refetch()
        })
    },
  })

  const handleSyncFromDate = () => {
    if (!syncFromDate) {
      startSync()
      setSyncDateOpen(false)
      return
    }

    startSync({ fromDate: format(syncFromDate, 'yyyy-MM-dd') })
    setSyncDateOpen(false)
  }

  return (
    <MainLayout>
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Expenses
            </p>
            <h1 className="text-2xl font-semibold text-foreground">Expenses</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              View derived expense transactions and source emails.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="default"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
            >
              <MailSearch />
              {statusQuery.data?.connected
                ? 'Reconnect Gmail'
                : 'Connect Gmail'}
            </Button>
            <Button
              variant="outline"
              onClick={() => disconnectMutation.mutate()}
              disabled={
                !statusQuery.data?.connected || disconnectMutation.isPending
              }
            >
              <Unplug />
              Disconnect Gmail
            </Button>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  onClick={() => startSync()}
                  disabled={!statusQuery.data?.connected || isSyncing}
                  className="relative overflow-hidden"
                >
                  <RefreshCcw />
                  {isSyncing && job?.query !== '__reprocess__' && (
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/20 transition-all duration-300"
                      style={{
                        width: syncProgressWidth,
                      }}
                    />
                  )}

                  <span className="relative z-10">
                    {job?.status === 'processing' &&
                    job?.query !== '__reprocess__' &&
                    job.totalEmails ? (
                      <>
                        Syncing (
                        <AnimatedNumber
                          value={displayedProcessedEmails}
                        /> / {job.totalEmails})
                      </>
                    ) : job?.status === 'completed' &&
                      job?.query !== '__reprocess__' ? (
                      'Synced'
                    ) : (
                      'Sync'
                    )}
                  </span>
                </Button>
                <Popover open={syncDateOpen} onOpenChange={setSyncDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={!statusQuery.data?.connected || isSyncing}
                    >
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Sync options</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-3 relative">
                    <div className="space-y-3">
                      <Calendar
                        mode="single"
                        selected={syncFromDate}
                        onSelect={setSyncFromDate}
                        disabled={(date) => date > new Date()}
                        autoFocus
                      />
                      <div className="flex items-center justify-between gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSyncFromDate(undefined)}
                          disabled={!syncFromDate}
                        >
                          Clear
                        </Button>
                        <Button size="sm" onClick={handleSyncFromDate}>
                          {syncFromDate
                            ? `Sync from ${format(syncFromDate, 'MMM d, yyyy')}`
                            : 'Run default sync'}
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={startReprocess}
              disabled={isSyncing}
              className="relative overflow-hidden"
            >
              <RotateCw />
              {isSyncing && job?.query === '__reprocess__' && (
                <div
                  className="absolute inset-y-0 left-0 bg-primary/20 transition-all duration-300"
                  style={{
                    width: syncProgressWidth,
                  }}
                />
              )}
              <span className="relative z-10">
                {job?.query === '__reprocess__' &&
                job?.status === 'processing' &&
                job.totalEmails ? (
                  <>
                    Reprocessing (
                    <AnimatedNumber value={displayedProcessedEmails} /> /{' '}
                    {job.totalEmails})
                  </>
                ) : job?.query === '__reprocess__' &&
                  job?.status === 'completed' ? (
                  'Reprocessed'
                ) : (
                  'Reprocess'
                )}
              </span>
            </Button>

            {statusQuery.data?.connected ? (
              <Badge
                className="flex gap-0 items-center p-1 pr-2"
                variant={'outline'}
              >
                <Dot className="text-teal-500 size-6" />
                <p className="-ml-2">
                  Connected
                  {statusQuery.data.email ? ` • ${statusQuery.data.email}` : ''}
                </p>
              </Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>

          {syncError ? (
            <Alert variant="destructive" className="max-w-2xl">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {requiresGmailReconnect ? 'Reconnect Gmail' : 'Sync failed'}
              </AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-2">
                <span>{syncError.message}</span>
                {requiresGmailReconnect ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      resetSyncState()
                      connectMutation.mutate()
                    }}
                    disabled={connectMutation.isPending}
                  >
                    Reconnect Gmail
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={resetSyncState}>
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
        </header>

        <Tabs
          value={activeView}
          onValueChange={(value) => setActiveView(value as ExpenseView)}
        >
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {activeView === 'expense' ? 'All Expenses' : 'Recent Emails'}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 justify-center">
                {activeView === 'expense' && <MerchantCategorizeDialog />}
                <TabsList className="ml-2">
                  <TabsTrigger value="expense" className="flex gap-1">
                    <IndianRupee className="size-4" />
                    Expense
                  </TabsTrigger>
                  <TabsTrigger value="emails" className="flex gap-1">
                    <Send className="size-4" />
                    Emails
                  </TabsTrigger>
                </TabsList>
                <Badge variant="outline">
                  {activeView === 'expense'
                    ? (expensesData?.total ?? 0)
                    : (emailData?.total ?? 0)}{' '}
                  total
                </Badge>
                <Badge variant="secondary">
                  Page{' '}
                  {activeView === 'expense'
                    ? expensePageIndex + 1
                    : emailPageIndex + 1}{' '}
                  of{' '}
                  {activeView === 'expense'
                    ? expenseTable.getPageCount() || 1
                    : emailTable.getPageCount() || 1}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* ── Filter bar (expense tab only) ── */}
              {activeView === 'expense' && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <SearchFilter
                    value={searchInput}
                    onChange={setSearchInput}
                    placeholder="Search merchant…"
                  />
                  <SelectFilter
                    label="Categories"
                    value={filterCategory}
                    options={CATEGORY_FILTER_OPTIONS}
                    onChange={setFilterCategory}
                  />
                  <SelectFilter
                    label="Modes"
                    value={filterMode}
                    options={MODE_FILTER_OPTIONS}
                    onChange={setFilterMode}
                  />
                  <SelectFilter
                    label="Review"
                    value={filterReview}
                    options={REVIEW_FILTER_OPTIONS}
                    onChange={setFilterReview}
                    className="w-35 h-9 text-xs"
                  />
                  <DateRangeFilter
                    dateFrom={filterDateFrom}
                    dateTo={filterDateTo}
                    onChange={({ from, to }) => {
                      setFilterDateFrom(from)
                      setFilterDateTo(to)
                    }}
                  />
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 text-xs text-muted-foreground"
                      onClick={() => {
                        setFilterCategory('')
                        setFilterMode('')
                        setFilterReview('')
                        setFilterDateFrom(undefined)
                        setFilterDateTo(undefined)
                        setSearchInput('')
                      }}
                    >
                      Clear all
                    </Button>
                  )}
                </div>
              )}

              <Separator className="mb-4" />

              <TabsContent value="expense" className="mt-0">
                {isExpensesLoading ? (
                  <div className="space-y-3 pt-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : null}
                {isExpensesError ? (
                  <p className="text-sm text-destructive">
                    We couldn’t load expenses. Please try again in a moment.
                  </p>
                ) : null}
                {!isExpensesLoading &&
                !isExpensesError &&
                expenseTable.getRowModel().rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No expenses found yet.
                  </p>
                ) : null}
                {!isExpensesLoading &&
                !isExpensesError &&
                expenseTable.getRowModel().rows.length > 0 ? (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        {expenseTable.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                              <TableHead key={header.id}>
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(
                                      header.column.columnDef.header,
                                      header.getContext(),
                                    )}
                              </TableHead>
                            ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {expenseTable.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            data-state={row.getIsSelected() && 'selected'}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {expenseTable.getPageCount() > 1 && (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Showing {expensePageIndex * pageSize + 1} to{' '}
                          {Math.min(
                            (expensePageIndex + 1) * pageSize,
                            expensesData?.total ?? 0,
                          )}{' '}
                          of {expensesData?.total ?? 0} expenses
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => expenseTable.previousPage()}
                            disabled={!expenseTable.getCanPreviousPage()}
                          >
                            <ArrowLeft />
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => expenseTable.nextPage()}
                            disabled={!expenseTable.getCanNextPage()}
                          >
                            Next
                            <ArrowRight />
                          </Button>
                        </div>
                      </div>
                    )}
                    <BulkActionsToolbar
                      selectedIds={Object.keys(rowSelection)}
                      onClearSelection={() => setRowSelection({})}
                    />
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="emails" className="mt-0">
                {isEmailsLoading ? (
                  <div className="space-y-3 pt-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : null}
                {isEmailsError ? (
                  <p className="text-sm text-destructive">
                    We couldn’t load emails. Please try again in a moment.
                  </p>
                ) : null}
                {!isEmailsLoading &&
                !isEmailsError &&
                emailTable.getRowModel().rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No expense emails found yet.
                  </p>
                ) : null}
                {!isEmailsLoading &&
                !isEmailsError &&
                emailTable.getRowModel().rows.length > 0 ? (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        {emailTable.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                              <TableHead key={header.id}>
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(
                                      header.column.columnDef.header,
                                      header.getContext(),
                                    )}
                              </TableHead>
                            ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {emailTable.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            className="cursor-pointer hover:bg-muted/40"
                            role="link"
                            tabIndex={0}
                            onClick={() => {
                              const email = row.original
                              navigate(
                                appPaths.auth.expensesEmailDetails.getHref(
                                  email.id,
                                ),
                              )
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter' && event.key !== ' ') {
                                return
                              }
                              event.preventDefault()
                              const email = row.original
                              navigate(
                                appPaths.auth.expensesEmailDetails.getHref(
                                  email.id,
                                ),
                              )
                            }}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {emailTable.getPageCount() > 1 && (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Showing {emailPageIndex * pageSize + 1} to{' '}
                          {Math.min(
                            (emailPageIndex + 1) * pageSize,
                            emailData?.total ?? 0,
                          )}{' '}
                          of {emailData?.total ?? 0} emails
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => emailTable.previousPage()}
                            disabled={!emailTable.getCanPreviousPage()}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => emailTable.nextPage()}
                            disabled={!emailTable.getCanNextPage()}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>

      {/* ── Edit Transaction Sheet ── */}
      <Sheet
        open={!!editingTransaction}
        onOpenChange={(open) => !open && closeEditSheet()}
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit Transaction</SheetTitle>
            <SheetDescription>
              Correct transaction details. Changes are saved as manual
              categorisation.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-5 px-4 py-6">
            {/* Merchant */}
            <div className="grid gap-2">
              <Label htmlFor="edit-merchant">Merchant</Label>
              <Input
                id="edit-merchant"
                value={editForm.merchant ?? ''}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, merchant: e.target.value }))
                }
              />
            </div>

            {/* Amount + Currency */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-amount">Amount</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editForm.amount ?? ''}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      amount: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-currency">Currency</Label>
                <Input
                  id="edit-currency"
                  value={editForm.currency ?? ''}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      currency: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
            </div>

            {/* Transaction Type */}
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={editForm.transactionType ?? ''}
                onValueChange={(value) =>
                  setEditForm((f) => ({
                    ...f,
                    transactionType: value as 'debited' | 'credited',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transaction Mode */}
            <div className="grid gap-2">
              <Label>Mode</Label>
              <Select
                value={editForm.transactionMode ?? ''}
                onValueChange={(value) =>
                  setEditForm((f) => ({
                    ...f,
                    transactionMode: value as
                      | 'upi'
                      | 'credit_card'
                      | 'neft'
                      | 'imps'
                      | 'rtgs',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_MODES.map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">
                      {m.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={editForm.category ?? ''}
                onValueChange={(value) =>
                  setEditForm((f) => ({ ...f, category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
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
              <Label htmlFor="edit-subcategory">Subcategory</Label>
              <Input
                id="edit-subcategory"
                value={editForm.subcategory ?? ''}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, subcategory: e.target.value }))
                }
                placeholder="Optional"
              />
            </div>

            {/* Requires Review */}
            <div className="flex items-center gap-3">
              <input
                id="edit-requires-review"
                type="checkbox"
                className="size-4 rounded border-border"
                checked={editForm.requiresReview ?? false}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    requiresReview: e.target.checked,
                  }))
                }
              />
              <Label htmlFor="edit-requires-review">Requires review</Label>
            </div>
          </div>

          <SheetFooter className="px-4">
            <Button variant="outline" onClick={closeEditSheet}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </MainLayout>
  )
}

export default ExpenseEmailsPage

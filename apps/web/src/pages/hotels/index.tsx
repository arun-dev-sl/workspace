import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Archive,
  ArchiveRestore,
  Bot,
  MapPinned,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'

import { MainLayout } from '@/components/layouts'
import { useAiPageContext } from '@/features/ai-assistant/ai-assistant-context'
import { buildHotelsPageContext } from '@/features/ai-assistant/adapters/hotels-context'
import {
  useArchiveHotelStay,
  useCreateHotelStay,
  useDeleteHotelStay,
  useHotelEmail,
  useHotelLlmReviewCandidates,
  useHotelStays,
  useUnarchiveHotelStay,
  useUpdateHotelStay,
} from '@/features/hotels/api/hotels'
import { HotelLlmReviewSheet } from '@/features/hotels/components/hotel-llm-review-sheet'
import { HotelStayEditorSheet } from '@/features/hotels/components/hotel-stay-editor-sheet'
import { useHotelSyncJob } from '@/features/hotels/hooks/use-hotel-sync-job'
import { Badge } from '@workspace/ui/components/ui/badge'
import { Button } from '@workspace/ui/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/ui/dialog'
import { Input } from '@workspace/ui/components/ui/input'
import { Label } from '@workspace/ui/components/ui/label'
import { Progress } from '@workspace/ui/components/ui/progress'
import { Separator } from '@workspace/ui/components/ui/separator'
import { Skeleton } from '@workspace/ui/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/ui/table'
import type {
  CreateHotelStayInput,
  HotelStay,
  UpdateHotelStayInput,
} from '@workspace/domain'

const PAGE_SIZE = 25
const REVIEW_CANDIDATE_LIMIT = 50

interface PendingStayAction {
  type: 'archive' | 'restore' | 'delete'
  stay: HotelStay
}

function formatStayDate(value: string) {
  try {
    return format(parseISO(value), 'MMM d, yyyy')
  } catch {
    return value
  }
}

function formatStayRange(stay: HotelStay) {
  if (!stay.checkInDate && !stay.checkOutDate) {
    return 'Dates not captured'
  }

  if (!stay.checkInDate) {
    return `Check-out ${formatStayDate(stay.checkOutDate!)}`
  }

  if (!stay.checkOutDate) {
    return `Check-in ${formatStayDate(stay.checkInDate)}`
  }

  return `${formatStayDate(stay.checkInDate)} → ${formatStayDate(stay.checkOutDate)}`
}

function formatExtractionLabel(stay: HotelStay) {
  if (stay.extractionMethod.includes('manual')) {
    return 'Manual'
  }

  return stay.extractionMethod.includes('llm') ? 'LLM' : 'Unknown'
}

export default function HotelsPage() {
  return (
    <MainLayout>
      <HotelsPageContent />
    </MainLayout>
  )
}

export function HotelsPageContent() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [selectedStay, setSelectedStay] = useState<HotelStay | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [pendingStayAction, setPendingStayAction] =
    useState<PendingStayAction | null>(null)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false)
  const [reviewStartDate, setReviewStartDate] = useState('')
  const [reviewEndDate, setReviewEndDate] = useState('')
  const [selectedReviewEmailIds, setSelectedReviewEmailIds] = useState<
    string[]
  >([])

  const staysQuery = useHotelStays({
    page,
    page_size: PAGE_SIZE,
    includeArchived: showArchived,
  })
  const createMutation = useCreateHotelStay()
  const updateMutation = useUpdateHotelStay()
  const archiveMutation = useArchiveHotelStay()
  const unarchiveMutation = useUnarchiveHotelStay()
  const deleteMutation = useDeleteHotelStay()

  const {
    startLlmReviewProcess,
    job,
    isSyncing,
    isStarting,
    progress,
    error: syncError,
  } = useHotelSyncJob({
    onQueued: () => {
      setSelectedReviewEmailIds([])
      setReviewSheetOpen(false)
    },
  })

  const emailQuery = useHotelEmail(
    selectedStay?.sourceEmailId ?? undefined,
    editorOpen && Boolean(selectedStay?.sourceEmailId),
  )

  const reviewCandidatesQuery = useHotelLlmReviewCandidates({
    startDate: reviewSheetOpen ? reviewStartDate : undefined,
    endDate: reviewSheetOpen ? reviewEndDate : undefined,
    limit: REVIEW_CANDIDATE_LIMIT,
    enabled:
      reviewSheetOpen && Boolean(reviewStartDate) && Boolean(reviewEndDate),
  })

  useEffect(() => {
    setPage(1)
  }, [showArchived])

  const filteredStays = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const stays = staysQuery.data?.data ?? []

    if (!needle) {
      return stays
    }

    return stays.filter((stay) =>
      [
        stay.hotelName,
        stay.city,
        stay.country,
        stay.timezone,
        stay.checkInDate,
        stay.checkOutDate,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle)),
    )
  }, [search, staysQuery.data?.data])

  const stats = useMemo(() => {
    const stays = staysQuery.data?.data ?? []
    const upcomingStay = [...stays]
      .filter(
        (stay) =>
          stay.checkInDate !== null &&
          stay.checkInDate >= format(new Date(), 'yyyy-MM-dd'),
      )
      .sort((left, right) =>
        left.checkInDate!.localeCompare(right.checkInDate!),
      )[0]

    return {
      totalStored: staysQuery.data?.total ?? 0,
      manual: stays.filter((stay) => stay.extractionMethod.includes('manual'))
        .length,
      geocoded: stays.filter((stay) => stay.lat !== null && stay.lng !== null)
        .length,
      upcomingStay,
    }
  }, [staysQuery.data])

  const totalPages = staysQuery.data
    ? Math.max(1, Math.ceil(staysQuery.data.total / PAGE_SIZE))
    : 1

  const reviewCandidates = reviewCandidatesQuery.data?.data ?? []

  const aiPageContext = useMemo(
    () =>
      buildHotelsPageContext({
        showArchived,
        totalStored: stats.totalStored,
        manual: stats.manual,
        geocoded: stats.geocoded,
        filteredCount: filteredStays.length,
        upcomingStay: stats.upcomingStay,
      }),
    [
      filteredStays.length,
      showArchived,
      stats.geocoded,
      stats.manual,
      stats.totalStored,
      stats.upcomingStay,
    ],
  )

  useAiPageContext(aiPageContext)

  const handleOpenCreate = () => {
    setSelectedStay(null)
    setEditorOpen(true)
  }

  const handleOpenEdit = (stay: HotelStay) => {
    setSelectedStay(stay)
    setEditorOpen(true)
  }

  const handleSaveStay = async (
    data: CreateHotelStayInput | UpdateHotelStayInput,
  ) => {
    await (selectedStay
      ? updateMutation.mutateAsync({
          id: selectedStay.id,
          data: data as UpdateHotelStayInput,
        })
      : createMutation.mutateAsync(data as CreateHotelStayInput))

    setEditorOpen(false)
    setSelectedStay(null)
  }

  const handleToggleReviewEmail = (emailId: string, checked: boolean) => {
    setSelectedReviewEmailIds((current) => {
      if (checked) {
        return current.includes(emailId) ? current : [...current, emailId]
      }

      return current.filter((candidateId) => candidateId !== emailId)
    })
  }

  const handleSubmitReviewEmails = () => {
    if (selectedReviewEmailIds.length === 0) {
      return
    }

    startLlmReviewProcess({
      emailIds: selectedReviewEmailIds,
    })
  }

  const handleConfirmStayAction = async () => {
    if (!pendingStayAction) {
      return
    }

    if (pendingStayAction.type === 'archive') {
      await archiveMutation.mutateAsync(pendingStayAction.stay.id)
    } else if (pendingStayAction.type === 'restore') {
      await unarchiveMutation.mutateAsync(pendingStayAction.stay.id)
    } else {
      await deleteMutation.mutateAsync(pendingStayAction.stay.id)
    }

    setPendingStayAction(null)
  }

  const stayActionIsPending =
    archiveMutation.isPending ||
    unarchiveMutation.isPending ||
    deleteMutation.isPending

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Hotels
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground">
                Hotel Stays
              </h1>
              <Badge variant="outline" className="gap-1">
                <MapPinned className="h-3.5 w-3.5" />
                Manual coordinates enabled
              </Badge>
            </div>
            <p className="max-w-xl text-sm text-muted-foreground">
              Capture stays manually, correct extracted hotel details, and
              review likely reservation emails before sending only selected
              messages to the LLM.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={showArchived ? 'default' : 'outline'}
              onClick={() => setShowArchived((current) => !current)}
            >
              {showArchived ? 'Hide Archived' : 'Show Archived'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(true)}
              disabled={isSyncing}
            >
              <Bot className="mr-2 h-4 w-4" />
              Review Hotel Emails
            </Button>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Stay
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-4">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stored Stays
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {stats.totalStored}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Total hotel stays saved
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Manual Overrides
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {stats.manual}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Stays protected from later extraction
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Mapped Coordinates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {stats.geocoded}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Stays with editable latitude and longitude
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Next Stay
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.upcomingStay ? (
              <>
                <div className="text-lg font-semibold text-foreground">
                  {stats.upcomingStay.hotelName}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatStayRange(stats.upcomingStay)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No upcoming stays in the current page.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {job ? (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span>Hotel Extraction Progress</span>
              <Badge variant="outline" className="capitalize">
                {job.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progress} />
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>{job.processedEmails} processed</span>
              <Separator orientation="vertical" className="h-4" />
              <span>{job.totalEmails ?? 0} total emails</span>
              <Separator orientation="vertical" className="h-4" />
              <span>{job.matchedStays} matched stays</span>
              <Separator orientation="vertical" className="h-4" />
              <span>{progress}% complete</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {syncError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {syncError.message}
        </div>
      ) : null}

      <Card className="border-border/60">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base">Captured Hotel Stays</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Search saved stays, add missing reservations manually, and
                review source emails when you need to correct extracted details.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-60">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search hotel, city, country"
                  className="pl-9"
                />
              </div>
              {showArchived ? (
                <Badge variant="outline" className="self-start sm:self-center">
                  Including archived stays
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {staysQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : null}

          {staysQuery.isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
              We couldn’t load hotel stays right now.
            </div>
          ) : null}

          {!staysQuery.isLoading &&
          !staysQuery.isError &&
          filteredStays.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center">
              <p className="text-base font-medium text-foreground">
                No hotel stays found
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {search
                  ? 'Try clearing your search.'
                  : 'Add a stay manually or review hotel emails to extract reservations.'}
              </p>
            </div>
          ) : null}

          {!staysQuery.isLoading &&
          !staysQuery.isError &&
          filteredStays.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hotel</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Nights</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStays.map((stay) => (
                    <TableRow key={stay.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {stay.hotelName}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {stay.pricing.total !== null &&
                            stay.pricing.currency
                              ? `${stay.pricing.currency} ${stay.pricing.total}`
                              : 'Pricing not captured'}
                          </span>
                          {stay.archivedAt ? (
                            <Badge variant="secondary">Archived</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {stay.city ?? 'Unknown city'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {stay.country ?? 'Unknown country'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {formatStayRange(stay)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {stay.timezone ?? 'Timezone not set'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-foreground">
                          {stay.nights ?? 'Unknown'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {formatExtractionLabel(stay)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(stay)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Review
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setPendingStayAction({
                                type: stay.archivedAt ? 'restore' : 'archive',
                                stay,
                              })
                            }
                          >
                            {stay.archivedAt ? (
                              <ArchiveRestore className="mr-2 h-4 w-4" />
                            ) : (
                              <Archive className="mr-2 h-4 w-4" />
                            )}
                            {stay.archivedAt ? 'Restore' : 'Archive'}
                          </Button>
                          {stay.archivedAt ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                setPendingStayAction({
                                  type: 'delete',
                                  stay,
                                })
                              }
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {filteredStays.length} of{' '}
              {staysQuery.data?.data.length ?? 0} loaded stays
              <span className="mx-2">•</span>
              {staysQuery.data?.total ?? 0} total stored
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Badge variant="outline">
                Page {page} / {totalPages}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <HotelStayEditorSheet
        stay={selectedStay}
        email={emailQuery.data}
        open={editorOpen}
        isPending={
          createMutation.isPending ||
          updateMutation.isPending ||
          emailQuery.isLoading ||
          stayActionIsPending
        }
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) {
            setSelectedStay(null)
          }
        }}
        onSubmit={handleSaveStay}
      />

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review hotel emails</DialogTitle>
            <DialogDescription>
              Choose a received-date window first. The sheet will then show
              likely hotel reservation emails in that range so you can queue
              only the ones you want.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hotel-review-start-date">Start date</Label>
              <Input
                id="hotel-review-start-date"
                type="date"
                value={reviewStartDate}
                onChange={(event) => setReviewStartDate(event.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hotel-review-end-date">End date</Label>
              <Input
                id="hotel-review-end-date"
                type="date"
                value={reviewEndDate}
                onChange={(event) => setReviewEndDate(event.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setSelectedReviewEmailIds([])
                setReviewDialogOpen(false)
                setReviewSheetOpen(true)
              }}
              disabled={
                !reviewStartDate ||
                !reviewEndDate ||
                reviewEndDate < reviewStartDate
              }
            >
              Show candidates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HotelLlmReviewSheet
        open={reviewSheetOpen}
        onOpenChange={(open) => {
          setReviewSheetOpen(open)
          if (!open) {
            setSelectedReviewEmailIds([])
          }
        }}
        startDate={reviewStartDate || null}
        endDate={reviewEndDate || null}
        candidates={reviewCandidates}
        isLoading={reviewCandidatesQuery.isLoading}
        isSubmitting={isStarting}
        selectedIds={selectedReviewEmailIds}
        errorMessage={
          reviewCandidatesQuery.error instanceof Error
            ? reviewCandidatesQuery.error.message
            : null
        }
        onToggleEmail={handleToggleReviewEmail}
        onSelectAll={() =>
          setSelectedReviewEmailIds(
            reviewCandidates.map((candidate) => candidate.email.id),
          )
        }
        onClearAll={() => setSelectedReviewEmailIds([])}
        onSubmit={handleSubmitReviewEmails}
      />

      <Dialog
        open={pendingStayAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingStayAction(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingStayAction?.type === 'archive'
                ? 'Archive hotel stay'
                : pendingStayAction?.type === 'restore'
                  ? 'Restore hotel stay'
                  : 'Delete hotel stay'}
            </DialogTitle>
            <DialogDescription>
              {pendingStayAction?.type === 'archive'
                ? 'The stay will be hidden from the default list but can still be restored later.'
                : pendingStayAction?.type === 'restore'
                  ? 'The stay will be returned to the active hotel list.'
                  : 'This permanently deletes the stay. Archive is reversible, deletion is not.'}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingStayAction(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={
                pendingStayAction?.type === 'delete' ? 'destructive' : 'default'
              }
              onClick={() => void handleConfirmStayAction()}
              disabled={stayActionIsPending}
            >
              {pendingStayAction?.type === 'archive'
                ? 'Archive stay'
                : pendingStayAction?.type === 'restore'
                  ? 'Restore stay'
                  : 'Delete stay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

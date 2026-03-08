import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isAfter, parseISO, startOfDay } from "date-fns";
import {
  ArrowRight,
  Bot,
  MailSearch,
  MoreVertical,
  Pencil,
  Plane,
  RefreshCcw,
  RotateCw,
  Search,
  Sparkles,
  Unplug,
} from "lucide-react";

import { MainLayout } from "@/components/layouts";
import { FlightActivityEditorSheet } from "@/features/flights/components/flight-activity-editor-sheet";
import { FlightLlmReviewSheet } from "@/features/flights/components/flight-llm-review-sheet";
import {
  formatFlightExtractionMethodHistory,
  getLatestFlightExtractionMethod,
  hasFlightExtractionMethod,
} from "@/features/flights/lib/extraction-methods";
import {
  flightKeys,
  useFlightActivities,
  useFlightEmail,
  useFlightLlmReviewCandidates,
  useUpdateFlightActivity,
} from "@/features/flights/api/flights";
import { useFlightSyncJob } from "@/features/flights/hooks/use-flight-sync-job";
import { connectGmail } from "@/features/expenses/api/connect-gmail";
import { disconnectGmail } from "@/features/expenses/api/disconnect-gmail";
import { fetchGmailStatus } from "@/features/expenses/api/gmail-status";
import { Badge } from "@workspace/ui/components/ui/badge";
import { Button } from "@workspace/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu";
import { Input } from "@workspace/ui/components/ui/input";
import { Progress } from "@workspace/ui/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/ui/select";
import { Separator } from "@workspace/ui/components/ui/separator";
import { Skeleton } from "@workspace/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/ui/table";
import type {
  FlightActivity,
  UpdateFlightActivityInput,
} from "@workspace/domain";

const PAGE_SIZE = 25;
const REVIEW_CANDIDATE_LIMIT = 50;
const EXTRACTION_METHOD_OPTIONS = [
  { label: "All methods", value: "all" },
  { label: "Manual", value: "manual" },
  { label: "JSON-LD", value: "json_ld" },
  { label: "Heuristic", value: "heuristic" },
  { label: "LLM", value: "llm" },
] as const;

function formatFlightDate(value: string) {
  try {
    return format(parseISO(value), "EEE, MMM d yyyy");
  } catch {
    return value;
  }
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  try {
    return format(parseISO(value), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return value;
  }
}

function formatRoute(activity: FlightActivity) {
  return `${activity.fromAirport} -> ${activity.toAirport}`;
}

function getExtractionBadgeVariant(
  methods: FlightActivity["extractionMethod"],
) {
  const method = getLatestFlightExtractionMethod(methods);

  switch (method) {
    case "manual": {
      return "default";
    }
    case "json_ld": {
      return "secondary";
    }
    case "heuristic": {
      return "info";
    }
    case "llm": {
      return "outline";
    }
    default: {
      return "info";
    }
  }
}

function getExtractionLabel(methods: FlightActivity["extractionMethod"]) {
  return formatFlightExtractionMethodHistory(methods);
}

function isUpcoming(activity: FlightActivity) {
  try {
    return isAfter(parseISO(activity.departureDate), startOfDay(new Date()));
  } catch {
    return false;
  }
}

type SyncStartMode = "standard" | "review";
type SyncIntent =
  | "idle"
  | "standard"
  | "review-sync"
  | "review-process"
  | "reprocess";

export default function FlightsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] =
    useState<(typeof EXTRACTION_METHOD_OPTIONS)[number]["value"]>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] =
    useState<FlightActivity | null>(null);
  const [startDialogMode, setStartDialogMode] = useState<SyncStartMode | null>(
    null,
  );
  const [fromDate, setFromDate] = useState("");
  const [syncIntent, setSyncIntent] = useState<SyncIntent>("idle");
  const [reviewFromDate, setReviewFromDate] = useState<string | null>(null);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [selectedReviewEmailIds, setSelectedReviewEmailIds] = useState<
    string[]
  >([]);

  const deferredSearch = useDeferredValue(search);
  const activitiesQuery = useFlightActivities({
    page,
    page_size: PAGE_SIZE,
  });
  const updateMutation = useUpdateFlightActivity();
  const emailQuery = useFlightEmail(
    editorOpen ? selectedActivity?.sourceEmailId : undefined,
    editorOpen,
  );

  const statusQuery = useQuery({
    queryKey: flightKeys.gmailStatus(),
    queryFn: fetchGmailStatus,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const connectMutation = useMutation({
    mutationFn: connectGmail,
    onSuccess: (data) => {
      globalThis.location.assign(data.url);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectGmail,
    onSuccess: async () => {
      queryClient.setQueryData(flightKeys.gmailStatus(), {
        connected: false,
        email: null,
      });
      await queryClient.invalidateQueries({
        queryKey: flightKeys.gmailStatus(),
      });
    },
  });

  const handleSyncComplete = useEffectEvent(() => {
    if (syncIntent === "review-sync" && reviewFromDate) {
      setSelectedReviewEmailIds([]);
      setReviewSheetOpen(true);
      return;
    }

    if (syncIntent === "review-process") {
      setSelectedReviewEmailIds([]);
    }
  });

  const {
    startSync,
    startReviewSync,
    startLlmReviewProcess,
    startReprocess,
    job,
    isSyncing,
    isStarting,
    progress,
  } = useFlightSyncJob({
    onComplete: handleSyncComplete,
  });

  const reviewCandidatesQuery = useFlightLlmReviewCandidates({
    fromDate: reviewSheetOpen ? (reviewFromDate ?? undefined) : undefined,
    limit: REVIEW_CANDIDATE_LIMIT,
    enabled: reviewSheetOpen && Boolean(reviewFromDate),
  });

  const filteredActivities = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();

    return (activitiesQuery.data?.data ?? []).filter((activity) => {
      const matchesMethod =
        methodFilter === "all" ||
        hasFlightExtractionMethod(activity.extractionMethod, methodFilter);

      if (!matchesMethod) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        activity.flightNumber,
        activity.airlineName,
        activity.pnr,
        activity.fromAirport,
        activity.toAirport,
        activity.departureDate,
        activity.travelClass,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });
  }, [activitiesQuery.data?.data, deferredSearch, methodFilter]);

  const stats = useMemo(() => {
    const loadedActivities = activitiesQuery.data?.data ?? [];
    const nextDeparture = [...loadedActivities]
      .filter((activity) => isUpcoming(activity))
      .sort((left, right) =>
        left.departureDate.localeCompare(right.departureDate),
      )[0];

    return {
      totalStored: activitiesQuery.data?.total ?? 0,
      loaded: loadedActivities.length,
      manual: loadedActivities.filter((activity) =>
        hasFlightExtractionMethod(activity.extractionMethod, "manual"),
      ).length,
      nextDeparture,
    };
  }, [activitiesQuery.data]);

  const totalPages = activitiesQuery.data
    ? Math.max(1, Math.ceil(activitiesQuery.data.total / PAGE_SIZE))
    : 1;

  const reviewCandidates = reviewCandidatesQuery.data?.data ?? [];

  const handleEditorOpenChange = (open: boolean) => {
    setEditorOpen(open);
    if (!open) {
      setSelectedActivity(null);
    }
  };

  const handleOpenEditor = (activity: FlightActivity) => {
    setSelectedActivity(activity);
    setEditorOpen(true);
  };

  const handleSaveCorrection = async (data: UpdateFlightActivityInput) => {
    if (!selectedActivity) {
      return;
    }

    await updateMutation.mutateAsync({
      id: selectedActivity.id,
      data,
    });
    handleEditorOpenChange(false);
  };

  useEffect(() => {
    if (!reviewSheetOpen) {
      setSelectedReviewEmailIds([]);
    }
  }, [reviewSheetOpen]);

  const openStartDialog = (mode: SyncStartMode) => {
    setStartDialogMode(mode);
  };

  const closeStartDialog = () => {
    setStartDialogMode(null);
  };

  const handleStartSync = () => {
    if (!fromDate || !statusQuery.data?.connected) {
      return;
    }

    if (startDialogMode === "review") {
      setSyncIntent("review-sync");
      setReviewFromDate(fromDate);
      setReviewSheetOpen(false);
      setSelectedReviewEmailIds([]);
      startReviewSync({ fromDate });
    } else {
      setSyncIntent("standard");
      startSync({ fromDate });
    }

    closeStartDialog();
  };

  const handleStartReprocess = () => {
    setSyncIntent("reprocess");
    startReprocess(false);
  };

  const handleToggleReviewEmail = (emailId: string, checked: boolean) => {
    setSelectedReviewEmailIds((current) => {
      if (checked) {
        return current.includes(emailId) ? current : [...current, emailId];
      }

      return current.filter((candidateId) => candidateId !== emailId);
    });
  };

  const handleSelectAllReviewEmails = () => {
    setSelectedReviewEmailIds(
      reviewCandidates.map((candidate) => candidate.email.id),
    );
  };

  const handleSubmitReviewEmails = () => {
    if (selectedReviewEmailIds.length === 0) {
      return;
    }

    setSyncIntent("review-process");
    setReviewSheetOpen(false);
    startLlmReviewProcess({ emailIds: selectedReviewEmailIds });
  };

  return (
    <MainLayout>
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                Flights
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold text-foreground">
                  Flight Activity
                </h1>
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Manual correction enabled
                </Badge>
              </div>
              <p className="max-w-xl text-sm text-muted-foreground">
                Review extracted itineraries, trigger syncs, and correct flight
                records when automated extraction needs help.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="default"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
              >
                <MailSearch className="mr-1 h-4 w-4" />
                {statusQuery.data?.connected
                  ? "Reconnect Gmail"
                  : "Connect Gmail"}
              </Button>
              <Button
                variant="outline"
                onClick={() => disconnectMutation.mutate()}
                disabled={
                  disconnectMutation.isPending || !statusQuery.data?.connected
                }
              >
                <Unplug className="mr-1 h-4 w-4" />
                Disconnect
              </Button>
              <Button
                variant="outline"
                onClick={handleStartReprocess}
                disabled={isSyncing}
              >
                <RotateCw className="mr-2 h-4 w-4" />
                Reprocess
              </Button>
              <Button
                onClick={() => openStartDialog("standard")}
                disabled={isSyncing || !statusQuery.data?.connected}
              >
                <RefreshCcw className="mr-1 h-4 w-4" />
                Sync Flights
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={isSyncing || !statusQuery.data?.connected}
                    aria-label="Open sync options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => openStartDialog("review")}>
                    <Bot className="h-4 w-4" />
                    Review LLM candidates
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <Card className="border-border/60 bg-card/90">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Mailbox
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Plane className="h-5 w-5" />
                {statusQuery.data?.connected ? "Connected" : "Not connected"}
              </div>
              <p className="text-sm text-muted-foreground">
                {statusQuery.data?.email ??
                  "Connect Gmail to sync booking emails."}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Stored Segments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-foreground">
                {stats.totalStored}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {stats.loaded} loaded on this page
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
                Loaded records marked as corrected
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Next Departure
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.nextDeparture ? (
                <>
                  <div className="text-lg font-semibold text-foreground">
                    {formatRoute(stats.nextDeparture)}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {stats.nextDeparture.flightNumber} on{" "}
                    {formatFlightDate(stats.nextDeparture.departureDate)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No upcoming departures in the loaded set.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {job ? (
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span>Flight Sync Progress</span>
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
                <span>{job.activities} matched activities</span>
                <Separator orientation="vertical" className="h-4" />
                <span>{progress}% complete</span>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-border/60">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base">Captured Flights</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Search and correct extracted itineraries. Click a row action
                  to edit with source-email context.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-60">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search route, PNR, airline, flight"
                    className="pl-9"
                  />
                </div>
                <Select
                  value={methodFilter}
                  onValueChange={(value) =>
                    setMethodFilter(
                      value as (typeof EXTRACTION_METHOD_OPTIONS)[number]["value"],
                    )
                  }
                >
                  <SelectTrigger className="w-45">
                    <SelectValue placeholder="Method" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXTRACTION_METHOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {activitiesQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : null}

            {activitiesQuery.isError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
                We couldn’t load flights right now. Try again after the current
                sync completes.
              </div>
            ) : null}

            {!activitiesQuery.isLoading &&
            !activitiesQuery.isError &&
            filteredActivities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center">
                <p className="text-base font-medium text-foreground">
                  No flight activities found
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {search || methodFilter !== "all"
                    ? "Try clearing your search or method filter."
                    : "Run a sync after connecting Gmail to pull in flight confirmations."}
                </p>
              </div>
            ) : null}

            {!activitiesQuery.isLoading &&
            !activitiesQuery.isError &&
            filteredActivities.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Route</TableHead>
                      <TableHead>Flight</TableHead>
                      <TableHead>Departure</TableHead>
                      <TableHead>Arrival</TableHead>
                      <TableHead>PNR</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActivities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {formatRoute(activity)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {activity.airlineName ?? "Unknown airline"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {activity.flightNumber}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {activity.travelClass ?? "Class not set"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {formatFlightDate(activity.departureDate)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {activity.departureTime ?? "Time TBD"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {activity.arrivalDate
                              ? formatFlightDate(activity.arrivalDate)
                              : "Not captured"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {activity.arrivalTime ?? "Time TBD"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs">
                            {activity.pnr ?? "Missing"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant={getExtractionBadgeVariant(
                                activity.extractionMethod,
                              )}
                              className="max-w-fit"
                            >
                              {getExtractionLabel(activity.extractionMethod)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditor(activity)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {filteredActivities.length} of{" "}
                {activitiesQuery.data?.data.length ?? 0} loaded segments
                <span className="mx-2">•</span>
                {activitiesQuery.data?.total ?? 0} total stored
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
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <FlightActivityEditorSheet
          activity={selectedActivity}
          email={emailQuery.data}
          open={editorOpen}
          isPending={updateMutation.isPending || emailQuery.isLoading}
          onOpenChange={handleEditorOpenChange}
          onSubmit={handleSaveCorrection}
        />

        <Dialog
          open={startDialogMode !== null}
          onOpenChange={(open) => {
            if (!open) {
              closeStartDialog();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {startDialogMode === "review"
                  ? "Sync flights with manual LLM review"
                  : "Sync flights"}
              </DialogTitle>
              <DialogDescription>
                {startDialogMode === "review"
                  ? "Fetch flights from Gmail, run JSON-LD plus heuristic extraction first, then review the remaining unmatched emails before any LLM call is made."
                  : "Pick the earliest date to search from before starting the normal flight sync."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label
                htmlFor="flight-sync-from-date"
                className="text-sm font-medium text-foreground"
              >
                From date
              </label>
              <Input
                id="flight-sync-from-date"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                max={format(new Date(), "yyyy-MM-dd")}
              />
              <p className="text-sm text-muted-foreground">
                Gmail search starts from this date. A narrower range keeps the
                candidate review list focused and lowers LLM spend.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeStartDialog}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleStartSync}
                disabled={
                  !fromDate || isStarting || !statusQuery.data?.connected
                }
              >
                {startDialogMode === "review"
                  ? "Fetch and review"
                  : "Start sync"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <FlightLlmReviewSheet
          open={reviewSheetOpen}
          onOpenChange={setReviewSheetOpen}
          fromDate={reviewFromDate}
          candidates={reviewCandidates}
          isLoading={reviewCandidatesQuery.isLoading}
          isSubmitting={isStarting || isSyncing}
          selectedIds={selectedReviewEmailIds}
          errorMessage={
            reviewCandidatesQuery.error instanceof Error
              ? reviewCandidatesQuery.error.message
              : null
          }
          onToggleEmail={handleToggleReviewEmail}
          onSelectAll={handleSelectAllReviewEmails}
          onClearAll={() => setSelectedReviewEmailIds([])}
          onSubmit={handleSubmitReviewEmails}
        />

        {selectedActivity ? (
          <Card className="border-dashed border-border/60 bg-muted/15">
            <CardContent className="flex flex-col gap-2 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div>
                Working against source email{" "}
                <span className="font-mono">
                  {selectedActivity.sourceEmailId.slice(0, 8)}
                </span>
                . Updated rows are marked as manual and protected from later
                auto-reprocessing.
              </div>
              <div>{formatTimestamp(selectedActivity.updatedAt)}</div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </MainLayout>
  );
}

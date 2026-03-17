import { format, parseISO } from 'date-fns'
import { Bot, Hotel, MailSearch } from 'lucide-react'

import { Badge } from '@workspace/ui/components/ui/badge'
import { Button } from '@workspace/ui/components/ui/button'
import { Checkbox } from '@workspace/ui/components/ui/checkbox'
import { ScrollArea } from '@workspace/ui/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@workspace/ui/components/ui/sheet'
import { Skeleton } from '@workspace/ui/components/ui/skeleton'
import type { HotelLlmReviewCandidate } from '@workspace/domain'

function formatReceivedAt(value: string) {
  try {
    return format(parseISO(value), 'MMM d, yyyy h:mm a')
  } catch {
    return value
  }
}

function getCandidateStatusLabel(candidate: HotelLlmReviewCandidate) {
  switch (candidate.status) {
    case 'failed': {
      return 'Previous extraction failed'
    }
    case 'no_match': {
      return 'No hotel stay found'
    }
    case 'unprocessed': {
      return 'Awaiting review'
    }
  }
}

function formatExtractionMethod(methods: string[]) {
  if (methods.length === 0) {
    return 'none yet'
  }

  return methods.join(' → ')
}

interface HotelLlmReviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  startDate: string | null
  endDate: string | null
  candidates: HotelLlmReviewCandidate[]
  isLoading: boolean
  isSubmitting: boolean
  selectedIds: string[]
  errorMessage?: string | null
  onToggleEmail: (emailId: string, checked: boolean) => void
  onSelectAll: () => void
  onClearAll: () => void
  onSubmit: () => void
}

export function HotelLlmReviewSheet({
  open,
  onOpenChange,
  startDate,
  endDate,
  candidates,
  isLoading,
  isSubmitting,
  selectedIds,
  errorMessage,
  onToggleEmail,
  onSelectAll,
  onClearAll,
  onSubmit,
}: HotelLlmReviewSheetProps) {
  const selectedSet = new Set(selectedIds)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-border/60 pb-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Review Hotel Emails For LLM Extraction
          </SheetTitle>
          <SheetDescription>
            {startDate && endDate
              ? `Only likely hotel emails received between ${startDate} and ${endDate} are shown here. Select the messages you want to send to the LLM.`
              : 'Choose which likely hotel emails should be sent to the LLM.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between border-b border-border/60 py-3 text-sm">
          <div className="text-muted-foreground">
            {selectedIds.length}
            {' '}
            selected of
            {candidates.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSelectAll}
              disabled={isLoading || candidates.length === 0}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              disabled={selectedIds.length === 0}
            >
              Clear
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-3 py-4">
            {isLoading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-border/60 p-4"
                  >
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="mt-3 h-16 w-full" />
                  </div>
                ))
              : null}

            {!isLoading && errorMessage
              ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
                    {errorMessage}
                  </div>
                )
              : null}

            {!isLoading && !errorMessage && candidates.length === 0
              ? (
                  <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center">
                    <p className="text-base font-medium text-foreground">
                      No hotel candidates right now
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Try widening the date range if you expect more reservation
                      emails.
                    </p>
                  </div>
                )
              : null}

            {!isLoading && !errorMessage
              ? candidates.map((candidate) => {
                  const checked = selectedSet.has(candidate.email.id)

                  return (
                    <label
                      key={candidate.email.id}
                      className="flex cursor-pointer gap-4 rounded-xl border border-border/60 p-4 transition-colors hover:border-border"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          onToggleEmail(candidate.email.id, value === true)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {candidate.email.subject}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {candidate.email.from}
                              <span className="mx-2">•</span>
                              {formatReceivedAt(candidate.email.receivedAt)}
                            </div>
                          </div>
                          <Badge variant="outline">
                            {getCandidateStatusLabel(candidate)}
                          </Badge>
                        </div>

                        <div className="rounded-lg bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">
                          {candidate.email.snippet
                            || candidate.email.bodyText.slice(0, 220)}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Hotel className="h-3.5 w-3.5" />
                            Extraction path:
                            {' '}
                            {formatExtractionMethod(candidate.extractionMethod)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MailSearch className="h-3.5 w-3.5" />
                            LLM attempts:
                            {' '}
                            {candidate.llmAttempts}
                          </span>
                          {candidate.lastError
                            ? (
                                <span>
                                  Last error:
                                  {candidate.lastError}
                                </span>
                              )
                            : null}
                        </div>
                      </div>
                    </label>
                  )
                })
              : null}
          </div>
        </ScrollArea>

        <SheetFooter className="border-t border-border/60 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={selectedIds.length === 0 || isSubmitting}
          >
            {isSubmitting ? 'Queueing...' : 'Send selected emails to the LLM'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

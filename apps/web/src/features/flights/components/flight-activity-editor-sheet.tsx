import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Mail, Plane, Save } from 'lucide-react'

import { Badge } from '@workspace/ui/components/ui/badge'
import { Button } from '@workspace/ui/components/ui/button'
import { Input } from '@workspace/ui/components/ui/input'
import { Label } from '@workspace/ui/components/ui/label'
import { ScrollArea } from '@workspace/ui/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@workspace/ui/components/ui/sheet'
import { Textarea } from '@workspace/ui/components/ui/textarea'
import type {
  FlightActivity,
  RawEmail,
  UpdateFlightActivityInput,
} from '@workspace/domain'

interface FlightActivityEditorSheetProps {
  activity: FlightActivity | null
  email?: RawEmail
  open: boolean
  isPending?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: UpdateFlightActivityInput) => Promise<void> | void
}

interface FormState {
  pnr: string
  airlineName: string
  flightNumber: string
  fromAirport: string
  toAirport: string
  departureDate: string
  departureTime: string
  arrivalDate: string
  arrivalTime: string
  departureTimezone: string
  arrivalTimezone: string
  travelClass: string
}

function toFormState(activity: FlightActivity): FormState {
  return {
    pnr: activity.pnr ?? '',
    airlineName: activity.airlineName ?? '',
    flightNumber: activity.flightNumber,
    fromAirport: activity.fromAirport,
    toAirport: activity.toAirport,
    departureDate: activity.departureDate,
    departureTime: activity.departureTime ?? '',
    arrivalDate: activity.arrivalDate ?? '',
    arrivalTime: activity.arrivalTime ?? '',
    departureTimezone: activity.departureTimezone ?? '',
    arrivalTimezone: activity.arrivalTimezone ?? '',
    travelClass: activity.travelClass ?? '',
  }
}

function formatReceivedAt(value?: string) {
  if (!value) {
    return 'Unknown'
  }

  try {
    return format(parseISO(value), 'MMM d, yyyy \'at\' h:mm a')
  } catch {
    return value
  }
}

export function FlightActivityEditorSheet({
  activity,
  email,
  open,
  isPending = false,
  onOpenChange,
  onSubmit,
}: FlightActivityEditorSheetProps) {
  const [form, setForm] = useState<FormState | null>(null)

  useEffect(() => {
    if (!activity) {
      setForm(null)
      return
    }

    setForm(toFormState(activity))
  }, [activity])

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => (current ? { ...current, [field]: value } : current))
  }

  const handleSubmit = async () => {
    if (!activity || !form) {
      return
    }

    try {
      await onSubmit({
        pnr: form.pnr.trim() || null,
        airlineName: form.airlineName.trim() || null,
        flightNumber: form.flightNumber.trim(),
        fromAirport: form.fromAirport.trim(),
        toAirport: form.toAirport.trim(),
        departureDate: form.departureDate.trim(),
        departureTime: form.departureTime.trim() || null,
        arrivalDate: form.arrivalDate.trim() || null,
        arrivalTime: form.arrivalTime.trim() || null,
        departureTimezone: form.departureTimezone.trim() || null,
        arrivalTimezone: form.arrivalTimezone.trim() || null,
        travelClass: form.travelClass.trim() || null,
      })
    } catch {
      // apiRequest already surfaces mutation failures via toast
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden sm:max-w-3xl">
        {!activity || !form
          ? null
          : (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Plane className="h-4 w-4" />
                    Correct Flight Activity
                  </SheetTitle>
                  <SheetDescription>
                    Save corrections or enrich missing fields. Manual changes take
                    precedence over future automatic extraction for this source
                    email.
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 grid h-[calc(100vh-13rem)] gap-6 overflow-hidden lg:grid-cols-[1.1fr_0.9fr]">
                  <ScrollArea className="pr-4">
                    <div className="space-y-6 pb-6">
                      <section className="space-y-4 rounded-xl border border-border/60 bg-card/80 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">
                              Itinerary
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              Required fields that define the segment.
                            </p>
                          </div>
                          <Badge variant="outline">{activity.id.slice(0, 8)}</Badge>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="flightNumber">Flight Number</Label>
                            <Input
                              id="flightNumber"
                              value={form.flightNumber}
                              onChange={(event) =>
                                updateField('flightNumber', event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="airlineName">Airline</Label>
                            <Input
                              id="airlineName"
                              value={form.airlineName}
                              onChange={(event) =>
                                updateField('airlineName', event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="fromAirport">From (IATA)</Label>
                            <Input
                              id="fromAirport"
                              maxLength={3}
                              value={form.fromAirport}
                              onChange={(event) =>
                                updateField('fromAirport', event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="toAirport">To (IATA)</Label>
                            <Input
                              id="toAirport"
                              maxLength={3}
                              value={form.toAirport}
                              onChange={(event) =>
                                updateField('toAirport', event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="departureDate">Departure Date</Label>
                            <Input
                              id="departureDate"
                              type="date"
                              value={form.departureDate}
                              onChange={(event) =>
                                updateField('departureDate', event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="departureTime">Departure Time</Label>
                            <Input
                              id="departureTime"
                              type="time"
                              value={form.departureTime}
                              onChange={(event) =>
                                updateField('departureTime', event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="arrivalDate">Arrival Date</Label>
                            <Input
                              id="arrivalDate"
                              type="date"
                              value={form.arrivalDate}
                              onChange={(event) =>
                                updateField('arrivalDate', event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="arrivalTime">Arrival Time</Label>
                            <Input
                              id="arrivalTime"
                              type="time"
                              value={form.arrivalTime}
                              onChange={(event) =>
                                updateField('arrivalTime', event.target.value)}
                            />
                          </div>
                        </div>
                      </section>

                      <section className="space-y-4 rounded-xl border border-border/60 bg-card/80 p-4">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            Enrichment
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Optional fields that improve itinerary quality.
                          </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="pnr">PNR</Label>
                            <Input
                              id="pnr"
                              value={form.pnr}
                              onChange={(event) =>
                                updateField('pnr', event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="travelClass">Travel Class</Label>
                            <Input
                              id="travelClass"
                              value={form.travelClass}
                              onChange={(event) =>
                                updateField('travelClass', event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="departureTimezone">
                              Departure Timezone
                            </Label>
                            <Input
                              id="departureTimezone"
                              placeholder="Asia/Kolkata or +05:30"
                              value={form.departureTimezone}
                              onChange={(event) =>
                                updateField(
                                  'departureTimezone',
                                  event.target.value,
                                )}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="arrivalTimezone">
                              Arrival Timezone
                            </Label>
                            <Input
                              id="arrivalTimezone"
                              placeholder="Asia/Kolkata or +05:30"
                              value={form.arrivalTimezone}
                              onChange={(event) =>
                                updateField('arrivalTimezone', event.target.value)}
                            />
                          </div>
                        </div>
                      </section>
                    </div>
                  </ScrollArea>

                  <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/25">
                    <div className="border-b border-border/60 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Mail className="h-4 w-4" />
                        Source Email
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Use the captured message to verify the corrected fields.
                      </p>
                    </div>

                    <ScrollArea className="h-[calc(100vh-17rem)]">
                      <div className="space-y-4 p-4 text-sm">
                        <div className="space-y-1">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Subject
                          </div>
                          <div className="font-medium">
                            {email?.subject ?? 'Loading subject…'}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            From
                          </div>
                          <div className="font-mono text-xs break-all">
                            {email?.from ?? 'Loading sender…'}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Received
                          </div>
                          <div>{formatReceivedAt(email?.receivedAt)}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Snippet
                          </div>
                          <div className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm">
                            {email?.snippet ?? 'No snippet available.'}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Body Preview
                          </div>
                          <Textarea
                            readOnly
                            className="min-h-72 resize-none bg-background font-mono text-xs leading-5"
                            value={email?.bodyText ?? 'Loading email body…'}
                          />
                        </div>
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                <SheetFooter className="mt-4 border-t border-border/60 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => void handleSubmit()} disabled={isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {isPending ? 'Saving…' : 'Save Correction'}
                  </Button>
                </SheetFooter>
              </>
            )}
      </SheetContent>
    </Sheet>
  )
}

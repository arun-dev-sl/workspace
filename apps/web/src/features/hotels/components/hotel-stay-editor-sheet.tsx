import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Hotel, Mail, Save } from "lucide-react";

import { Badge } from "@workspace/ui/components/ui/badge";
import { Button } from "@workspace/ui/components/ui/button";
import { Input } from "@workspace/ui/components/ui/input";
import { Label } from "@workspace/ui/components/ui/label";
import { ScrollArea } from "@workspace/ui/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/ui/sheet";
import { Textarea } from "@workspace/ui/components/ui/textarea";
import type {
  CreateHotelStayInput,
  HotelStay,
  RawEmail,
  UpdateHotelStayInput,
} from "@workspace/domain";

interface HotelStayEditorSheetProps {
  stay: HotelStay | null;
  email?: RawEmail;
  open: boolean;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    data: CreateHotelStayInput | UpdateHotelStayInput,
  ) => Promise<void> | void;
}

interface FormState {
  hotelName: string;
  city: string;
  country: string;
  timezone: string;
  checkInDate: string;
  checkOutDate: string;
  nights: string;
  lat: string;
  lng: string;
  pricingCurrency: string;
  pricingTotal: string;
  pricingNightly: string;
}

function toFormState(stay: HotelStay | null): FormState {
  return {
    hotelName: stay?.hotelName ?? "",
    city: stay?.city ?? "",
    country: stay?.country ?? "",
    timezone: stay?.timezone ?? "",
    checkInDate: stay?.checkInDate ?? "",
    checkOutDate: stay?.checkOutDate ?? "",
    nights:
      stay?.nights === null || stay?.nights === undefined
        ? ""
        : String(stay.nights),
    lat: stay?.lat === null || stay?.lat === undefined ? "" : String(stay.lat),
    lng: stay?.lng === null || stay?.lng === undefined ? "" : String(stay.lng),
    pricingCurrency: stay?.pricing.currency ?? "",
    pricingTotal:
      stay?.pricing.total === null || stay?.pricing.total === undefined
        ? ""
        : String(stay.pricing.total),
    pricingNightly:
      stay?.pricing.nightly === null || stay?.pricing.nightly === undefined
        ? ""
        : String(stay.pricing.nightly),
  };
}

function formatReceivedAt(value?: string) {
  if (!value) {
    return "Unknown";
  }

  try {
    return format(parseISO(value), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return value;
  }
}

function parseOptionalNumber(value: string): number | null | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const sanitized = normalized.replace(/,/g, "").replace(/[^\d.-]/g, "");

  if (!sanitized) {
    return null;
  }

  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function HotelStayEditorSheet({
  stay,
  email,
  open,
  isPending = false,
  onOpenChange,
  onSubmit,
}: HotelStayEditorSheetProps) {
  const [form, setForm] = useState<FormState>(toFormState(stay));

  useEffect(() => {
    setForm(toFormState(stay));
  }, [stay, open]);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    const payload = {
      hotelName: form.hotelName.trim(),
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      timezone: form.timezone.trim() || null,
      checkInDate: form.checkInDate.trim() || null,
      checkOutDate: form.checkOutDate.trim() || null,
      nights: form.nights.trim() ? Number(form.nights) : null,
      lat: parseOptionalNumber(form.lat),
      lng: parseOptionalNumber(form.lng),
      pricing: {
        currency: form.pricingCurrency.trim() || null,
        total: parseOptionalNumber(form.pricingTotal),
        nightly: parseOptionalNumber(form.pricingNightly),
      },
    };

    try {
      await onSubmit(
        stay
          ? payload
          : {
              ...payload,
              sourceEmailId: null,
            },
      );
    } catch {
      // apiRequest handles error toasts
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Hotel className="h-4 w-4" />
            {stay ? "Edit Hotel Stay" : "Add Hotel Stay"}
          </SheetTitle>
          <SheetDescription>
            Manual changes take precedence over later automated extraction.
            Latitude and longitude can be corrected here.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid h-[calc(100vh-13rem)] gap-6 overflow-hidden lg:grid-cols-[1.1fr_0.9fr]">
          <ScrollArea className="pr-4">
            <div className="space-y-6 pb-6">
              <section className="space-y-4 rounded-xl border border-border/60 bg-card/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Stay Details
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Core fields that define the hotel stay.
                    </p>
                  </div>
                  {stay ? (
                    <Badge variant="outline">{stay.id.slice(0, 8)}</Badge>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="hotelName">Hotel Name</Label>
                    <Input
                      id="hotelName"
                      value={form.hotelName}
                      onChange={(event) =>
                        updateField("hotelName", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(event) =>
                        updateField("city", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={form.country}
                      onChange={(event) =>
                        updateField("country", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="checkInDate">Check-in</Label>
                    <Input
                      id="checkInDate"
                      type="date"
                      value={form.checkInDate}
                      onChange={(event) =>
                        updateField("checkInDate", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="checkOutDate">Check-out</Label>
                    <Input
                      id="checkOutDate"
                      type="date"
                      value={form.checkOutDate}
                      onChange={(event) =>
                        updateField("checkOutDate", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nights">Nights</Label>
                    <Input
                      id="nights"
                      type="number"
                      min="0"
                      value={form.nights}
                      onChange={(event) =>
                        updateField("nights", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      placeholder="Asia/Kolkata"
                      value={form.timezone}
                      onChange={(event) =>
                        updateField("timezone", event.target.value)
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-xl border border-border/60 bg-card/80 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Map and Pricing
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Optional enrichment fields, including manually editable
                    coordinates.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="lat">Latitude</Label>
                    <Input
                      id="lat"
                      inputMode="decimal"
                      value={form.lat}
                      onChange={(event) =>
                        updateField("lat", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lng">Longitude</Label>
                    <Input
                      id="lng"
                      inputMode="decimal"
                      value={form.lng}
                      onChange={(event) =>
                        updateField("lng", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pricingCurrency">Currency</Label>
                    <Input
                      id="pricingCurrency"
                      placeholder="USD"
                      value={form.pricingCurrency}
                      onChange={(event) =>
                        updateField("pricingCurrency", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pricingTotal">Total Price</Label>
                    <Input
                      id="pricingTotal"
                      inputMode="decimal"
                      value={form.pricingTotal}
                      onChange={(event) =>
                        updateField("pricingTotal", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pricingNightly">Nightly Price</Label>
                    <Input
                      id="pricingNightly"
                      inputMode="decimal"
                      value={form.pricingNightly}
                      onChange={(event) =>
                        updateField("pricingNightly", event.target.value)
                      }
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
                Review the original confirmation while correcting the stay.
              </p>
            </div>

            <ScrollArea className="h-[calc(100vh-17rem)]">
              <div className="space-y-4 p-4 text-sm">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Subject
                  </div>
                  <div className="font-medium">
                    {email?.subject ?? "No source email attached."}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    From
                  </div>
                  <div className="font-mono text-xs break-all">
                    {email?.from ?? "N/A"}
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
                    {email?.snippet ?? "No snippet available."}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Body Preview
                  </div>
                  <Textarea
                    readOnly
                    className="min-h-72 resize-none bg-background font-mono text-xs leading-5"
                    value={email?.bodyText ?? "No source email body available."}
                  />
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        <SheetFooter className="pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            <Save className="mr-2 h-4 w-4" />
            {isPending ? "Saving..." : stay ? "Save changes" : "Create stay"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

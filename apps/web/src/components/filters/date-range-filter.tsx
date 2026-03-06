import { useEffect, useMemo, useState } from "react";
import { endOfDay, format, parseISO, startOfDay } from "date-fns";

import { Button } from "@workspace/ui/components/ui/button";
import { Calendar } from "@workspace/ui/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";

type DateRangeValue = {
  from: Date | undefined;
  to?: Date;
};

interface DateRangeFilterProps {
  /** ISO date string or undefined */
  dateFrom?: string;
  /** ISO date string or undefined */
  dateTo?: string;
  /** Called with { from?, to? } ISO strings */
  onChange: (range: { from?: string; to?: string }) => void;
  /** Optional className for the trigger */
  className?: string;
}

/**
 * A reusable date-range filter using a calendar popover.
 *
 * - Displays a button with the selected range or "Date range" placeholder.
 * - Includes a clear ("×") button when a range is active.
 */
export function DateRangeFilter({
  dateFrom,
  dateTo,
  onChange,
  className,
}: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo<DateRangeValue | undefined>(() => {
    const from = dateFrom ? parseISO(dateFrom) : undefined;
    const to = dateTo ? parseISO(dateTo) : undefined;

    if (!from && !to) {
      return undefined;
    }

    return { from, to };
  }, [dateFrom, dateTo]);

  const [draftRange, setDraftRange] = useState<DateRangeValue | undefined>(
    selected,
  );

  useEffect(() => {
    if (!open) {
      setDraftRange(selected);
    }
  }, [open, selected]);

  const hasRange = dateFrom || dateTo;

  const label = hasRange
    ? [
        dateFrom ? format(parseISO(dateFrom), "MMM d") : "…",
        dateTo ? format(parseISO(dateTo), "MMM d") : "…",
      ].join(" – ")
    : "Date range";

  const handleApply = () => {
    onChange({
      from: draftRange?.from
        ? startOfDay(draftRange.from).toISOString()
        : undefined,
      to: draftRange?.to ? endOfDay(draftRange.to).toISOString() : undefined,
    });
    setOpen(false);
  };

  const handleClear = () => {
    setDraftRange(undefined);
    onChange({ from: undefined, to: undefined });
    setOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 text-xs justify-start font-normal",
              !hasRange && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-1.5 size-3.5" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <div className="space-y-3 p-3">
            <Calendar
              mode="range"
              selected={draftRange}
              onSelect={setDraftRange}
              numberOfMonths={2}
              autoFocus
            />
            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={!draftRange?.from && !draftRange?.to}
              >
                Clear
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraftRange(selected);
                    setOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleApply}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {hasRange && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={handleClear}
        >
          <X className="size-3.5" />
          <span className="sr-only">Clear date range</span>
        </Button>
      )}
    </div>
  );
}

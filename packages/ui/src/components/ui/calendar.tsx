import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import * as React from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";

import { buttonVariants } from "@workspace/ui/components/ui/button";
import { cn } from "@workspace/ui/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const defaults = getDefaultClassNames();

  return (
    <div data-slot="calendar" className={cn("w-fit", className)}>
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn("calendar-root", className)}
        classNames={{
          ...defaults,
          root: cn("calendar-root w-fit", defaults.root),
          months: cn(
            "calendar-months flex flex-col gap-4 sm:flex-row sm:gap-6",
          ),
          month: cn("calendar-month flex w-[17rem] flex-col gap-4"),
          month_caption: cn(
            "calendar-month-caption relative flex h-8 w-full items-center justify-center px-9",
          ),
          caption_label: cn(
            "calendar-caption-label text-center text-sm font-medium",
          ),
          nav: cn(
            "calendar-nav absolute inset-x-0 top-0 flex h-8 items-center justify-between",
          ),
          button_previous: cn(
            "calendar-nav-button",
            buttonVariants({ variant: "outline", size: "icon" }),
            "size-8 rounded-md p-0 inset-2 relative z-10 opacity-80 hover:opacity-100",
          ),
          button_next: cn(
            "calendar-nav-button",
            buttonVariants({ variant: "outline", size: "icon" }),
            "size-8 rounded-md p-0 inset-2 -left-2 relative z-10 opacity-80 hover:opacity-100",
          ),
          month_grid: cn("calendar-month-grid w-full border-collapse"),
          weekdays: cn("calendar-weekdays flex"),
          weekday: cn(
            "calendar-weekday flex-1 rounded-md text-[0.8rem] font-medium text-muted-foreground",
          ),
          week: cn("calendar-week mt-2 flex w-full"),
          day: cn(
            "calendar-day relative h-9 w-9 p-0 text-center text-sm [&:has([aria-selected].calendar-day-range-end)]:rounded-r-md [&:has([aria-selected].calendar-day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
          ),
          day_button: cn(
            "calendar-day-button inline-flex h-9 w-9 items-center justify-center rounded-md p-0 font-normal outline-none transition-colors",
          ),
          range_start: cn("calendar-day-range-start"),
          range_end: cn("calendar-day-range-end"),
          selected: cn(
            "calendar-day-selected bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          ),
          today: cn("calendar-day-today bg-accent text-accent-foreground"),
          range_middle: cn(
            "calendar-range-middle aria-selected:bg-accent aria-selected:text-accent-foreground",
          ),
          outside: cn(
            "calendar-day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
          ),
          disabled: cn(
            "calendar-day-disabled text-muted-foreground opacity-40",
          ),
          hidden: cn("invisible"),
          chevron: cn("calendar-chevron size-4 fill-current"),
          ...classNames,
        }}
        components={{
          Chevron: ({ orientation }) =>
            orientation === "left" ? (
              <ChevronLeftIcon className="size-4" />
            ) : (
              <ChevronRightIcon className="size-4" />
            ),
        }}
        {...props}
      />
    </div>
  );
}
Calendar.displayName = "Calendar";

export { Calendar };

import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import {
  clampDateOnly, compareDateOnly, daysInMonth, formatDateOnly,
  isDateOnlyWithinBounds, shiftDateOnlyDays, shiftDateOnlyMonths, weekdayMonday,
  type DateOnlyParts,
} from "../../shared/inputs/dateOnly";

export interface CalendarProps {
  selected: DateOnlyParts | null;
  focused: DateOnlyParts;
  onFocusDate(value: DateOnlyParts): void;
  onSelect(value: DateOnlyParts): void;
  min?: string;
  max?: string;
}

const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function Calendar({ selected, focused, onFocusDate, onSelect, min, max }: CalendarProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const first = weekdayMonday({ ...focused, day: 1 });
  const count = daysInMonth(focused.year, focused.month);
  const weeks = Math.ceil((first + count) / 7);
  const previous = shiftDateOnlyMonths({ ...focused, day: 1 }, -1);
  const next = shiftDateOnlyMonths({ ...focused, day: 1 }, 1);
  const canPrevious = compareDateOnly(previous, { ...focused, day: 1 }) < 0 &&
    (!min || isDateOnlyWithinBounds({ ...focused, day: 1 }, min)) &&
    isDateOnlyWithinBounds({ year: previous.year, month: previous.month, day: daysInMonth(previous.year, previous.month) }, min);
  const canNext = compareDateOnly(next, { ...focused, day: 1 }) > 0 &&
    isDateOnlyWithinBounds({ year: next.year, month: next.month, day: 1 }, undefined, max);

  useLayoutEffect(() => {
    activeRef.current?.focus({ preventScroll: true });
  }, [focused.year, focused.month, focused.day]);

  function move(value: DateOnlyParts) {
    onFocusDate(clampDateOnly(value, min, max));
  }

  function onDayKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    let nextDay: DateOnlyParts | undefined;
    if (event.key === "ArrowLeft") nextDay = shiftDateOnlyDays(focused, -1);
    if (event.key === "ArrowRight") nextDay = shiftDateOnlyDays(focused, 1);
    if (event.key === "ArrowUp") nextDay = shiftDateOnlyDays(focused, -7);
    if (event.key === "ArrowDown") nextDay = shiftDateOnlyDays(focused, 7);
    if (event.key === "Home") nextDay = shiftDateOnlyDays(focused, -weekdayMonday(focused));
    if (event.key === "End") nextDay = shiftDateOnlyDays(focused, 6 - weekdayMonday(focused));
    if (event.key === "PageUp") nextDay = shiftDateOnlyMonths(focused, event.shiftKey ? -12 : -1);
    if (event.key === "PageDown") nextDay = shiftDateOnlyMonths(focused, event.shiftKey ? 12 : 1);
    if (!nextDay) return;
    event.preventDefault();
    event.stopPropagation();
    move(nextDay);
  }

  return (
    <div data-slot="calendar" className="w-72 select-none text-sm">
      <div className="mb-2 flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Tháng trước"
          disabled={!canPrevious} onClick={() => move(shiftDateOnlyMonths(focused, -1))}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="font-medium" aria-live="polite">Tháng {String(focused.month).padStart(2, "0")} / {String(focused.year).padStart(4, "0")}</span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Tháng sau"
          disabled={!canNext} onClick={() => move(shiftDateOnlyMonths(focused, 1))}>
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <div role="grid" aria-label={"Lịch tháng " + focused.month + " năm " + focused.year}
        className="grid grid-cols-7 gap-1">
        {weekdays.map(day => <span key={day} role="columnheader" className="grid h-7 place-content-center text-xs text-muted-foreground">{day}</span>)}
        {Array.from({ length: weeks * 7 }, (_, index) => {
          const day = index - first + 1;
          const inMonth = day >= 1 && day <= count;
          if (!inMonth) return <span key={index} aria-hidden="true" />;
          const date = { year: focused.year, month: focused.month, day };
          const iso = formatDateOnly(date);
          const active = compareDateOnly(date, focused) === 0;
          const isSelected = !!selected && compareDateOnly(date, selected) === 0;
          const enabled = isDateOnlyWithinBounds(date, min, max);
          return <div key={index} role="gridcell" aria-selected={isSelected}>
            <button type="button" ref={active ? activeRef : undefined} tabIndex={active ? 0 : -1}
              aria-label={"Chọn ngày " + iso} aria-pressed={isSelected} disabled={!enabled}
              className={[
                "flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground",
                !enabled ? "cursor-not-allowed opacity-40" : "",
              ].join(" ")}
              onFocus={() => { if (!active) onFocusDate(date); }}
              onKeyDown={onDayKeyDown}
              onClick={() => { if (enabled) onSelect(date); }}>
              {day}
            </button>
          </div>;
        })}
      </div>
      <p className="sr-only">Dùng các phím mũi tên, Home, End, Page Up/Down để chọn ngày; Enter để xác nhận.</p>
    </div>
  );
}

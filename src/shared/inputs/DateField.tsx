import { useEffect, useRef, useState, type ComponentProps } from "react";
import { CalendarDays } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Calendar } from "../../components/ui/calendar";
import {
  clampDateOnly, formatDateOnly, isDateOnlyWithinBounds, parseDateOnly,
  type DateOnlyParts,
} from "./dateOnly";

export interface DateFieldProps extends Omit<ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "onCompositionStart" | "onCompositionEnd" | "min" | "max"> {
  value: string;
  calendarLabel: string;
  onRawChange(raw: string, composing: boolean): void;
  min?: string;
  max?: string;
}

function localToday(): DateOnlyParts {
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() };
}

/** Controlled ISO text + calendar. Raw buffers and validation remain caller-owned. */
export function DateField({
  value, onRawChange, calendarLabel, min, max, disabled, readOnly, className, ...inputProps
}: DateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState<DateOnlyParts>(localToday);
  const parsed = parseDateOnly(value);
  const chosen = parsed.kind === "valid" ? parsed : null;
  const isOpen = open && !disabled && !readOnly;

  useEffect(() => {
    if (disabled || readOnly) setOpen(false);
  }, [disabled, readOnly]);

  function changeOpen(next: boolean) {
    if (next && (disabled || readOnly || composing.current)) return;
    if (next) setFocused(clampDateOnly(chosen ?? localToday(), min, max));
    setOpen(next);
  }

  function select(value: DateOnlyParts) {
    if (!isOpen || composing.current || !isDateOnlyWithinBounds(value, min, max)) return;
    onRawChange(formatDateOnly(value), false);
    setOpen(false);
    inputRef.current?.focus({ preventScroll: true });
  }

  return (
    <Popover.Root open={isOpen} onOpenChange={changeOpen}>
      <div className="relative min-w-0">
        <Input {...inputProps} ref={inputRef} type="text" autoComplete="off"
          className={["pr-10", className].filter(Boolean).join(" ")}
          value={value} readOnly={readOnly} disabled={disabled}
          onChange={event => onRawChange(event.currentTarget.value,
            composing.current || event.nativeEvent.isComposing)}
          onCompositionStart={event => {
            composing.current = true;
            onRawChange(event.currentTarget.value, true);
          }}
          onCompositionEnd={event => {
            composing.current = false;
            onRawChange(event.currentTarget.value, false);
          }} />
        <Popover.Trigger render={
          <Button type="button" variant="ghost" size="icon-sm"
            className="absolute right-0 top-0 size-8 rounded-l-none border-l border-input"
            aria-label={"Mở lịch " + calendarLabel} disabled={disabled || readOnly || composing.current} />
        }>
          <CalendarDays aria-hidden="true" />
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Positioner sideOffset={5} align="start" className="z-50">
          <Popover.Popup aria-label={"Lịch " + calendarLabel}
            initialFocus={false}
            finalFocus={type => type === "keyboard" ? inputRef.current : false}
            className="rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none"
            onKeyDown={event => {
              // The popup is portalled: prevent calendar keys from activating Workspace shortcuts.
              if (event.key !== "Escape") event.stopPropagation();
            }}>
            <Calendar selected={chosen} focused={focused} min={min} max={max}
              onFocusDate={setFocused} onSelect={select} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

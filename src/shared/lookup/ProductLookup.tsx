import { X, Undo2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
} from "@floating-ui/react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import type { CatalogPort } from "../../ports/catalogPort";
import {
  emptyLookup,
  lookupIssue,
  restoreSelection,
  selectOption,
  typeQuery,
  type LookupScope,
  type LookupValue,
} from "./lookupTypes";
import { useLookupOverlay } from "./LookupOverlayHost";
import { useProductLookup } from "./useProductLookup";
export interface ProductLookupProps {
  presentation?: "field" | "cell";
  label: string;
  value: LookupValue;
  onChange: (value: LookupValue) => void;
  scope: LookupScope;
  port: CatalogPort;
  disabled?: boolean;
  autoFocus?: boolean;
  onCancelEdit?: () => void;
}
export function ProductLookup({
  label,
  presentation = "field",
  value,
  onChange,
  scope,
  port,
  disabled = false,
  autoFocus = false,
  onCancelEdit,
}: ProductLookupProps) {
  const id = useId();
  const { host, visible } = useLookupOverlay();
  const [requestedOpen, setOpen] = useState(false);
  const composing = useRef(false);
  const open = requestedOpen && !!host && visible && !disabled;
  const lookup = useProductLookup(port, scope, value, open);
  const listRef = useRef<Array<HTMLElement | null>>([]);
  const pointerIntent = useRef<{ id: string; generation: number } | null>(null);
  const { refs, floatingStyles, context } = useFloating<HTMLInputElement>({
    open,
    onOpenChange: setOpen,
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: (reference, floating, update) => {
      let frame = 0;
      const cleanup = autoUpdate(reference, floating, () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          void update();
        });
      });
      return () => {
        cleanup();
        cancelAnimationFrame(frame);
      };
    },
    middleware: [
      offset(4),
      flip(),
      shift({ padding: 8 }),
      size({
        apply({ availableHeight, availableWidth, rects, elements }) {
          Object.assign(elements.floating.style, {
            width: `${Math.min(rects.reference.width, availableWidth, host?.clientWidth || availableWidth)}px`,
            maxHeight: `${Math.max(0, Math.min(280, availableHeight))}px`,
          });
        },
      }),
    ],
  });
  const navigation = useListNavigation(context, {
    listRef,
    activeIndex: lookup.activeIndex,
    onNavigate: lookup.setActiveIndex,
    virtual: true,
    enabled: !value.composing,
    focusItemOnOpen: false,
    loop: true,
  });
  const dismiss = useDismiss(context, {
    ancestorScroll: false,
    escapeKey: false,
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions(
    [navigation, dismiss],
  );
  function choose(index: number) {
    const option = lookup.options[index];
    if (!option || value.composing || composing.current) return;
    // useListNavigation focuses the clicked option even in virtual mode.
    // Restore the input for an explicit selection, never for outside dismiss.
    refs.domReference.current?.focus({ preventScroll: true });
    onChange(selectOption(option));
    lookup.setActiveIndex(null);
    setOpen(false);
  }
  const issue = lookupIssue(value);
  return (
    <div
      className={presentation === "cell" ? "flex h-full min-w-0 items-center gap-1" : "min-w-0"}
      data-lookup
      onKeyDownCapture={(event) => {
        if (
          event.key === "Escape" &&
          !open &&
          !composing.current &&
          !event.nativeEvent.isComposing
        )
          onCancelEdit?.();
      }}
    >
      <label htmlFor={id} className={presentation === "cell" ? "sr-only" : undefined}>{label}</label>
      <Input
        className={presentation === "cell" ? "min-w-0 flex-1" : undefined}
        data-composing={value.composing}
        {...getReferenceProps({
          ref: refs.setReference,
          id,
          role: "combobox",
          "aria-autocomplete": "list",
          "aria-expanded": open,
          "aria-controls": open ? `${id}-list` : undefined,
          "aria-activedescendant":
            open && lookup.activeIndex !== null
              ? `${id}-${lookup.options[lookup.activeIndex]?.id}`
              : undefined,
          "aria-invalid": !!issue,
          "aria-describedby": issue ? `${id}-error` : undefined,
          value: value.query,
          disabled,
          autoFocus,
          onFocus: () => setOpen(true),
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
            onChange(typeQuery(value, event.target.value, composing.current));
            lookup.setActiveIndex(null);
            setOpen(true);
          },
          onCompositionStart: (
            event: React.CompositionEvent<HTMLInputElement>,
          ) => {
            composing.current = true;
            onChange(typeQuery(value, event.currentTarget.value, true));
            lookup.setActiveIndex(null);
          },
          onCompositionEnd: (
            event: React.CompositionEvent<HTMLInputElement>,
          ) => {
            composing.current = false;
            onChange(typeQuery(value, event.currentTarget.value, false));
            setOpen(true);
          },
          onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (composing.current || event.nativeEvent.isComposing) {
              if (
                ["Enter", "Escape", "ArrowDown", "ArrowUp"].includes(event.key)
              )
                event.stopPropagation();
              return;
            }
            if (event.key === "Escape") {
              if (open) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
              }
            } else if (event.key === "Tab") setOpen(false);
            else if (event.key === "Enter" && open) {
              event.preventDefault();
              event.stopPropagation();
              if (lookup.activeIndex !== null) choose(lookup.activeIndex);
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp")
              event.stopPropagation();
          },
        })}
      />
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size={presentation === "cell" ? "icon-sm" : "sm"}
          disabled={disabled}
          onClick={() => {
            onChange({ ...emptyLookup });
            setOpen(false);
          }}
        >
          {presentation === "cell" ? <><X /><span className="sr-only">Xóa lựa chọn</span></> : "Xóa lựa chọn"}
        </Button>
        <Button
          variant="ghost"
          size={presentation === "cell" ? "icon-sm" : "sm"}
          disabled={disabled || value.confirmed}
          onClick={() => {
            onChange(restoreSelection(value));
            setOpen(false);
          }}
        >
          {presentation === "cell" ? <><Undo2 /><span className="sr-only">Khôi phục lựa chọn</span></> : "Khôi phục lựa chọn"}
        </Button>
      </div>
      {issue && (
        <p id={`${id}-error`} className={presentation === "cell" ? "sr-only" : "text-destructive"} role="status">
          {issue}
        </p>
      )}
      {open && host && (
        <FloatingPortal root={host}>
          <div
            {...getFloatingProps({
              ref: refs.setFloating,
              style: floatingStyles,
              role: "listbox",
              id: `${id}-list`,
              "aria-label": label,
              className:
                "ag-custom-component-popup pointer-events-auto overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            })}
          >
            {lookup.status === "loading" && <p role="status">Đang tìm…</p>}
            {lookup.status === "error" && <p role="alert">{lookup.error}</p>}
            {lookup.status === "ready" && !lookup.options.length && (
              <p role="status">Không có kết quả.</p>
            )}
            {lookup.options.map((option, index) => (
              <div
                key={option.id}
                {...getItemProps({
                  ref: (node: HTMLDivElement | null) => {
                    listRef.current[index] = node;
                  },
                  id: `${id}-${option.id}`,
                  role: "option",
                  "aria-selected": value.selectedId === option.id,
                  tabIndex: -1,
                  className: `cursor-default rounded-sm px-2 py-1.5 ${lookup.activeIndex === index ? "bg-accent text-accent-foreground" : ""}`,
                  onPointerDown: (event: React.PointerEvent) => {
                    pointerIntent.current = {
                      id: option.id,
                      generation: lookup.generation,
                    };
                    if (event.pointerType === "mouse") event.preventDefault();
                  },
                  onPointerCancel: () => {
                    pointerIntent.current = null;
                  },
                  onClick: (event: React.MouseEvent) => {
                    const intent = pointerIntent.current;
                    pointerIntent.current = null;
                    if (
                      event.detail === 0 ||
                      (intent &&
                        intent.id === option.id &&
                        intent.generation === lookup.generation)
                    )
                      choose(index);
                  },
                })}
              >
                {option.code} · {option.name}
              </div>
            ))}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}

import type { ReactNode } from "react";

/** Compact, wrapping filter layout. The feature owns all raw and applied values. */
export function FilterBar({ children, label }: { children: ReactNode; label: string }) {
  return <div role="group" aria-label={label} className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-3">{children}</div>;
}

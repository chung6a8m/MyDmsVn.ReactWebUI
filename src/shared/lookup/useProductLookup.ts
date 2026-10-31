import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import type { CatalogPort } from "../../ports/catalogPort";
import type { LookupScope, LookupValue } from "./lookupTypes";
import { createLookupSearch, lookupRequestKey } from "./lookupSearch";
export function useProductLookup(
  port: CatalogPort,
  scope: LookupScope,
  value: LookupValue,
  enabled: boolean,
) {
  const search = useMemo(() => createLookupSearch(port), [port]);
  const result = useStore(search.state, (s) => s);
  const [active, setActive] = useState<{
    key: string;
    generation: number;
    index: number | null;
  }>({ key: "", generation: 0, index: null });
  const key = lookupRequestKey(scope, value.query);
  useEffect(() => {
    if (enabled && !value.composing) void search.search(scope, value.query);
    else search.invalidate();
    return () => search.invalidate();
  }, [search, key, enabled, value.composing]);
  const current = result.key === key && enabled && !value.composing;
  const options = current ? result.options : [];
  const activeIndex =
    current && active.key === key && active.generation === result.generation
      ? active.index
      : null;
  return {
    options,
    status: current ? result.status : "idle",
    error: result.error,
    activeIndex,
    generation: result.generation,
    setActiveIndex: (index: number | null) =>
      setActive({ key, generation: result.generation, index }),
  };
}

import { describe, it, expect } from "vitest";
import {
  emptyLookup,
  typeQuery,
  selectOption,
  restoreSelection,
  lookupIssue,
} from "../../../src/shared/lookup/lookupTypes";
import { createLookupSearch } from "../../../src/shared/lookup/lookupSearch";
import type { CatalogPort } from "../../../src/ports/catalogPort";
const option = {
  id: "9007199254740993",
  name: "Cà phê",
  code: "CF",
  isActive: true,
};
const scope = {
  sessionId: "A",
  generation: 1,
  actorKey: "demo",
  actorGeneration: 1,
  clientLineId: "line",
  catalogContext: "default",
};
it("typing_never_selects_and_clear_is_explicit", () => {
  const selected = selectOption(option);
  const typed = typeQuery(selected, "");
  expect(typed.selectedId).toBe(option.id);
  expect(typed.confirmed).toBe(false);
  expect(lookupIssue(typed)).toBeTruthy();
  expect(restoreSelection(typed)).toEqual(selected);
  expect(emptyLookup.selectedId).toBeNull();
  expect(lookupIssue(emptyLookup)).toBeTruthy();
  expect(lookupIssue(selected)).toBeUndefined();
  expect(lookupIssue(typeQuery(selected, "Cà phê", true))).toBeTruthy();
});
describe("request identity", () => {
  for (const change of [
    { query: "new" },
    { catalogContext: "other" },
    { sessionId: "B" },
    { generation: 2 },
    { clientLineId: "other" },
    { actorGeneration: 2 },
  ]) {
    it(`ignores_old_response_${JSON.stringify(change)}`, async () => {
      const pending: ((
        r: Awaited<ReturnType<CatalogPort["search"]>>,
      ) => void)[] = [];
      const signals: AbortSignal[] = [];
      const lookup = createLookupSearch({
        search: (_q, c) => {
          signals.push(c.signal);
          return new Promise((r) => pending.push(r));
        },
      });
      const old = lookup.search(scope, "old");
      const next = lookup.search(
        { ...scope, ...change },
        "query" in change ? change.query! : "old",
      );
      expect(signals[0].aborted).toBe(true);
      pending[1]({ kind: "success", value: [option] });
      await next;
      pending[0]({ kind: "success", value: [{ ...option, id: "stale" }] });
      await old;
      expect(lookup.state.getState().options[0].id).toBe(option.id);
      lookup.invalidate();
      expect(lookup.state.getState().options).toEqual([]);
    });
  }
  it("dispose_ignores_late_response_and_error_preserves_no_stale_options", async () => {
    let resolve!: (v: Awaited<ReturnType<CatalogPort["search"]>>) => void;
    const lookup = createLookupSearch({
      search: () => new Promise((r) => (resolve = r)),
    });
    const task = lookup.search(scope, "");
    lookup.invalidate();
    resolve({ kind: "success", value: [option] });
    await task;
    expect(lookup.state.getState().options).toEqual([]);
    const failed = createLookupSearch({
      search: async () => {
        throw Error("offline");
      },
    });
    await failed.search(scope, "");
    expect(failed.state.getState().status).toBe("error");
  });
});

it("session_publication_survives_unmount_blocks_save_and_rejects_stale_identity", async () => {
  const { createLabWorkspaceRuntime } =
    await import("../../../src/lab/runtime/createLabWorkspaceRuntime");
  const { publishLookup, readLookup, restoreLookup } =
    await import("../../../src/shared/lookup/sessionLookup");
  const w = createLabWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  const identity = w.store.getState().sessions[id];
  const value = typeQuery(selectOption(option), "query chưa chọn");
  expect(publishLookup(w.store, identity, "product:line", value)).toBe(true);
  expect(readLookup(w.store, id, "product:line")).toEqual(value);
  expect((await w.sales.requestSave(id)).kind).toBe("blocked");
  const revision = w.store.getState().sessions[id].editRevision;
  expect(
    publishLookup(
      w.store,
      { ...identity, generation: 2 },
      "product:line",
      emptyLookup,
    ),
  ).toBe(false);
  expect(w.store.getState().sessions[id].editRevision).toBe(revision);
  publishLookup(w.store, identity, "product:line", emptyLookup);
  expect((await w.sales.requestSave(id)).kind).toBe("blocked");
  restoreLookup(w.store, identity, "product:line", undefined);
  expect(w.store.getState().sessions[id].dirty).toBe(false);
  expect(w.store.getState().sessions[id].editRevision).toBe(revision + 2);
});

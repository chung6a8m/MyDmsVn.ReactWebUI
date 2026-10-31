import { expect, it, vi } from "vitest";
import { createWorkspaceRuntime } from "../../../src/app/workspace/panelRegistry";
import { createWorkspaceDocument } from "../../../src/infrastructure/fake/workspaceFixtures";
import type { SalesPort } from "../../../src/ports/salesPort";

function deferRead(w: ReturnType<typeof createWorkspaceRuntime>) {
  let resolve!: (result: Awaited<ReturnType<SalesPort["get"]>>) => void;
  let reject!: (error: Error) => void;
  vi.spyOn(w.port, "get").mockImplementationOnce(
    () => new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    }),
  );
  return {
    resolve: (value: Awaited<ReturnType<SalesPort["get"]>>) => resolve(value),
    reject: () => reject(new Error("old read")),
  };
}

it.each(["success", "reject"] as const)("old Create recovery %s cannot replace unknown Update evidence or unlock close", async (outcome) => {
  const w = createWorkspaceRuntime();
  const id = await w.openSalesDocument(null);
  const seed = createWorkspaceDocument("1001").saved;
  w.store.setState((state) => ({
    sessions: {
      ...state.sessions,
      [id]: {
        ...state.sessions[id],
        dirty: true,
        draft: {
          ...seed,
          saleId: null,
          expectedVersion: null,
          note: "create-round",
          lines: seed.lines.map((line) => ({ ...line, saleLineId: null })),
        },
      },
    },
  }));
  w.scenarios.setMode("commit-then-response-lost");
  expect((await w.sales.requestSave(id)).kind).toBe("outcome-unknown");
  const listed = await w.port.list(
    { search: "create-round", pageSize: 10 },
    w.portContext(),
  );
  if (listed.kind !== "success") throw Error("list failed");
  const saleId = listed.value.items[0].saleId;
  const oldResult = await w.port.get(saleId, w.portContext());
  const deferred = deferRead(w);
  const oldRead = w.sales.inspectRecovery(id, saleId);
  await w.sales.inspectRecovery(id, saleId);
  expect(w.sales.confirmRecovery(id)).toBe(true);
  expect(await w.openSalesDocument(saleId)).toBe(id);
  w.writeBuffer(id, "note", "update-round");
  w.scenarios.setMode("eventual-commit");
  expect((await w.sales.requestSave(id)).kind).toBe("outcome-unknown");
  await w.sales.inspectRecovery(id);
  const preview = w.store.getState().sessions[id].recovery;
  if (outcome === "success") deferred.resolve(oldResult);
  else deferred.reject();
  await oldRead;
  expect(w.store.getState().sessions[id].recovery).toBe(preview);
  expect(w.sales.confirmRecovery(id)).toBe(false);
  expect(await w.close.requestClose(id, "command")).toBe("blocked");
  expect(w.store.getState().sessions[id].mutationSnapshot?.note).toBe("update-round");
  w.scenarios.complete(w.scenarios.state.getState().pending[0].requestId);
  await w.sales.inspectRecovery(id);
  expect(w.sales.confirmRecovery(id)).toBe(true);
  expect(await w.close.requestClose(id, "command")).toBe("closed");
});

it.each(["success", "reject"] as const)("old Draft reload %s cannot replace the newer Posted preview", async (outcome) => {
  const w = createWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  const oldResult = await w.port.get("1001", w.portContext());
  const deferred = deferRead(w);
  const oldRead = w.sales.inspectReload(id);
  expect((await w.sales.requestPost(id)).kind).toBe("saved");
  await w.sales.inspectReload(id);
  const preview = w.store.getState().sessions[id].recovery;
  if (outcome === "success") deferred.resolve(oldResult);
  else deferred.reject();
  await oldRead;
  expect(w.store.getState().sessions[id].recovery).toBe(preview);
  expect(w.sales.confirmReload(id)).toBe(true);
  expect(w.store.getState().sessions[id].baseline?.status).toBe("Posted");
});

it("confirmation rejects evidence when its mutation snapshot has been replaced", async () => {
  const w = createWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  w.writeBuffer(id, "note", "original mutation");
  w.scenarios.setMode("commit-then-response-lost");
  await w.sales.requestSave(id);
  await w.sales.inspectRecovery(id);
  expect(w.store.getState().sessions[id].recovery?.eligible).toBe(true);
  // Keep the preview to exercise confirmation's own guard, independently of
  // request-time invalidation. Equal business data is still a different attempt.
  w.store.setState((state) => ({
    sessions: {
      ...state.sessions,
      [id]: {
        ...state.sessions[id],
        mutationSnapshot: structuredClone(state.sessions[id].mutationSnapshot!),
      },
    },
  }));
  expect(w.sales.confirmRecovery(id)).toBe(false);
  expect(await w.close.requestClose(id, "command")).toBe("blocked");
});

it.each(["success", "reject"] as const)("reload %s finishes during a nonmutating snapshot check", async (outcome) => {
  const w = createWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  const result = await w.port.get("1001", w.portContext());
  const deferred = deferRead(w);
  const reading = w.sales.inspectReload(id);
  let finishFlush!: () => void;
  const unregister = w.barrier.register(
    id,
    () => new Promise<void>((resolve) => {
      finishFlush = resolve;
    }),
  );
  const checking = w.barrier.prepareSave(id);
  expect(w.store.getState().sessions[id].preparing).toBe(true);
  if (outcome === "success") deferred.resolve(result);
  else deferred.reject();
  await reading;
  expect(w.sales.confirmReload(id)).toBe(false);
  finishFlush();
  expect((await checking).kind).toBe("ready");
  unregister();
  expect(w.store.getState().sessions[id].recovery?.loading).toBe(false);
  expect(w.sales.confirmReload(id)).toBe(outcome === "success");
});

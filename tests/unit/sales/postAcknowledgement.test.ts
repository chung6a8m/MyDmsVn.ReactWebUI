import { expect, it, vi } from "vitest";
import { createLabWorkspaceRuntime } from "../../../src/lab/runtime/createLabWorkspaceRuntime";
import { createSalesPortCommands, businessMatches } from "../../../src/features/sales/salesCommands";
import { canEdit, sessionDirty } from "../../../src/features/sales/salesSessionStore";
import type { SalesDocument, ReadResult, WriteResult } from "../../../src/features/sales/contracts";
import { createWorkspaceRuntime } from "../../../src/app/workspace/panelRegistry";
import { createFakeCatalogPort } from "../../../src/infrastructure/fake/fakeCatalogPort";
import { createFakeSalesPort } from "../../../src/infrastructure/fake/fakeSalesPort";

const ack = {
  saleId: "1001", status: "Posted" as const,
  postedAtUtc: "2026-10-31T08:00:00Z", version: "posted-version",
};

async function setup() {
  const w = createLabWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  let complete!: (result: ReadResult<SalesDocument>) => void;
  const get = vi.fn(() => new Promise<ReadResult<SalesDocument>>((resolve) => { complete = resolve; }));
  const post = vi.fn(async () => ({ kind: "success" as const, value: ack }));
  const commands = createSalesPortCommands(w.store, { ...w.port, post, get });
  return { w, id, commands, post, get, complete: (result: ReadResult<SalesDocument>) => complete(result) };
}

it.each(["forbidden", "unavailable", "protocol"] as const)("confirmed Post survives detail %s and cannot replay", async (kind) => {
  const { w, id, commands, post, get, complete } = await setup();
  const previous = w.store.getState().sessions[id].baseline;
  const result = await commands.requestPost(id);
  expect(result.kind).toBe("posted");
  expect(get).toHaveBeenCalledTimes(1);
  const session = w.store.getState().sessions[id];
  expect(session).toMatchObject({ postAcknowledgement: ack, mutation: "idle" });
  expect(session.baseline).toBe(previous);
  expect(canEdit(session)).toBe(false);
  expect(sessionDirty(session)).toBe(false);
  expect((await commands.requestPost(id)).kind).toBe("blocked");
  complete({ kind: "failed", error: { kind, code: kind, message: "detail unavailable" } });
  await vi.waitFor(() => expect(w.store.getState().sessions[id].feedback).toContain("detail unavailable"));
  expect(w.store.getState().sessions[id]).toMatchObject({ postAcknowledgement: ack, mutation: "idle" });
  expect(post).toHaveBeenCalledTimes(1);
  expect(await w.close.requestClose(id, "command")).toBe("closed");
});

it("late Draft detail and explicit reread never regress confirmed Posted", async () => {
  const { w, id, commands, complete } = await setup();
  const draft = structuredClone(w.store.getState().sessions[id].baseline!);
  await commands.requestPost(id);
  complete({ kind: "success", value: draft });
  await vi.waitFor(() => expect(w.store.getState().sessions[id].recovery?.loading).not.toBe(true));
  expect(canEdit(w.store.getState().sessions[id])).toBe(false);
  const reread = commands.inspectReload(id);
  complete({ kind: "success", value: draft });
  await reread;
  expect(commands.confirmReload(id)).toBe(false);
  expect(w.store.getState().sessions[id]).toMatchObject({ postAcknowledgement: ack });
});

it("Posted detail supplies costs only after Get and keeps row identities", async () => {
  const { w, id, commands, complete } = await setup();
  const draft = structuredClone(w.store.getState().sessions[id].baseline!);
  const rowIds = draft.lines.map((line) => line.clientLineId);
  await commands.requestPost(id);
  const detail: SalesDocument = { ...draft, ...ack, saved: { ...draft.saved, expectedVersion: ack.version }, totalCost: "1.0000", grossProfit: "2.0000" };
  complete({ kind: "success", value: detail });
  await vi.waitFor(() => expect(w.store.getState().sessions[id].baseline?.status).toBe("Posted"));
  expect(w.store.getState().sessions[id].baseline?.totalCost).toBe("1.0000");
  expect(w.store.getState().sessions[id].draft?.lines.map((line) => line.clientLineId)).toEqual(rowIds);
  expect(canEdit(w.store.getState().sessions[id])).toBe(false);
});

it("automatic detail cannot replace a newer explicit detail preview", async () => {
  const { w, id, commands, complete } = await setup();
  const draft = structuredClone(w.store.getState().sessions[id].baseline!);
  const detail: SalesDocument = { ...draft, ...ack, saved: { ...draft.saved, expectedVersion: ack.version }, totalCost: "1.0000", grossProfit: "2.0000" };
  await commands.requestPost(id);
  // Each read has a distinct deferred resolver. Preserve the automatic one
  // before the explicit review path takes ownership of the next read.
  const automaticComplete = complete;
  let explicitComplete!: (value: ReadResult<SalesDocument>) => void;
  const get = vi.spyOn(w.port, "get").mockImplementationOnce(() => new Promise((resolve) => { explicitComplete = resolve; }));
  // The commands use the injected read function, so this test's concurrency
  // coverage is provided by a separate command instance over the same store.
  const other = createSalesPortCommands(w.store, { ...w.port, get });
  const review = other.inspectReload(id);
  explicitComplete({ kind: "success", value: detail });
  await review;
  const preview = w.store.getState().sessions[id].recovery;
  automaticComplete({ kind: "success", value: { ...detail, version: "older-posted-version" } });
  await Promise.resolve();
  await Promise.resolve();
  expect(w.store.getState().sessions[id].recovery).toBe(preview);
  expect(other.confirmReload(id)).toBe(true);
  expect(w.store.getState().sessions[id].baseline?.version).toBe(ack.version);
});

it("recovery business comparison treats exact decimal scales as equivalent", () => {
  const w = createLabWorkspaceRuntime();
  return w.openSalesDocument("1001").then((id) => {
    const snapshot = w.store.getState().sessions[id].draft!;
    // Use explicit decimal strings regardless of the fixture's display scale.
    const left = { ...snapshot, lines: snapshot.lines.map((line) => ({ ...line, qty: "90071992547409.1000", unitPrice: "0.1000" })) };
    const other = { ...snapshot, lines: snapshot.lines.map((line) => ({ ...line, qty: "90071992547409.1", unitPrice: "0.1" })) };
    expect(businessMatches(left, other)).toBe(true);
    expect(businessMatches(left, { ...other, lines: other.lines.map((line) => ({ ...line, qty: "90071992547409.1001" })) })).toBe(false);
  });
});

it.each(["different-actor", "same-user-new-session"])("late write for %s stays privately unknown and recovery cannot read", async change => {
  let scope = { actorKey: "1", actorGeneration: 1, capabilities: { read: true, write: true, post: true } };
  const fake = createFakeSalesPort();
  let finish!: (value: WriteResult<SalesDocument>) => void;
  let started!: () => void;
  const dispatched = new Promise<void>(resolve => { started = resolve; });
  const save = vi.fn(() => { started(); return new Promise<WriteResult<SalesDocument>>(resolve => { finish = resolve; }); });
  const get = vi.fn(fake.get);
  const w = createWorkspaceRuntime({ sales: { ...fake, get, save }, catalog: createFakeCatalogPort(), auth: { getSnapshot: () => scope, subscribe: () => () => {} }, today: () => "2026-10-31", storage: null });
  const id = await w.openSalesDocument("1001");
  const original = w.store.getState().sessions[id].baseline!;
  w.writeBuffer(id, "note", "private pending text");
  const saving = w.sales.requestSave(id);
  await dispatched;
  scope = { ...scope, actorKey: change === "different-actor" ? "2" : "1", actorGeneration: 2 };
  finish({ kind: "success", value: { ...original, version: "late-version" } });
  expect((await saving).kind).toBe("outcome-unknown");
  expect(w.store.getState().sessions[id]).toMatchObject({ mutation: "outcome-unknown", mutationSnapshot: { note: "private pending text" }, baseline: { version: original.version } });
  await w.sales.inspectRecovery(id);
  expect(get).toHaveBeenCalledTimes(1);
  expect(w.sales.confirmRecovery(id)).toBe(false);
  expect(await w.close.requestClose(id, "command")).toBe("blocked");
  expect(save).toHaveBeenCalledTimes(1);
});

it("scope lost during editor flush releases preparation without dispatching or losing raw", async () => {
  const w = createLabWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  w.writeBuffer(id, "note", "private raw");
  let owner = true;
  const save = vi.fn(w.port.save);
  const commands = createSalesPortCommands(w.store, { ...w.port, save }, w.barrier, undefined, () => owner);
  w.barrier.register(id, async () => { owner = false; });
  expect((await commands.requestSave(id)).kind).toBe("blocked");
  expect(save).not.toHaveBeenCalled();
  expect(w.store.getState().sessions[id]).toMatchObject({ preparing: false, mutation: "idle", rawBuffers: { note: { raw: "private raw" } } });
});

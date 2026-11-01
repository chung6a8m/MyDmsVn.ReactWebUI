import { expect, it, vi } from "vitest";
import { createLabWorkspaceRuntime } from "../../../src/lab/runtime/createLabWorkspaceRuntime";
import { createSalesPortCommands } from "../../../src/features/sales/salesCommands";
import { createGoodsReceiptCommands } from "../../../src/features/goodsReceipt/goodsReceiptCommands";
import { setup as receiptSetup, document as receiptDocument } from "../goodsReceipt/fixtures";
import type { DocumentIdentity } from "../../../src/app/workspace/documentContracts";
import type { SalesSession } from "../../../src/features/sales/salesSessionStore";
import { createSalesCloseRegistry } from "../../../src/features/sales/salesCloseAdapter";
import { createGoodsReceiptCloseRegistry } from "../../../src/features/goodsReceipt/goodsReceiptCloseAdapter";
const operationId = "11111111-2222-4333-8444-555555555555";
const epoch = "11111111-2222-4333-8444-555555555555";
async function salesSetup() {
  const w = createLabWorkspaceRuntime(); const id = await w.openSalesDocument("1001");
  const patch = (change: Partial<SalesSession>) => w.store.setState(s => ({ sessions: { ...s.sessions, [id]: { ...s.sessions[id], ...change } } }));
  patch({ deploymentEpoch: epoch });
  const live = () => w.store.getState().sessions[id];
  const identity: DocumentIdentity = { ...live(), module: "sales" };
  const sent = structuredClone(live().draft!); const saved = structuredClone(live().baseline!);
  saved.version = "confirmed-v2"; saved.saved.expectedVersion = saved.version;
  saved.lines.forEach(line => { line.clientLineId = "server-identity"; }); saved.saved.lines.forEach(line => { line.clientLineId = "server-identity"; });
  patch({ mutation: "outcome-unknown", mutationKind: "save", mutationSnapshot: sent, localRecovery: { operationId }, rawBuffers: { note: { raw: "uncommitted", composing: true } } });
  const get = vi.fn(w.port.get); const bind = vi.fn(() => true);
  const commands = createSalesPortCommands(w.store, { ...w.port, get }, undefined, bind);
  return { w, id, patch, live, identity, sent, saved, commands, get, bind };
}
it("applies protected Sales Save only to its exact owner and preserves client row identities", async () => {
  const s = await salesSetup();
  expect(s.commands.applyProtectedResult(s.identity, operationId, { kind: "save", value: s.saved })).toBe(true);
  expect(s.live()).toMatchObject({ mutation: "idle", dirty: false, rawBuffers: {}, lookupBuffers: {} });
  expect(s.live().localRecovery).toBeUndefined(); expect(s.live().mutationSnapshot).toBeUndefined();
  expect(s.live().draft!.lines.map(line => line.clientLineId)).toEqual(s.sent.lines.map(line => line.clientLineId));
  expect(s.bind).toHaveBeenCalledOnce(); expect(s.get).not.toHaveBeenCalled();
});
it("requires an explicit server review after a known conflict before another Sales mutation", async () => {
  const s = await salesSetup(); s.patch({ mutation: "idle", localRecovery: undefined, writeReviewRequired: true });
  expect((await s.commands.requestSave(s.id)).kind).toBe("blocked");
  expect((await s.commands.requestPost(s.id)).kind).toBe("blocked");
  await s.commands.inspectReload(s.id);
  expect(s.get).toHaveBeenCalledOnce(); expect(s.commands.confirmReload(s.id)).toBe(true);
  expect(s.live().writeReviewRequired).toBeUndefined();
});
it.each(["epoch", "actor", "actorGeneration", "generation", "revision", "module", "operation", "target", "business", "mutationKind", "idle", "bind"])("does not apply protected Sales result after %s mismatch", async fault => {
  const s = await salesSetup(); const identity = { ...s.identity };
  if (fault === "epoch") identity.deploymentEpoch = "other";
  if (fault === "actor") identity.actorKey = "other";
  if (fault === "actorGeneration") identity.actorGeneration++;
  if (fault === "generation") identity.generation++;
  if (fault === "revision") identity.editRevision++;
  if (fault === "module") identity.module = "goods-receipt";
  if (fault === "target") s.saved.saleId = "999";
  if (fault === "business") s.saved.saved.note = "different";
  if (fault === "mutationKind") s.patch({ mutationKind: "post" });
  if (fault === "idle") s.patch({ mutation: "idle" });
  if (fault === "bind") s.bind.mockReturnValue(false);
  expect(s.commands.applyProtectedResult(identity, fault === "operation" ? "wrong" : operationId, { kind: "save", value: s.saved })).toBe(false);
  expect(s.live().localRecovery).toEqual({ operationId }); expect(s.live().rawBuffers.note.raw).toBe("uncommitted");
});
it("protected Sales Post is terminal without automatically reading public detail", async () => {
  const s = await salesSetup(); s.patch({ mutationKind: "post" });
  const acknowledgement = { saleId: s.saved.saleId, status: "Posted" as const, version: "post-version", postedAtUtc: "2026-11-01T00:00:00Z" };
  expect(s.commands.applyProtectedResult(s.identity, operationId, { kind: "post", value: acknowledgement })).toBe(true);
  expect(s.live()).toMatchObject({ postAcknowledgement: acknowledgement, mutation: "idle", rawBuffers: {}, lookupBuffers: {}, dirty: false });
  expect(s.live().localRecovery).toBeUndefined(); expect(s.get).not.toHaveBeenCalled();
});
it("public Sales Get cannot confirm a durable operation", async () => {
  const s = await salesSetup(); s.get.mockResolvedValue({ kind: "success", value: s.saved });
  await s.commands.inspectRecovery(s.id); expect(s.commands.confirmRecovery(s.id)).toBe(false);
  expect(s.live().localRecovery).toEqual({ operationId }); expect(s.live().mutation).toBe("outcome-unknown");
});
it("Sales Save supplies the barrier-prepared document identity and cannot unlock a failed durable intent", async () => {
  const s = await salesSetup(); s.patch({ localRecovery: undefined, mutation: "idle", mutationSnapshot: undefined, mutationKind: undefined, rawBuffers: {}, editRevision: 4 });
  const save = vi.fn(async () => { s.patch({ localRecovery: { operationId } }); return { kind: "failed" as const, dispatched: false as const, error: { kind: "unavailable" as const, code: "local", message: "Not settled" } }; });
  const commands = createSalesPortCommands(s.w.store, { ...s.w.port, save });
  expect((await commands.requestSave(s.id)).kind).toBe("outcome-unknown");
  expect(save.mock.calls[0]).toHaveLength(2);
  expect((save.mock.calls[0] as unknown[])[1]).toMatchObject({ document: { localDocumentId: s.id, generation: s.identity.generation, editRevision: 4 } });
  expect(s.live().mutation).toBe("outcome-unknown"); expect(s.live().localRecovery).toEqual({ operationId });
});
it("applies Receipt protected Save while preserving row IDs and clearing durable marker", () => {
  const s = receiptSetup(); s.patch({ deploymentEpoch: epoch, mutation: "pending", mutationKind: "save", mutationSnapshot: s.session.draft!, localRecovery: { operationId } });
  const commands = createGoodsReceiptCommands(s.store, s.port);
  expect(commands.applyProtectedResult({ ...s.live(), module: "goods-receipt" }, operationId, { kind: "save", value: receiptDocument(s.session.draft!, "v2") })).toBe(true);
  expect(s.live().localRecovery).toBeUndefined(); expect(s.live().mutation).toBe("idle"); expect(s.live().draft!.lines[0].clientLineId).toBe("local-row");
});
it("Receipt protected Post rejects wrong identity and extra version, never reads public detail", () => {
  const s = receiptSetup(); s.patch({ deploymentEpoch: epoch, mutation: "outcome-unknown", mutationKind: "post", mutationSnapshot: s.session.draft!, localRecovery: { operationId }, rawBuffers: { note: { raw: "old", composing: true } } });
  const get = vi.fn(s.port.get); const commands = createGoodsReceiptCommands(s.store, { ...s.port, get });
  const identity = { ...s.live(), module: "goods-receipt" as const };
  const value = { receiptId: s.session.receiptId!, status: "Posted" as const, postedAtUtc: "2026-11-01T00:00:00Z" };
  expect(commands.applyProtectedResult({ ...identity, deploymentEpoch: "other" }, operationId, { kind: "post", value })).toBe(false);
  expect(commands.applyProtectedResult(identity, operationId, { kind: "post", value: { ...value, version: "not-allowed" } as typeof value })).toBe(false);
  expect(commands.applyProtectedResult(identity, operationId, { kind: "post", value })).toBe(true);
  expect(s.live()).toMatchObject({ mutation: "idle", postAcknowledgement: value, rawBuffers: {}, lookupBuffers: {} }); expect(s.live().localRecovery).toBeUndefined(); expect(get).not.toHaveBeenCalled();
});
it("public Receipt recovery cannot unlock an operation and failed dispatch retains marker", async () => {
  const s = receiptSetup(); s.patch({ mutation: "outcome-unknown", mutationKind: "save", mutationSnapshot: s.session.draft!, localRecovery: { operationId } });
  const commands = createGoodsReceiptCommands(s.store, s.port);
  await commands.inspectRecovery("session"); expect(commands.confirmRecovery("session")).toBe(false);
  s.patch({ mutation: "idle", localRecovery: undefined });
  const save = vi.fn(async () => { s.patch({ localRecovery: { operationId } }); return { kind: "failed" as const, error: { kind: "forbidden" as const, code: "denied", message: "denied" } }; });
  const result = await createGoodsReceiptCommands(s.store, { ...s.port, save }).requestSave("session");
  expect(result.kind).toBe("outcome-unknown"); expect(s.live().localRecovery).toEqual({ operationId }); expect(s.live().mutation).toBe("outcome-unknown");
  expect((save.mock.calls[0] as unknown[])[1]).toMatchObject({ document: { localDocumentId: "session", generation: 1, editRevision: 0 } });
});
it("Sales close admission blocks a surviving operation marker even when mutation is idle", async () => {
  const s = await salesSetup(); s.patch({ mutation: "idle", rawBuffers: {} });
  const registry = createSalesCloseRegistry({ store: s.w.store, save: s.commands.requestSave, finalise: () => true, scope: () => s.identity, isCurrentScope: () => true });
  expect(registry.getAdapter(s.id)?.isCloseBlocked()).toBe(true);
});
it("Receipt close admission blocks a surviving operation marker even when mutation is idle", () => {
  const s = receiptSetup(); s.patch({ localRecovery: { operationId } }); const commands = createGoodsReceiptCommands(s.store, s.port);
  const registry = createGoodsReceiptCloseRegistry({ store: s.store, save: commands.requestSave, finalise: () => true, scope: () => s.session, isCurrentScope: () => true });
  expect(registry.getAdapter("session")?.isCloseBlocked()).toBe(true);
});
it("blocks Receipt writes after a known rejection until a public detail review is confirmed", async () => {
  const s = receiptSetup(); s.patch({ writeReviewRequired: true }); const get = vi.fn(s.port.get);
  const commands = createGoodsReceiptCommands(s.store, { ...s.port, get });
  expect((await commands.requestSave("session")).kind).toBe("blocked"); expect((await commands.requestPost("session")).kind).toBe("blocked");
  await commands.inspectReload("session"); expect(get).toHaveBeenCalledOnce();
  expect(commands.confirmReload("session")).toBe(true); expect(s.live().writeReviewRequired).toBeUndefined();
});
it("direct Sales Post accepts the already-applied protected result without public Get", async () => {
  const s = await salesSetup(); s.patch({ localRecovery: undefined, mutation: "idle", mutationKind: undefined, mutationSnapshot: undefined, rawBuffers: {} });
  const value = { version: "post-version", postedAtUtc: "2026-11-01T00:00:00Z", status: "Posted" as const, saleId: s.saved.saleId };
  const commands = createSalesPortCommands(s.w.store, { ...s.w.port, get: s.get, post: async (_input, context) => {
    expect(context.document).toEqual({ localDocumentId: s.id, generation: s.identity.generation, editRevision: s.identity.editRevision });
    s.patch({ localRecovery: { operationId } });
    expect(commands.applyProtectedResult(s.identity, operationId, { kind: "post", value: { saleId: value.saleId, status: value.status, postedAtUtc: value.postedAtUtc, version: value.version } })).toBe(true);
    return { kind: "success", value };
  } });
  expect((await commands.requestPost(s.id)).kind).toBe("posted"); expect(s.get).not.toHaveBeenCalled();
});
it("direct Receipt Post accepts the already-applied protected result without public Get", async () => {
  const s = receiptSetup(); const get = vi.fn(s.port.get);
  const value = { postedAtUtc: "2026-11-01T00:00:00Z", status: "Posted" as const, receiptId: s.session.receiptId! };
  const commands = createGoodsReceiptCommands(s.store, { ...s.port, get, post: async (_input, context) => {
    expect(context.document).toEqual({ localDocumentId: "session", generation: 1, editRevision: 0 });
    s.patch({ localRecovery: { operationId } });
    expect(commands.applyProtectedResult({ ...s.live(), module: "goods-receipt" }, operationId, { kind: "post", value: { receiptId: value.receiptId, status: value.status, postedAtUtc: value.postedAtUtc } })).toBe(true);
    return { kind: "success", value };
  } });
  expect((await commands.requestPost("session")).kind).toBe("posted"); expect(get).not.toHaveBeenCalled();
});

import { expect, it, vi } from "vitest";
import { setup, document, deferred } from "./fixtures";
import { createGoodsReceiptCommands } from "../../../src/features/goodsReceipt/goodsReceiptCommands";
import { createGoodsReceiptEditorBarrier } from "../../../src/features/goodsReceipt/goodsReceiptEditorBarrier";
import { writeRaw, writeLookup } from "../../../src/features/goodsReceipt/sessionEditing";
import type { GoodsReceiptDocument } from "../../../src/features/goodsReceipt/contracts";
import type { ReadResult, WriteResult } from "../../../src/ports/portContracts";

it("save replaces server IDs preserving captured client row IDs and committed null-label fallback", async () => {
  const { store, session, port, live } = setup();
  writeLookup(store, session, "product:local-row", { selectedId: "3", displayText: "Đã chọn", query: "Đã chọn", confirmed: true, composing: false });
  port.save = async snapshot => { const doc = document(snapshot, "v2"); doc.saved.lines[0].receiptLineId = "999"; doc.lines[0].receiptLineId = "999"; return { kind: "success", value: doc }; };
  expect((await createGoodsReceiptCommands(store, port).requestSave("session")).kind).toBe("saved");
  expect(live().draft!.lines[0]).toMatchObject({ clientLineId: "local-row", receiptLineId: "999" });
  expect(live().lookupBuffers?.["product:local-row"].displayText).toBe("Đã chọn");
  expect(live().baseline!.lines[0].product.displayName).toBeNull(); expect(live().dirty).toBe(false);
});
it.each(["wrong-id", "Posted", "cardinality", "product", "line-order"])("untrusted direct-port save %s stays unknown with frozen snapshot", async mismatch => {
  const { store, session, port, live } = setup(); writeRaw(store, session, "note", "sent");
  port.save = async snapshot => {
    const doc = document(snapshot, "v2");
    if (mismatch === "wrong-id") doc.receiptId = "9999";
    if (mismatch === "Posted") doc.status = "Posted";
    if (mismatch === "cardinality") doc.lines = [];
    if (mismatch === "product") doc.lines[0].productId = "9";
    if (mismatch === "line-order") doc.lines[0].lineNumber = 2;
    return { kind: "success", value: doc };
  };
  const commands = createGoodsReceiptCommands(store, port);
  expect((await commands.requestSave("session")).kind).toBe("outcome-unknown");
  expect(live().mutationSnapshot?.note).toBe("sent"); expect(Object.isFrozen(live().mutationSnapshot)).toBe(true);
  expect(writeRaw(store, session, "note", "changed")).toBe(false);
});
it("coalesces Save intent and blocks a different mutation", async () => {
  const { store, port } = setup(); const response = deferred<WriteResult<GoodsReceiptDocument>>();
  port.save = vi.fn(() => response.promise); const commands = createGoodsReceiptCommands(store, port);
  const first = commands.requestSave("session"); expect(commands.requestSave("session")).toBe(first);
  expect((await commands.requestPost("session")).kind).toBe("blocked");
  response.resolve({ kind: "success", value: document(undefined, "v2") }); await first; expect(port.save).toHaveBeenCalledTimes(1);
});
it("maps known indexed errors to sent row and releases pre-dispatch failures", async () => {
  const { store, port, live } = setup();
  port.save = async () => ({ kind: "failed", dispatched: false, error: { kind: "validation", code: "bad", message: "Bad", issues: [{ code: "bad", field: "lines[0].quantity", message: "Quantity" }] } });
  expect((await createGoodsReceiptCommands(store, port).requestSave("session")).kind).toBe("failed");
  expect(live().issues?.[0]).toMatchObject({ field: "quantity:local-row", clientLineId: "local-row" }); expect(live().mutation).toBe("idle");
});
it("fences actor shift after dispatch while preserving old private snapshot", async () => {
  const { store, port, live } = setup(); const response = deferred<WriteResult<GoodsReceiptDocument>>(); let owner = true;
  port.save = () => response.promise; const commands = createGoodsReceiptCommands(store, port, undefined, undefined, () => owner);
  const saving = commands.requestSave("session"); await Promise.resolve(); await Promise.resolve(); owner = false;
  response.resolve({ kind: "success", value: document(undefined, "v2") });
  expect((await saving).kind).toBe("outcome-unknown"); expect(live().mutationSnapshot).toBeDefined(); expect(live().baseline?.version).toBe("v1");
});
it.each(["forbidden", "unavailable", "stale"])("Post without Write flushes and keeps no-version ack after %s detail", async failure => {
  const { store, port, patch, live } = setup(); patch({ capabilities: { read: false, write: false, post: true } });
  port.get = async () => failure === "stale" ? { kind: "success", value: document() } : { kind: "failed", error: { kind: failure as "forbidden" | "unavailable", code: "read", message: "Unavailable" } };
  const barrier = createGoodsReceiptEditorBarrier(store); const flush = vi.fn(async () => {}); barrier.register("session", flush);
  const commands = createGoodsReceiptCommands(store, port, barrier);
  const result = await commands.requestPost("session"); await Promise.resolve();
  expect(result.kind).toBe("posted"); expect(flush).toHaveBeenCalledOnce(); expect(live().postAcknowledgement).toEqual({ receiptId: "1001", status: "Posted", postedAtUtc: "2026-11-01T00:00:00Z" });
  expect(live().baseline?.version).toBe("v1"); expect((await commands.requestSave("session")).kind).toBe("blocked");
});
it("active editor revision and dirty raw prevent Post with no implicit Save", async () => {
  const { store, port, patch, live } = setup(); const barrier = createGoodsReceiptEditorBarrier(store);
  barrier.register("session", async () => patch({ editRevision: live().editRevision + 1, rawBuffers: { note: { raw: "late candidate", composing: false } } }));
  port.post = vi.fn(port.post); port.save = vi.fn(port.save);
  expect((await createGoodsReceiptCommands(store, port, barrier).requestPost("session")).kind).toBe("blocked");
  expect(port.post).not.toHaveBeenCalled(); expect(port.save).not.toHaveBeenCalled(); expect(live().rawBuffers.note.raw).toBe("late candidate");
});
it("unknown Update recovery needs changed version plus ordered matching business snapshot and confirmation", async () => {
  const { store, session, port, server, live } = setup(); port.save = vi.fn(async () => ({ kind: "outcome-unknown" as const }));
  writeRaw(store, session, "note", "sent"); const commands = createGoodsReceiptCommands(store, port); await commands.requestSave("session");
  await commands.inspectRecovery("session"); expect(commands.confirmRecovery("session")).toBe(false);
  server.version = "v2"; server.saved.expectedVersion = "v2";
  await commands.inspectRecovery("session"); expect(commands.confirmRecovery("session")).toBe(false);
  server.saved.note = "sent"; await commands.inspectRecovery("session"); expect(live().mutation).toBe("outcome-unknown");
  expect(commands.confirmRecovery("session")).toBe(true); expect(live().mutationSnapshot).toBeUndefined(); expect(port.save).toHaveBeenCalledOnce();
});
it("Create recovery requires explicit candidate and safe record binding", async () => {
  const { store, port, patch, live } = setup(); patch({ receiptId: null, baseline: null, draft: { ...document().saved, receiptId: null, expectedVersion: null } });
  port.save = async () => ({ kind: "outcome-unknown" }); let allowBind = false;
  const commands = createGoodsReceiptCommands(store, port, undefined, () => allowBind); await commands.requestSave("session");
  await commands.inspectRecovery("session"); expect(commands.confirmRecovery("session")).toBe(false);
  await commands.inspectRecovery("session", "1001"); expect(commands.confirmRecovery("session")).toBe(false); expect(live().mutationSnapshot).toBeDefined();
  allowBind = true; expect(commands.confirmRecovery("session")).toBe(true); expect(live().receiptId).toBe("1001");
});
it("recovery rounds reject out-of-order reads, failed reads, replacement generation and stale confirmation", async () => {
  const { store, port, patch, live } = setup(); port.save = async () => ({ kind: "outcome-unknown" });
  const commands = createGoodsReceiptCommands(store, port); await commands.requestSave("session");
  const old = deferred<ReadResult<GoodsReceiptDocument>>(); port.get = () => old.promise; const first = commands.inspectRecovery("session");
  port.get = async () => ({ kind: "failed", error: { kind: "not-found", code: "404", message: "Missing" } }); await commands.inspectRecovery("session");
  old.resolve({ kind: "success", value: document(undefined, "v2") }); await first; expect(commands.confirmRecovery("session")).toBe(false);
  port.get = async () => ({ kind: "success", value: document(undefined, "v2") }); await commands.inspectRecovery("session");
  patch({ generation: 2 }); expect(commands.confirmRecovery("session")).toBe(false); expect(live().mutation).toBe("outcome-unknown");
});
it("409 read review retains raw until explicit confirm and editing invalidates confirmation", async () => {
  const { store, session, port, live } = setup(); port.save = async () => ({ kind: "failed", error: { kind: "conflict", code: "409", message: "Conflict" } });
  writeRaw(store, session, "note", "mine"); const commands = createGoodsReceiptCommands(store, port); await commands.requestSave("session");
  await commands.inspectReload("session"); expect(live().draft?.note).toBe("mine"); expect(live().rawBuffers.note.raw).toBe("mine");
  writeRaw(store, session, "note", "new edit"); expect(commands.confirmReload("session")).toBe(false);
  await commands.inspectReload("session"); expect(live().rawBuffers.note.raw).toBe("new edit"); expect(commands.confirmReload("session")).toBe(true); expect(live().draft?.note).toBeNull();
});
it("Post unknown needs authoritative same-ID Posted, never stale Draft", async () => {
  const { store, port, server, live } = setup(); port.post = async () => ({ kind: "outcome-unknown" });
  const commands = createGoodsReceiptCommands(store, port); await commands.requestPost("session");
  await commands.inspectRecovery("session"); expect(commands.confirmRecovery("session")).toBe(false);
  server.status = "Posted"; server.postedAtUtc = "2026-11-01T00:00:00Z"; server.version = "posted"; server.saved.expectedVersion = "posted";
  await commands.inspectRecovery("session"); expect(commands.confirmRecovery("session")).toBe(true); expect(live().baseline?.status).toBe("Posted");
});
it("Post flushes even already dirty editors before refusing without Save", async () => {
  const { store, session, port } = setup(); writeRaw(store, session, "note", "dirty"); const barrier = createGoodsReceiptEditorBarrier(store); const flush = vi.fn(async () => {}); barrier.register("session", flush);
  expect((await createGoodsReceiptCommands(store, port, barrier).requestPost("session")).kind).toBe("blocked"); expect(flush).toHaveBeenCalledOnce();
});
it("permission revoked during preparation prevents dispatch", async () => {
  const { store, port, patch } = setup(); const barrier = createGoodsReceiptEditorBarrier(store);
  barrier.register("session", async () => patch({ capabilities: { read: true, write: false, post: false } })); port.save = vi.fn(port.save);
  expect((await createGoodsReceiptCommands(store, port, barrier).requestSave("session")).kind).toBe("blocked"); expect(port.save).not.toHaveBeenCalled();
});
it("changed editRevision invalidates an unknown recovery confirmation", async () => {
  const { store, port, patch, live } = setup(); port.save = async () => ({ kind: "outcome-unknown" }); port.get = async () => ({ kind: "success", value: document(undefined, "v2") });
  const commands = createGoodsReceiptCommands(store, port); await commands.requestSave("session"); await commands.inspectRecovery("session");
  patch({ editRevision: live().editRevision + 1 }); expect(commands.confirmRecovery("session")).toBe(false);
});
it("rejects extra fake Post version at direct port boundary", async () => {
  const { store, port, live } = setup(); port.post = async () => ({ kind: "success", value: { receiptId: "1001", status: "Posted", postedAtUtc: "2026-11-01T00:00:00Z", version: "fabricated" } });
  expect((await createGoodsReceiptCommands(store, port).requestPost("session")).kind).toBe("outcome-unknown"); expect(live().postAcknowledgement).toBeUndefined();
});
it("invalid post-ack detail is unavailable without hanging the read or reverting acknowledgement", async () => {
  const { store, port, live } = setup(); port.get = async () => ({ kind: "success", value: { ...document(), status: "Posted", postedAtUtc: null } });
  await createGoodsReceiptCommands(store, port).requestPost("session"); await Promise.resolve();
  expect(live().postAcknowledgement?.status).toBe("Posted"); expect(live().recovery?.loading).not.toBe(true); expect(live().feedback).toContain("Chi tiết chưa có");
});
it("later nonnull authoritative labels replace fallback without changing historical activity", async () => {
  const { store, session, port, live } = setup(); writeLookup(store, session, "product:local-row", { selectedId: "3", displayText: "Local", query: "Local", confirmed: true, composing: false });
  const commands = createGoodsReceiptCommands(store, port); await commands.requestSave("session");
  const detail = document(undefined, "v3"); detail.lines[0].product = { id: "3", displayName: "Historical", isActive: false }; port.get = async () => ({ kind: "success", value: detail });
  await commands.inspectReload("session"); expect(commands.confirmReload("session")).toBe(true);
  expect(live().lookupBuffers?.["product:local-row"].displayText).toBe("Historical"); expect(live().baseline?.lines[0].product.isActive).toBe(false);
});
it("coalesces pending Post and never replays an unknown result", async () => {
  const { store, port, live } = setup(); const result = deferred<WriteResult<import("../../../src/features/goodsReceipt/contracts").GoodsReceiptPostAcknowledgement>>(); port.post = vi.fn(() => result.promise);
  const commands = createGoodsReceiptCommands(store, port); const first = commands.requestPost("session"); expect(commands.requestPost("session")).toBe(first);
  result.resolve({ kind: "outcome-unknown" }); expect((await first).kind).toBe("outcome-unknown"); expect((await commands.requestPost("session")).kind).toBe("outcome-unknown");
  expect(port.post).toHaveBeenCalledOnce(); expect(live().mutationSnapshot).toBeDefined();
});
it("recovery inspection finishing after a new mutation cannot overwrite its state", async () => {
  const { store, port, session, live } = setup(); const result = deferred<ReadResult<GoodsReceiptDocument>>(); port.get = () => result.promise;
  const commands = createGoodsReceiptCommands(store, port); const inspecting = commands.inspectReload("session");
  writeRaw(store, session, "note", "new mutation"); await commands.requestSave("session"); result.resolve({ kind: "success", value: document() }); await inspecting;
  expect(live().baseline?.version).toBe("v2"); expect(live().draft?.note).toBe("new mutation"); expect(commands.confirmReload("session")).toBe(false);
});

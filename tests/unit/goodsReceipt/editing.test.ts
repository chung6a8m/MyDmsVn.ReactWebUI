import { expect, it } from "vitest";
import { setup } from "./fixtures";
import { canEdit, sessionDirty } from "../../../src/features/goodsReceipt/goodsReceiptSessionStore";
import { editDraft, writeRaw, writeLookup, restoreLookup, addLine, removeLine } from "../../../src/features/goodsReceipt/sessionEditing";
import { validateGoodsReceipt } from "../../../src/features/goodsReceipt/validation";
import { createGoodsReceiptEditorBarrier } from "../../../src/features/goodsReceipt/goodsReceiptEditorBarrier";
it("requires explicit Write and captured ownership on every edit", () => {
  const { store, session, patch, live } = setup();
  patch({ capabilities: undefined }); expect(canEdit(live())).toBe(false); expect(writeRaw(store, session, "note", "x")).toBe(false);
  patch({ capabilities: { read: true, write: true, post: true } });
  expect(editDraft(store, { ...session, generation: 2 }, d => ({ ...d, note: "stale" }))).toBe(false);
  expect(writeRaw(store, session, "note", "x")).toBe(true); expect(live().editRevision).toBe(1);
});
it("keeps invalid and composing text dirty and blocks save without losing buffers", async () => {
  const { store, session, live } = setup(); const barrier = createGoodsReceiptEditorBarrier(store);
  for (const [raw, composing] of [["1e2", false], ["1.0000", true]] as const) {
    writeRaw(store, session, "quantity:local-row", raw, composing);
    expect(sessionDirty(live())).toBe(true); expect((await barrier.prepareSave("session")).kind).toBe("blocked");
    expect(live().rawBuffers["quantity:local-row"].raw).toBe(raw); expect(live().preparing).toBe(false);
  }
});
it("lookup query is distinct from committed identity and Escape restores it", () => {
  const { store, session, live } = setup();
  writeLookup(store, session, "product:local-row", { selectedId: "3", displayText: "Hàng", query: "other", confirmed: false, composing: false });
  expect(live().draft!.lines[0].productId).toBe("3"); expect(sessionDirty(live())).toBe(true);
  restoreLookup(store, session, "product:local-row"); expect(sessionDirty(live())).toBe(false);
});
it("normalizes latest decimal and freezes ordered snapshot", async () => {
  const { store, session, live } = setup(); writeRaw(store, session, "quantity:local-row", "001,25000");
  const result = await createGoodsReceiptEditorBarrier(store).prepareSave("session");
  expect(result.kind).toBe("ready"); if (result.kind !== "ready") return;
  expect(result.snapshot.lines[0].quantity).toBe("1.2500"); expect(Object.isFrozen(result.snapshot.lines[0])).toBe(true);
  expect(live().draft!.lines[0].quantity).toBe("1.2500");
});
it("detects a changed revision during editor flush", async () => {
  const { store, patch, live } = setup(); const barrier = createGoodsReceiptEditorBarrier(store);
  barrier.register("session", async () => patch({ editRevision: live().editRevision + 1 }));
  expect((await barrier.prepareSave("session")).kind).toBe("blocked");
});
it("adds stable independent identities and removes only the deleted row buffers", () => {
  const { store, session, live } = setup(); const added = addLine(store, session);
  expect(added).toBeTruthy(); expect(added).not.toBe("3");
  writeRaw(store, session, `quantity:${added}`, "bad"); writeRaw(store, session, "quantity:local-row", "other");
  expect(removeLine(store, session, added!)).toBe(true); expect(live().rawBuffers[`quantity:${added}`]).toBeUndefined();
  expect(live().rawBuffers["quantity:local-row"].raw).toBe("other");
});
it("validates duplicate products at offending row, 200 boundary, strict IDs, note, and calendar date", () => {
  const { server } = setup(); const draft = structuredClone(server.saved);
  draft.lines = Array.from({ length: 200 }, (_, i) => ({ ...draft.lines[0], clientLineId: String(i), productId: String(i + 1) }));
  expect(validateGoodsReceipt(draft)).toEqual([]);
  draft.lines = [...draft.lines, { ...draft.lines[0], clientLineId: "extra" }];
  expect(validateGoodsReceipt(draft)).toEqual(expect.arrayContaining([expect.objectContaining({ field: "lines" }), expect.objectContaining({ field: "product:extra", clientLineId: "extra" })]));
  draft.warehouseId = "2147483648"; draft.receiptDate = "2025-02-29"; draft.note = "a\0";
  expect(validateGoodsReceipt(draft).map(i => i.field)).toEqual(expect.arrayContaining(["warehouseId", "receiptDate", "note"]));
});
it.each(["0", "100000000000000", "1.00001", "1e3"])("rejects invalid receipt quantity %s", value => {
  const { server } = setup(); server.saved.lines[0].quantity = value;
  expect(validateGoodsReceipt(server.saved).some(i => i.field === "quantity:local-row")).toBe(true);
});
it("valid input limits do not impose client-side valuation overflow policy", () => {
  const { server } = setup(); server.saved.lines[0].quantity = "99999999999999.9999"; server.saved.lines[0].unitCost = "999999999999999.9999";
  expect(validateGoodsReceipt(server.saved)).toEqual([]);
});
it("rejects default calendar date, malformed Unicode and overlong decimal lexical input", () => {
  const { server } = setup(); server.saved.receiptDate = "0001-01-01"; server.saved.note = "\uD800"; server.saved.lines[0].quantity = "0".repeat(65) + "1";
  expect(validateGoodsReceipt(server.saved).map(i => i.field)).toEqual(expect.arrayContaining(["receiptDate", "note", "quantity:local-row"]));
});
it.each(["preparing", "pending", "outcome-unknown", "Posted", "ack"])("all editing paths refuse %s state", mode => {
  const { store, session, patch, live } = setup();
  if (mode === "preparing") patch({ preparing: true });
  else if (mode === "Posted") patch({ baseline: { ...live().baseline!, status: "Posted" } });
  else if (mode === "ack") patch({ postAcknowledgement: { receiptId: "1001", status: "Posted", postedAtUtc: "2026-11-01T00:00:00Z" } });
  else patch({ mutation: mode as "pending" | "outcome-unknown" });
  expect(writeRaw(store, session, "note", "edit")).toBe(false); expect(editDraft(store, session, d => ({ ...d, note: "edit" }))).toBe(false);
  expect(addLine(store, session)).toBeUndefined(); expect(removeLine(store, session, "local-row")).toBe(false);
  expect(writeLookup(store, session, "warehouseId", { selectedId: "1", displayText: "Kho", query: "other", confirmed: false, composing: false })).toBe(false);
});

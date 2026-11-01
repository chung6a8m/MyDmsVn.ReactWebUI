import { expect, it } from "vitest";
import { createLabWorkspaceRuntime } from "../../../src/lab/runtime/createLabWorkspaceRuntime";

it("overlapping record IDs and new documents remain in independent feature stores", async () => {
  const w = createLabWorkspaceRuntime();
  const receipt = w.receipt;
  const sale = await w.openSalesDocument("1001");
  const other = await w.openDocument("goods-receipt", "1001");
  expect(other).not.toBe(sale);
  expect(await w.openDocument("goods-receipt", "1001")).toBe(other);
  expect(await w.openSalesDocument("1001")).toBe(sale);
  w.writeBuffer(sale, "note", "Sales riêng");
  receipt.write(other, "Nhập kho riêng");
  expect(w.store.getState().sessions[other]).toBeUndefined();
  expect(receipt.store.getState().sessions[sale]).toBeUndefined();
  const fresh = await Promise.all([w.openSalesDocument(null), w.openSalesDocument(null), w.openDocument("goods-receipt", null), w.openDocument("goods-receipt", null)]);
  expect(new Set(fresh).size).toBe(4);
  w.commands.activate(other);
  const target = w.commands.capture()!;
  expect(target.module).toBe("goods-receipt");
  w.commands.mark(target);
  expect(receipt.store.getState().sessions[other].commandCount).toBe(1);
  expect(w.store.getState().sessions[sale].commandCount).toBe(0);
});

it("close-all freezes opens across modules and preserves a later unknown receipt", async () => {
  const w = createLabWorkspaceRuntime();
  const receipt = w.receipt;
  const sale = await w.openSalesDocument("1001");
  const other = await w.openDocument("goods-receipt", "1001");
  w.writeBuffer(sale, "note", "dirty");
  receipt.setMutation(other, "outcome-unknown");
  const closing = w.close.closeAll("close-all");
  expect(await w.openSalesDocument(null)).toBe("");
  // An untrusted extra argument cannot acquire the private layout restore path.
  expect(await Reflect.apply(w.openDocument, undefined, ["sales", null, crypto.randomUUID()])).toBe("");
  expect(await w.openDocument("goods-receipt", null)).toBe("");
  await w.close.respond(sale, "discard");
  expect(await closing).toBe("blocked");
  expect(w.store.getState().sessions[sale]).toBeUndefined();
  expect(receipt.store.getState().sessions[other].mutation).toBe("outcome-unknown");
});

it("read-only singleton activation clears document command targets and stale retarget is denied", async () => {
  const w = createLabWorkspaceRuntime();

  await w.openSalesDocument("1001");
  const scope = w.portContext();
  const id = await w.openPanel("inventory-stock-card", { stockKey: "A" }, scope);
  expect(id).not.toBe("");
  expect(w.commands.capture()).toBeNull();
  expect(await w.openPanel("inventory-stock-card", { stockKey: "B" }, scope)).toBe(id);
  expect(w.panelState.getState().panels[id].filters).toEqual({ stockKey: "B", pageNumber: 1 });
  expect(await w.openPanel("inventory-stock-card", { stockKey: "C" }, { ...scope, actorGeneration: 99 })).toBe("");
  expect(w.panelState.getState().panels[id].filters?.stockKey).toBe("B");
});

it("close-all removes records and read-only panels after document admission succeeds", async () => {
  const w = createLabWorkspaceRuntime();
  await w.openSalesDocument("1001");
  await w.openPanel("goods-receipt");
  await w.openPanel("inventory-stock-card");
  expect(await w.close.closeAll("close-all")).toBe("closed");
  expect(w.documents()).toHaveLength(0);
  expect(Object.keys(w.panelState.getState().panels)).toHaveLength(0);
});

it.each(["cancelled", "blocked"] as const)("close-all preserves simple panels when document admission is %s", async outcome => {
  const w = createLabWorkspaceRuntime();
  const sale = await w.openSalesDocument("1001");
  const card = await w.openPanel("inventory-stock-card");
  if (outcome === "cancelled") w.writeBuffer(sale, "note", "dirty");
  else {
    const receipt = await w.openDocument("goods-receipt", "1001");
    w.receipt.setMutation(receipt, "outcome-unknown");
  }
  const closing = w.close.closeAll("close-all");
  if (outcome === "cancelled") await w.close.respond(sale, "cancel");
  expect(await closing).toBe(outcome);
  expect(w.panelState.getState().panels[card]).toBeDefined();
  expect(w.panelState.getState().panels["foundation-catalog"]).toBeDefined();
});

it("feature capabilities and old actor identities never grant another module access", async () => {
  const { createWorkspaceRuntime } = await import("../../../src/app/workspace/panelRegistry");
  const { injectedRuntimeFixture } = await import("./injectedRuntimeFixture");
  const { registerReceiptWorkspaceStub } = await import("../../../src/lab/receiptWorkspaceStub");
  const f = injectedRuntimeFixture();
  f.publish({ ...f.auth.getSnapshot(), features: { sales: { read: true, write: false, post: false }, "goods-receipt": { read: true, write: true, post: false }, "inventory-balances": { read: false }, "inventory-stock-card": { read: true } } });
  const w = createWorkspaceRuntime(f.dependencies);
  const receipt = registerReceiptWorkspaceStub(w);
  expect(await w.openSalesDocument(null)).toBe("");
  const id = await w.openDocument("goods-receipt", "1001");
  const identity = w.commands.capture()!;
  receipt.write(id, "private receipt");
  expect(await w.openPanel("inventory-balances")).toBe("");
  const card = await w.openPanel("inventory-stock-card");
  const old = f.auth.getSnapshot();
  f.publish({ ...old, actorGeneration: old.actorGeneration + 1 });
  expect(await w.openDocument("goods-receipt", "1001")).toBe("");
  expect(w.commands.mark(identity)).toBe(false);
  expect(await w.close.closeAll("close-all")).toBe("blocked");
  expect(await w.closePanel(card, "command")).toBe("blocked");
  receipt.write(id, "leak");
  expect(receipt.store.getState().sessions[id].raw).toBe("private receipt");
  expect(w.documents().some(document => document.isDirtyIncludingRaw())).toBe(true);
});
it("toolbar activation preserves inventory singleton filters while explicit stock-key open retargets", async () => {
 const w = createLabWorkspaceRuntime();
 const id = await w.openPanel("inventory-stock-card", { warehouseId: "1", productId: "2" });
 const filters = w.panelState.getState().panels[id].filters;
 expect(await w.openPanel("inventory-stock-card")).toBe(id);
 expect(w.panelState.getState().panels[id].filters).toBe(filters);
 expect(await w.openPanel("inventory-stock-card", { warehouseId: "3", productId: "4" })).toBe(id);
 expect(w.panelState.getState().panels[id].filters).toEqual({ warehouseId: "3", productId: "4", pageNumber: 1 });
 w.dispose();
});

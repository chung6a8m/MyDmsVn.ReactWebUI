import { expect, it } from "vitest";
import { createInventoryViews } from "../../../src/features/inventory/inventoryViews";
it("retains committed and raw lookup state plus paging for the same live panel", () => {
  const views = createInventoryViews();
  const filters = { warehouseId: "1", productId: "7" };
  const view = views.panel("card", filters);
  const raw = { ...view.getState().product, query: "chưa chọn ệ", confirmed: false, composing: true };
  view.setState({ local: { pageNumber: 3, pageSize: 50, fromUtc: "raw UTC", toUtc: "2026-11-02T00:00:00Z", search: "P7" }, product: raw });
  views.retain(["card"]); // renderer detach/move does not remove live membership
  expect(views.panel("card", filters)).toBe(view);
  expect(views.panel("card", filters).getState()).toEqual({ local: { pageNumber: 3, pageSize: 50, fromUtc: "raw UTC", toUtc: "2026-11-02T00:00:00Z", search: "P7" }, warehouse: view.getState().warehouse, product: raw });
});
it("explicit stock-key retarget resets editor and page while ordinary activation preserves them", () => {
  const views = createInventoryViews(), filters = { warehouseId: "1", productId: "7" };
  const prior = views.panel("card", filters);
  prior.setState({ local: { pageNumber: 4, pageSize: 100 } });
  expect(views.panel("card", filters)).toBe(prior);
  const retarget = views.panel("card", { warehouseId: "1", productId: "8" });
  expect(retarget).not.toBe(prior);
  expect(retarget.getState().local).toEqual({ pageNumber: 1, pageSize: 25 });
  expect(retarget.getState().product.selectedId).toBe("8");
});
it("admitted removal and actor cleanup discard private view buffers", () => {
  const views = createInventoryViews();
  const prior = views.panel("balances", undefined);
  prior.setState({ local: { search: "private", pageNumber: 2, pageSize: 50 } });
  views.retain([]);
  const reopened = views.panel("balances", undefined);
  expect(reopened).not.toBe(prior);
  expect(reopened.getState().local).toEqual({ pageNumber: 1, pageSize: 25 });
  views.clear();
  expect(views.panel("balances", undefined)).not.toBe(reopened);
});

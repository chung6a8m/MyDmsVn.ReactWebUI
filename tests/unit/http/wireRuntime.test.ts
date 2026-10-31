import { expect, it } from "vitest";
import { businessDate, createProductionRuntime } from "../../../src/app/runtime/createProductionRuntime";
import { createAuthSession } from "../../../src/infrastructure/http/authSession";
it("uses the configured business calendar across browser timezone day boundaries", () => {
  expect(businessDate(new Date("2026-10-31T18:00:00Z"))).toBe("2026-11-01");
  expect(businessDate(new Date("2024-02-28T18:00:00Z"))).toBe("2024-02-29");
});
it("composes real workspace with injected business date and auth reader", async () => {
  const auth = createAuthSession({ fetch, storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, lock: async work => work(), notify: () => {} });
  const runtime = createProductionRuntime(auth, { today: () => "2024-02-29", storage: null });
  expect(runtime.workspace.auth).toBe(auth);
  const id = await runtime.workspace.openSalesDocument(null);
  expect(runtime.workspace.store.getState().sessions[id].draft?.saleDate).toBe("2024-02-29");
  expect(runtime.content).toBeTruthy();
  runtime.workspace.dispose();
});

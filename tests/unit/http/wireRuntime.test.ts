import { expect, it, vi } from "vitest";
import { businessDate, createProductionRuntime } from "../../../src/app/runtime/createProductionRuntime";
import { createAuthSession } from "../../../src/infrastructure/http/authSession";
it("uses the configured business calendar across browser timezone day boundaries", () => {
  expect(businessDate(new Date("2026-10-31T18:00:00Z"))).toBe("2026-11-01");
  expect(businessDate(new Date("2024-02-28T18:00:00Z"))).toBe("2024-02-29");
});
it("composes real workspace with injected business date and auth reader", async () => {
  const data = (value: unknown) => new Response(JSON.stringify({ data: value }));
  const user = { userId: 1, username: "tester", displayName: "Tester" };
  const token = `e30.${btoa(JSON.stringify({ sid: "test", exp: 9999999999 }))}.signature`;
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(data({ accessToken: token, expiresAtUtc: "2286-11-20T17:46:39Z", user })).mockResolvedValueOnce(data(user)).mockResolvedValueOnce(data({ read: true, write: true, post: false }));
  const auth = createAuthSession({ fetch: fetcher, storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, lock: async work => work(), notify: () => {} });
  await auth.login("tester", "unit-fixture");
  const runtime = createProductionRuntime(auth, { today: () => "2024-02-29", storage: null });
  expect(runtime.workspace.auth).toBe(auth);
  const id = await runtime.workspace.openSalesDocument(null);
  expect(runtime.workspace.store.getState().sessions[id].draft?.saleDate).toBe("2024-02-29");
  expect(runtime.content).toBeTruthy();
  runtime.workspace.dispose();
});

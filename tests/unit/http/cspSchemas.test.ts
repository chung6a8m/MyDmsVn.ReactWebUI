import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("auth and wire validation never probe eval under the production CSP", async () => {
  vi.resetModules();
  let evalAttempts = 0;
  vi.stubGlobal("Function", new Proxy(Function, {
    construct() { evalAttempts++; throw new EvalError("CSP blocks unsafe-eval"); },
  }));
  const { userSchema } = await import("../../../src/infrastructure/http/authApi");
  const { catalogSchema } = await import("../../../src/infrastructure/http/salesWireSchemas");
  expect(userSchema.parse({ userId: 1, username: "alice", displayName: "Alice" }).userId).toBe(1);
  expect(catalogSchema.parse([{ id: 1, code: "P", name: "Product", isActive: true }])).toHaveLength(1);
  expect(catalogSchema.safeParse([{ id: "1", code: "P", name: "Product", isActive: true }]).success).toBe(false);
  expect(evalAttempts).toBe(0);
});

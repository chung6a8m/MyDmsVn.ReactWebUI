import { describe, expect, it, vi } from "vitest";
import {
  abortBeforeObservation,
  assertSameFrozenRequest,
  createWeb6NetworkSummary,
  loseCommittedResponse,
  web6ManualScenarios,
} from "../../pilot/web6-manual-resend-helpers";

describe("WEB6 live manual-resend pilot helpers", () => {
  it("enumerates the six critical operation kinds once", () => {
    expect(web6ManualScenarios.map(value => value.operationKind)).toEqual([
      "Sales.Create", "Sales.Update", "Sales.Post",
      "Receipt.Create", "Receipt.Update", "Receipt.Post",
    ]);
  });

  it("cuts not-observed before route.fetch", async () => {
    const route = { abort: vi.fn(async () => {}), fetch: vi.fn(async () => { throw Error("must not fetch"); }) };
    await abortBeforeObservation(route as never);
    expect(route.abort).toHaveBeenCalledWith("failed");
    expect(route.fetch).not.toHaveBeenCalled();
  });

  it("cuts committed response only after a real 200 and disposal", async () => {
    const order: string[] = [];
    const response = {
      status: vi.fn(() => 200),
      json: vi.fn(async () => { order.push("json"); return { data: { saleId: "19" } }; }),
      dispose: vi.fn(async () => { order.push("dispose"); }),
    };
    const route = {
      fetch: vi.fn(async (options: unknown) => { order.push(`fetch:${JSON.stringify(options)}`); return response; }),
      abort: vi.fn(async () => { order.push("abort"); }),
    };
    await expect(loseCommittedResponse(route as never)).resolves.toEqual({ data: { saleId: "19" } });
    expect(order).toEqual(["fetch:{\"maxRetries\":0}", "json", "dispose", "abort"]);
  });

  it("rejects any replay drift from the frozen request", () => {
    const original = { operationId: "11111111-2222-4333-8444-555555555555", method: "POST", pathname: "/api/v1/sales-receipts", body: '{"note":"same"}', requestFingerprint: "a".repeat(64) };
    expect(() => assertSameFrozenRequest(original, { ...original })).not.toThrow();
    for (const change of [
      { operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      { method: "PUT" },
      { pathname: "/api/v1/sales-receipts/19/draft" },
      { body: '{"note":"changed"}' },
      { requestFingerprint: "b".repeat(64) },
    ]) expect(() => assertSameFrozenRequest(original, { ...original, ...change })).toThrow("WEB6 resend drift");
  });

  it("emits only allowlisted network classes and numeric facts", () => {
    expect(createWeb6NetworkSummary([
      { method: "GET", routeClass: "resend-context", status: 200 },
      { method: "POST", routeClass: "sales-write", status: 200 },
    ])).toEqual([
      { method: "GET", routeClass: "resend-context", status: 200, count: 1 },
      { method: "POST", routeClass: "sales-write", status: 200, count: 1 },
    ]);
    expect(() => createWeb6NetworkSummary([{ method: "GET", routeClass: "https://token@host/private", status: 200 } as never])).toThrow("WEB6 network evidence");
  });
});

import { expect, it, vi } from "vitest";
import { createHttpTransport } from "../../../src/infrastructure/http/httpTransport";
import type { AuthSession } from "../../../src/infrastructure/http/authSession";
function setup() {
  const auth = { getSnapshot: () => ({ status: "authenticated", actorKey: "42", actorGeneration: 1, deploymentEpoch: "11111111-2222-4333-8444-555555555555" }), access: async () => "fixture-token" } as unknown as AuthSession;
  const fetcher = vi.fn<typeof fetch>(async () => new Response('{"data":{}}'));
  return { fetcher, transport: createHttpTransport(auth, fetcher) };
}
const resolutionPath = "/api/v2/operations/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/resolution";
it.each(["/api/v2/operations/context", resolutionPath])("allows only the canonical resolution GET %s", async path => {
  const s = setup(); expect(await s.transport.request(path, { method: "GET", strictResponse: true })).toEqual({});
  expect(s.fetcher).toHaveBeenCalledOnce(); expect(new Headers(s.fetcher.mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer fixture-token");
  expect(s.fetcher.mock.calls[0][1]).toMatchObject({ method: "GET", credentials: "omit", cache: "no-store", redirect: "error" });
});
it.each(["POST", "PUT", "DELETE", "PATCH", "HEAD"])("rejects %s on the v2 surface before fetch", async method => {
  const s = setup(); await expect(s.transport.request(resolutionPath, { method })).rejects.toThrow(); expect(s.fetcher).not.toHaveBeenCalled();
});
it.each(["/api/v2/operations/context/", "/api/v2/operations/context?x=1", "/api/v2/operations/CONTEXT", resolutionPath.toUpperCase(), resolutionPath + "/", resolutionPath + "?x=1", resolutionPath.replace("aaaaaaaa", "%61aaaaaaa"), "/api/v2/sales-receipts", "//evil.example/api/v2/operations/context", "https://evil.example/api/v2/operations/context"])("rejects v2 alias or unrelated route %s", async path => {
  const s = setup(); await expect(s.transport.request(path)).rejects.toThrow(); expect(s.fetcher).not.toHaveBeenCalled();
});
it("preserves existing v1 mutation transport behavior", async () => {
  const s = setup(); await s.transport.request("/api/v1/sales-receipts", { method: "POST", body: "{}" });
  expect(s.fetcher).toHaveBeenCalledOnce(); expect(s.fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", body: "{}" });
});
it.each(["/api/v2/operations/context", resolutionPath])("refuses a v2 GET body before fetch at %s", async path => {
  const s = setup(); await expect(s.transport.request(path, { method: "GET", body: "{}" })).rejects.toThrow(); expect(s.fetcher).not.toHaveBeenCalled();
});

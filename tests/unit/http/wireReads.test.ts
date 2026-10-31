import { describe, expect, it, vi } from "vitest";
import posted from "../../fixtures/web2-v1/sales-get-posted-response.json";
import list from "../../fixtures/web2-v1/sales-list-response.json";
import { createAuthSession } from "../../../src/infrastructure/http/authSession";
import { createHttpTransport } from "../../../src/infrastructure/http/httpTransport";
import { createSalesHttpPort } from "../../../src/infrastructure/http/salesHttpPort";
import { createCatalogHttpPort } from "../../../src/infrastructure/http/catalogHttpPort";

async function setup(read = true) {
  const values = new Map<string, string>();
  const fetcher = vi.fn<typeof fetch>();
  const response = (data: unknown) => new Response(JSON.stringify({ data }));
  const user = { userId: 1, username: "a", displayName: "A" };
  const auth = createAuthSession({ fetch: fetcher, storage: { getItem: k => values.get(k) ?? null, setItem: (k,v) => { values.set(k,v); }, removeItem: k => { values.delete(k); } }, lock: async work => work(), notify: () => {} });
  fetcher.mockResolvedValueOnce(response({ accessToken: `e30.${btoa(JSON.stringify({ sid: "s1", exp: 9999999999 }))}.signature`, expiresAtUtc: "2286-11-20T17:46:39Z", user })).mockResolvedValueOnce(response(user)).mockResolvedValueOnce(response({ read, write: true, post: true }));
  await auth.login("a", "secret"); fetcher.mockClear();
  const transport = createHttpTransport(auth, fetcher);
  const context = { ...auth.getSnapshot(), signal: new AbortController().signal };
  return { auth, fetcher, context, sales: createSalesHttpPort(transport, auth), catalog: createCatalogHttpPort(transport, auth), response };
}
describe("WEB2 Sales/Catalog HTTP read adapters", () => {
  it("sends exact opaque cursor once with pageSize25 and no GET body", async () => {
    const s = await setup(); s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(list)));
    const result = await s.sales.list({ pageSize: 25, cursor: "opaque+/=%value", productId: "104" }, s.context);
    expect(result.kind).toBe("success");
    const [url, init] = s.fetcher.mock.calls[0];
    const query = new URL(String(url), "https://example.test").searchParams;
    expect(query.get("cursor")).toBe("opaque+/=%value");
    expect(query.get("pageSize")).toBe("25"); expect(query.get("productId")).toBe("104");
    expect(init?.body).toBeUndefined(); expect(init?.credentials).toBe("omit");
  });
  it("uses independent catalog authorization even with Sales Read denied", async () => {
    const s = await setup(false);
    s.fetcher.mockResolvedValueOnce(s.response([{ id: 104, code: "SP104", name: "Sản phẩm", isActive: true }]));
    const result = await s.catalog.search({ kind: "product", search: "Sản phẩm", limit: 25 }, s.context);
    expect(result).toEqual({ kind: "success", value: [{ id: "104", code: "SP104", name: "Sản phẩm", isActive: true }] });
    expect(String(s.fetcher.mock.calls[0][0])).toContain("/api/v1/catalog/products/lookup?");
  });
  it("refuses wrong actor before sending and fences changed auth after read", async () => {
    const s = await setup();
    expect((await s.sales.get("9223372036854775807", { ...s.context, actorKey: "2" })).kind).toBe("failed");
    expect(s.fetcher).not.toHaveBeenCalled();
    s.fetcher.mockImplementationOnce(async () => { s.auth.expire(); return new Response(JSON.stringify(posted)); });
    expect((await s.sales.get("9223372036854775807", s.context)).kind).toBe("failed");
  });
  it.each([[403, "forbidden"], [404, "not-found"], [500, "unavailable"]])("classifies HTTP %i and retains correlation/fieldless issues", async (status, kind) => {
    const s = await setup();
    s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "Server.Error", message: "Denied", correlationId: "corr_1", details: [{ code: "Global", message: "Global issue" }] } }), { status }));
    expect(await s.sales.get("1", s.context)).toMatchObject({ kind: "failed", error: { kind, correlationId: "corr_1", issues: [{ field: "", code: "Global" }] } });
    expect(s.fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed success as protocol failure", async () => {
    const s = await setup(); s.fetcher.mockResolvedValueOnce(s.response({ ...posted.data, saleId: 1 }));
    expect(await s.sales.get("1", s.context)).toMatchObject({ kind: "failed", error: { kind: "protocol" } });
  });
  it("rejects detail for a different requested receipt", async () => {
    const s = await setup(); s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify(posted)));
    expect(await s.sales.get("1", s.context)).toMatchObject({ kind: "failed", error: { kind: "protocol" } });
  });
  it.each([0, 201, 1.5])("does not dispatch invalid pageSize %s", async pageSize => {
    const s = await setup();
    expect((await s.sales.list({ pageSize }, s.context)).kind).toBe("failed");
    expect(s.fetcher).not.toHaveBeenCalled();
  });
});

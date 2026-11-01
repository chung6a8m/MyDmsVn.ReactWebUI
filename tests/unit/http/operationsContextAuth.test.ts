import { describe, expect, it, vi } from "vitest";
import contextFixture from "../../fixtures/web4-v1/corpus/context-response.json";
import { ACCESS_TOKEN_KEY, createAuthSession } from "../../../src/infrastructure/http/authSession";

const epoch = contextFixture.data.deploymentEpoch;
const otherEpoch = "7c3baa58-9721-47ee-a1ac-88fc37c06e51";
const user = { userId: 42, username: "owner", displayName: "Owner" };
const jwt = (sid = "session") => `e30.${btoa(JSON.stringify({ sid, exp: 9999999999 }))}.signature`;
const response = (data: unknown) => new Response(JSON.stringify({ data }));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function setup() {
  const bytes = new Map<string, string>();
  const context = vi.fn<() => Promise<Response>>(async () => new Response(JSON.stringify(contextFixture)));
  const capabilities = vi.fn<() => Promise<Response>>(async () => response({ read: true, write: true, post: true }));
  let bearer = jwt();
  const fetcher = vi.fn<typeof fetch>(async path => {
    if (String(path).endsWith("login") || String(path).endsWith("refresh")) return response({ accessToken: bearer, expiresAtUtc: "2286-11-20T17:46:39Z", user });
    if (String(path).endsWith("/me")) return response(user);
    if (String(path) === "/api/v1/operations/context") return context();
    if (String(path).includes("capabilities?feature=")) return capabilities();
    throw Error("Unexpected request");
  });
  const auth = createAuthSession({ fetch: fetcher, storage: { getItem: k => bytes.get(k) ?? null, setItem: (k, v) => { bytes.set(k, v); }, removeItem: k => { bytes.delete(k); } }, lock: async work => work(), notify: () => {} });
  return { auth, bytes, context, capabilities, fetcher, replaceBearer: (value: string) => { bearer = value; } };
}

describe("authenticated database context", () => {
  it("waits for context after me before publishing any authenticated owner or capability", async () => {
    const s = setup(), pending = deferred<Response>();
    s.context.mockReturnValueOnce(pending.promise);
    const login = s.auth.login("owner", "test");
    await vi.waitFor(() => expect(s.fetcher.mock.calls.map(([path]) => path)).toContain("/api/v1/operations/context"));
    expect(s.auth.getSnapshot().status).not.toBe("authenticated");
    expect(s.bytes.size).toBe(0);
    expect(s.capabilities).not.toHaveBeenCalled();
    pending.resolve(new Response(JSON.stringify(contextFixture))); await login;
    expect(s.auth.getSnapshot()).toMatchObject({ status: "authenticated", actorKey: "42", deploymentEpoch: epoch });
    expect(s.fetcher.mock.calls.map(([path]) => path)).toEqual(["/api/v1/auth/login", "/api/v1/auth/me", "/api/v1/operations/context", "/api/v1/auth/capabilities?feature=sales"]);
    expect(s.fetcher.mock.calls[2][1]).toMatchObject({ credentials: "omit", cache: "no-store", redirect: "error", headers: { Authorization: `Bearer ${jwt()}` } });
    expect([...s.bytes.keys()]).toEqual([ACCESS_TOKEN_KEY]);
  });

  it.each([
    ["wrong actor", { ...contextFixture.data, actorUserId: 43 }],
    ["string actor", { ...contextFixture.data, actorUserId: "42" }],
    ["zero actor", { ...contextFixture.data, actorUserId: 0 }],
    ["overflow actor", { ...contextFixture.data, actorUserId: 2147483648 }],
    ["uppercase epoch", { ...contextFixture.data, deploymentEpoch: otherEpoch.toUpperCase() }],
    ["nil epoch", { ...contextFixture.data, deploymentEpoch: "00000000-0000-0000-0000-000000000000" }],
    ["missing epoch", { actorUserId: 42, contractVersion: "web4-v1" }],
    ["extra field", { ...contextFixture.data, sid: "session" }],
    ["wrong contract", { ...contextFixture.data, contractVersion: "web4-v2" }],
  ])("fails closed for %s", async (_name, data) => {
    const s = setup(); s.context.mockResolvedValueOnce(response(data));
    await expect(s.auth.login("owner", "test")).rejects.toThrow();
    expect(s.auth.getSnapshot().status).toBe("reauth-required");
    expect(s.auth.getSnapshot().capabilities.write).toBe(false);
    expect(s.bytes.size).toBe(0);
    await expect(s.auth.access()).rejects.toThrow();
  });

  it.each([
    '{"data":{},"data":' + JSON.stringify(contextFixture.data) + '}',
    JSON.stringify({ ...contextFixture, extra: true }),
    JSON.stringify(contextFixture).replace('"actorUserId":42', '"actorUserId":4.2e1'),
  ])("rejects ambiguous or noncanonical context JSON %s", async raw => {
    const s = setup(); s.context.mockResolvedValueOnce(new Response(raw));
    await expect(s.auth.login("owner", "test")).rejects.toThrow();
    expect(s.auth.getSnapshot().status).not.toBe("authenticated");
  });

  it.each([201, 202, 206])("rejects a context success with unexpected HTTP %i", async status => {
    const s = setup(); s.context.mockResolvedValueOnce(new Response(JSON.stringify(contextFixture), { status }));
    await expect(s.auth.login("owner", "test")).rejects.toThrow();
    expect(s.auth.getSnapshot().status).not.toBe("authenticated");
  });

  it("invalidates the old generation and module grants before waiting for capabilities on a new database", async () => {
    const s = setup(); await s.auth.login("owner", "test"); await s.auth.loadFeatureCapabilities("goods-receipt");
    const before = s.auth.getSnapshot(), caps = deferred<Response>();
    s.context.mockResolvedValueOnce(response({ ...contextFixture.data, deploymentEpoch: otherEpoch }));
    s.capabilities.mockReturnValueOnce(caps.promise);
    const refresh = s.auth.refresh();
    await vi.waitFor(() => expect(s.auth.getSnapshot().actorGeneration).toBeGreaterThan(before.actorGeneration));
    expect(s.auth.getSnapshot().status).not.toBe("authenticated");
    expect(s.auth.getSnapshot().features["goods-receipt"].write).toBe(false);
    caps.resolve(response({ read: true, write: false, post: false })); await refresh;
    expect(s.auth.getSnapshot()).toMatchObject({ status: "authenticated", deploymentEpoch: otherEpoch, actorKey: "42" });
    expect(s.auth.getSnapshot().features["goods-receipt"].write).toBe(false);
  });

  it("context failure on same-session refresh removes the old owner's authority", async () => {
    const s = setup(); await s.auth.login("owner", "test");
    s.context.mockRejectedValueOnce(Error("unavailable"));
    await expect(s.auth.refresh()).rejects.toThrow();
    expect(s.auth.getSnapshot().status).toBe("reauth-required");
    expect(s.auth.getSnapshot().deploymentEpoch).toBeUndefined();
    expect(s.bytes.size).toBe(0);
  });

  it("clears an invalid bootstrap bearer when its context cannot be established", async () => {
    const s = setup(); s.bytes.set(ACCESS_TOKEN_KEY, jwt());
    s.context.mockRejectedValueOnce(Error("unavailable"));
    await s.auth.bootstrap();
    expect(s.auth.getSnapshot().status).toBe("reauth-required");
    expect(s.bytes.size).toBe(0);
  });

  it("times out a hung context request without publishing authentication", async () => {
    const s = setup(); vi.useFakeTimers();
    try {
      s.context.mockImplementationOnce(() => new Promise<Response>(() => {}));
      const result = s.auth.login("owner", "test").then(() => null, error => error);
      await vi.advanceTimersByTimeAsync(15000);
      expect(await result).toBeInstanceOf(Error);
      expect(s.auth.getSnapshot().status).toBe("reauth-required");
      expect(s.bytes.size).toBe(0);
      expect(s.capabilities).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("never publishes a context response after replacement login", async () => {
    const s = setup(), pending = deferred<Response>();
    s.context.mockReturnValueOnce(pending.promise);
    const first = s.auth.login("owner", "test");
    await vi.waitFor(() => expect(s.context).toHaveBeenCalledTimes(1));
    s.replaceBearer(jwt("replacement")); await s.auth.login("owner", "test");
    const replacement = s.auth.getSnapshot();
    pending.resolve(response({ ...contextFixture.data, deploymentEpoch: otherEpoch })); await first;
    expect(s.auth.getSnapshot()).toBe(replacement);
    expect(s.bytes.get(ACCESS_TOKEN_KEY)).toBe(jwt("replacement"));
  });

  it("never publishes context after shared token replacement or expiry", async () => {
    const s = setup(), pending = deferred<Response>();
    s.context.mockReturnValueOnce(pending.promise);
    const first = s.auth.login("owner", "test");
    await vi.waitFor(() => expect(s.context).toHaveBeenCalledTimes(1));
    s.bytes.set(ACCESS_TOKEN_KEY, jwt("other-tab")); s.auth.expire(false);
    pending.resolve(new Response(JSON.stringify(contextFixture))); await first;
    expect(s.auth.getSnapshot().status).not.toBe("authenticated");
    expect(s.bytes.get(ACCESS_TOKEN_KEY)).toBe(jwt("other-tab"));
  });
});

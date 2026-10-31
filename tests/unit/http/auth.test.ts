import { describe, it, expect, vi } from "vitest";
import { createAuthSession } from "../../../src/infrastructure/http/authSession";
import { createHttpTransport } from "../../../src/infrastructure/http/httpTransport";
import { readData } from "../../../src/infrastructure/http/authApi";

const jwt = (sid = "s1", exp = 9999999999) => `e30.${btoa(JSON.stringify({ sid, exp }))}.signature`;
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
function setup(lock: <T>(work: () => Promise<T>) => Promise<T> = async work => work()) {
  const storage = new Map<string, string>();
  const fetcher = vi.fn<typeof fetch>();
  const auth = createAuthSession({ fetch: fetcher, storage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => { storage.set(k,v); }, removeItem: k => { storage.delete(k); } }, lock, notify: () => {} });
  const user = { userId: 1, username: "a", displayName: "A" };
  const queueLogin = (sid = "s1") => {
    fetcher.mockResolvedValueOnce(response({ accessToken: jwt(sid), expiresAtUtc: "2286-11-20T17:46:39Z", user })).mockResolvedValueOnce(response(user)).mockResolvedValueOnce(response({ read: true, write: true, post: false }));
  };
  return { auth, fetcher, storage, queueLogin, user };
}
describe("HTTP auth lifecycle", () => {
  it.each([1, 2])("queued shared refresh hides old owner before deferred me for actor %i", async userId => {
    let waitForLock: Promise<void> | undefined;
    const s = setup(async work => { await waitForLock; return work(); });
    s.queueLogin(); await s.auth.login("a", "secret");
    const original = s.auth.getSnapshot();
    let finishBusiness!: (value: Response) => void;
    s.fetcher.mockImplementationOnce(() => new Promise(resolve => { finishBusiness = resolve; }));
    const business = createHttpTransport(s.auth, s.fetcher).request("/api/v1/sales-receipts").then(value => value, error => error);
    await vi.waitFor(() => expect(finishBusiness).toBeTypeOf("function"));
    let release!: () => void;
    waitForLock = new Promise(resolve => { release = resolve; });
    const refreshing = s.auth.refresh();
    const newer = jwt("foreign");
    s.storage.set("mydmsvn.access.v1", newer);
    let finishMe!: (value: Response) => void;
    s.fetcher.mockImplementationOnce(() => new Promise(resolve => { finishMe = resolve; }));
    s.fetcher.mockResolvedValueOnce(response({ read: true, write: true, post: false }));
    release();
    await vi.waitFor(() => expect(finishMe).toBeTypeOf("function"));
    const blocked = s.auth.getSnapshot();
    finishBusiness(response({ old: true }));
    const oldResult = await business;
    const access = await s.auth.access().then(value => value, error => error);
    finishMe(response({ ...s.user, userId })); await refreshing;
    expect(blocked.status).toBe("reauth-required");
    expect(blocked.capabilities.write).toBe(false);
    expect(blocked.actorGeneration).toBeGreaterThan(original.actorGeneration);
    expect(oldResult).toBeInstanceOf(Error);
    expect(access).toBeInstanceOf(Error);
    expect(s.auth.getSnapshot()).toMatchObject({ status: "authenticated", actorKey: String(userId) });
  });

  it("refresh response with foreign sid invalidates before authoritative waits", async () => {
    const s = setup(); s.queueLogin(); await s.auth.login("a", "secret");
    const generation = s.auth.getSnapshot().actorGeneration;
    s.fetcher.mockResolvedValueOnce(response({ accessToken: jwt("foreign-response"), expiresAtUtc: "2286-11-20T17:46:39Z", user: s.user }));
    let finish!: (value: Response) => void;
    s.fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    s.fetcher.mockResolvedValueOnce(response({ read: true, write: true, post: false }));
    const pending = s.auth.refresh();
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    const blocked = s.auth.getSnapshot();
    finish(response(s.user)); await pending;
    expect(blocked.status).toBe("reauth-required");
    expect(blocked.actorGeneration).toBeGreaterThan(generation);
  });
  it("failed foreign shared adoption keeps the newer shared bearer and old scope blocked", async () => {
    let waitForLock: Promise<void> | undefined;
    const s = setup(async work => { await waitForLock; return work(); });
    s.queueLogin(); await s.auth.login("a", "secret");
    let release!: () => void;
    waitForLock = new Promise(resolve => { release = resolve; });
    const pending = s.auth.refresh().then(() => null, error => error);
    const newer = jwt("foreign-shared");
    s.storage.set("mydmsvn.access.v1", newer);
    s.fetcher.mockRejectedValueOnce(Error("me offline"));
    release();
    expect(await pending).toBeInstanceOf(Error);
    expect(s.auth.getSnapshot().status).toBe("reauth-required");
    expect(s.storage.get("mydmsvn.access.v1")).toBe(newer);
    await expect(s.auth.access()).rejects.toThrow("Authentication required");
  });
  it("stale foreign refresh response cannot invalidate a replacement login", async () => {
    const s = setup(); s.queueLogin(); await s.auth.login("a", "secret");
    let finish!: (value: Response) => void;
    s.fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = s.auth.refresh();
    s.queueLogin("replacement"); await s.auth.login("a", "secret");
    const replacement = s.auth.getSnapshot();
    finish(response({ accessToken: jwt("stale-foreign"), expiresAtUtc: "2286-11-20T17:46:39Z", user: s.user }));
    await pending;
    expect(s.auth.getSnapshot()).toBe(replacement);
    expect(s.storage.get("mydmsvn.access.v1")).toBe(jwt("replacement"));
  });
  it("hung refresh expires authentication within its deadline", async () => {
    const s = setup(); s.queueLogin(); await s.auth.login("a", "secret");
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | null | undefined;
      s.fetcher.mockImplementationOnce((_path, init) => { signal = init?.signal; return new Promise<Response>(() => {}); });
      const result = s.auth.refresh().then(() => null, error => error);
      await vi.advanceTimersByTimeAsync(15000);
      expect(await result).toBeInstanceOf(Error);
      expect(signal?.aborted).toBe(true);
      expect(s.auth.getSnapshot().status).toBe("reauth-required");
      expect(s.storage.size).toBe(0);
      expect(s.fetcher).toHaveBeenCalledTimes(4);
    } finally { vi.useRealTimers(); }
  });
  it("authorizes from me, fences same-user new sessions and respects logout Cancel", async () => {
    const s = setup(); s.queueLogin(); await s.auth.login("a", "secret");
    const first = s.auth.getSnapshot();
    expect(first.capabilities.write).toBe(true);
    expect(await s.auth.logout(async () => false)).toBe(false);
    expect(s.fetcher).toHaveBeenCalledTimes(3);
    s.queueLogin("s2"); await s.auth.login("a", "secret");
    expect(s.auth.getSnapshot().actorGeneration).toBeGreaterThan(first.actorGeneration);
    expect(s.storage.size).toBe(1);
  });
  it("does not replay writes and omits cookies on business calls", async () => {
    const s = setup(); s.queueLogin(); await s.auth.login("a", "secret");
    const transport = createHttpTransport(s.auth, s.fetcher);
    s.fetcher.mockResolvedValueOnce(response(null, 401));
    await expect(transport.request("/api/v1/sales-receipts", { method: "POST", body: "{}" })).rejects.toMatchObject({ status: 401 });
    expect(s.fetcher).toHaveBeenCalledTimes(4);
    expect(s.fetcher.mock.calls[3][1]).toMatchObject({ credentials: "omit" });
    expect(s.auth.getSnapshot().status).toBe("reauth-required");
  });
  it("ignores login returning after forced expiry", async () => {
    const s = setup(); let finish!: (r: Response) => void;
    s.fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = s.auth.login("a", "secret"); s.auth.expire();
    finish(response({ accessToken: jwt(), expiresAtUtc: "2286-11-20T17:46:39Z", user: s.user }));
    await pending;
    expect(s.storage.size).toBe(0);
    expect(s.auth.getSnapshot().status).toBe("reauth-required");
  });
  it("refreshes once for safe reads and never refreshes forbidden reads", async () => {
    const s = setup(); s.queueLogin(); await s.auth.login("a", "secret");
    const transport = createHttpTransport(s.auth, s.fetcher);
    s.fetcher.mockResolvedValueOnce(response(null, 401)); s.queueLogin();
    s.fetcher.mockResolvedValueOnce(response({ ok: true }));
    await expect(transport.request("/api/v1/sales-receipts")).resolves.toEqual({ ok: true });
    expect(s.fetcher).toHaveBeenCalledTimes(8);
    s.fetcher.mockResolvedValueOnce(response(null, 403));
    await expect(transport.request("/api/v1/sales-receipts")).rejects.toMatchObject({ status: 403 });
    expect(s.fetcher).toHaveBeenCalledTimes(9);
  });
  it("shares a refresh flight and preserves generation for the same sid", async () => {
    const s = setup(); s.queueLogin(); await s.auth.login("a", "secret");
    const generation = s.auth.getSnapshot().actorGeneration;
    s.queueLogin(); await Promise.all([s.auth.refresh(), s.auth.refresh()]);
    expect(s.fetcher).toHaveBeenCalledTimes(6);
    expect(s.auth.getSnapshot().actorGeneration).toBe(generation);
  });
  it("does not revoke a replacement session after slow close admission", async () => {
    const s = setup(); s.queueLogin(); await s.auth.login("a", "secret");
    let allow!: (value: boolean) => void;
    const logout = s.auth.logout(() => new Promise(resolve => { allow = resolve; }));
    s.queueLogin("s2"); await s.auth.login("a", "secret"); allow(true);
    expect(await logout).toBe(false);
    expect(s.fetcher).toHaveBeenCalledTimes(6);
    expect(s.auth.getSnapshot().status).toBe("authenticated");
  });
  it("uses browser guard headers without setting Origin or passing Bearer to refresh", async () => {
    const s = setup(); s.queueLogin(); await s.auth.login("a", "secret");
    expect(s.fetcher.mock.calls[0][1]).toMatchObject({ credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" } });
    const headers = new Headers(s.fetcher.mock.calls[0][1]?.headers);
    expect(headers.has("Origin")).toBe(false); expect(headers.has("Authorization")).toBe(false);
  });
  it("serializes two tabs and reuses the published bearer instead of consuming refresh twice", async () => {
    const values = new Map<string, string>();
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string,v: string) => { values.set(k,v); }, removeItem: (k: string) => { values.delete(k); } };
    let tail: Promise<unknown> = Promise.resolve();
    const lock = <T,>(work: () => Promise<T>) => { const next = tail.then(work); tail = next.catch(() => {}); return next; };
    const user = { userId: 1, username: "a", displayName: "A" };
    let rotations = 0;
    const fetcher = vi.fn<typeof fetch>(async path => {
      if (String(path).endsWith("refresh")) { rotations++; return response({ accessToken: jwt() + rotations, expiresAtUtc: "2286-11-20T17:46:39Z", user }); }
      return response(String(path).endsWith("me") ? user : { read: true, write: false, post: false });
    });
    const options = { fetch: fetcher, storage, lock, notify: () => {} };
    const a = createAuthSession(options); const b = createAuthSession(options);
    await Promise.all([a.refresh(), b.refresh()]);
    expect(rotations).toBe(1);
    expect(a.getSnapshot().actorKey).toBe("1"); expect(b.getSnapshot().actorKey).toBe("1");
  });
  it("fences a business body arriving after the actor was expired", async () => {
    const s = setup(); s.queueLogin(); await s.auth.login("a", "secret");
    let finish!: (value: string) => void;
    const body = new Promise<string>(resolve => { finish = resolve; });
    s.fetcher.mockResolvedValueOnce({ ok: true, status: 200, text: () => body } as Response);
    const pending = createHttpTransport(s.auth, s.fetcher).request("/api/v1/sales-receipts");
    await vi.waitFor(() => expect(s.fetcher).toHaveBeenCalledTimes(4));
    s.auth.expire(); finish('{"data":{"private":"old-owner"}}');
    await expect(pending).rejects.toThrow("Stale actor");
  });
  it("rejects conflicting success envelopes and keeps status for non-JSON failure", async () => {
    await expect(readData(new Response('{"data":{},"error":{}}'))).rejects.toThrow("hợp đồng");
    await expect(readData(new Response("<html>forbidden</html>", { status: 403 }))).rejects.toMatchObject({ status: 403 });
  });
  it("immediately blocks the old owner while verifying a replacement session", async () => {
    const s = setup(); s.queueLogin(); await s.auth.login("a", "secret");
    const generation = s.auth.getSnapshot().actorGeneration;
    s.storage.set("mydmsvn.access.v1", jwt("replacement"));
    let finish!: (value: Response) => void;
    s.fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    s.fetcher.mockResolvedValueOnce(response({ read: true, write: true, post: false }));
    const pending = s.auth.sync();
    expect(s.auth.getSnapshot().status).toBe("reauth-required");
    expect(s.auth.getSnapshot().capabilities.write).toBe(false);
    await expect(s.auth.access()).rejects.toThrow("Authentication required");
    finish(response(s.user)); await pending;
    expect(s.auth.getSnapshot().actorGeneration).toBeGreaterThan(generation);
    expect(s.auth.getSnapshot().status).toBe("authenticated");
  });
  it("does not clear shared bearer before login acquires the cookie-change lock", async () => {
    const values = new Map<string, string>([["mydmsvn.access.v1", jwt()]]);
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const fetcher = vi.fn<typeof fetch>();
    const user = { userId: 1, username: "a", displayName: "A" };
    fetcher.mockResolvedValueOnce(response({ accessToken: jwt("new-login"), expiresAtUtc: "2286-11-20T17:46:39Z", user })).mockResolvedValueOnce(response(user)).mockResolvedValueOnce(response({ read: true, write: false, post: false }));
    const auth = createAuthSession({ fetch: fetcher, storage: { getItem: k => values.get(k) ?? null, setItem: (k,v) => { values.set(k,v); }, removeItem: k => { values.delete(k); } }, lock: async work => { await held; return work(); }, notify: () => {} });
    const pending = auth.login("a", "secret");
    expect(values.get("mydmsvn.access.v1")).toBe(jwt());
    expect(fetcher).not.toHaveBeenCalled();
    // Another tab finishes the refresh that held the lock. Its notification
    // must not cancel the explicit login queued behind that rotation.
    values.set("mydmsvn.access.v1", jwt() + "rotated");
    await auth.sync();
    release(); await pending;
    expect(values.get("mydmsvn.access.v1")).toBe(jwt("new-login"));
  });
});

import type { RuntimeAuthSnapshot } from "../../app/runtime/runtimeDependencies";
import { capabilitiesSchema, createAuthApi, tokenSchema, userSchema } from "./authApi";
export const ACCESS_TOKEN_KEY = "mydmsvn.access.v1";
const denied = { read: false, write: false, post: false };
export interface AuthSnapshot extends RuntimeAuthSnapshot {
  status: "bootstrapping" | "authenticated" | "reauth-required" | "unauthenticated";
  displayName?: string;
  expiresAt?: number;
}
interface Options {
  fetch: typeof fetch;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  lock: <T>(work: () => Promise<T>) => Promise<T>;
  notify: () => void;
}
// Claims only guide expiry/session partitioning; me and capabilities remain authoritative.
function hints(token: string) {
  const value = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { sid?: unknown; exp?: unknown };
  if (typeof value.sid !== "string" || !value.sid || typeof value.exp !== "number") throw new Error("Invalid token metadata");
  return { sid: value.sid, expires: value.exp * 1000 };
}
export function createAuthSession(options: Options) {
  const api = createAuthApi(options.fetch);
  let snapshot: AuthSnapshot = { status: "bootstrapping", actorKey: "", actorGeneration: 0, capabilities: denied };
  let epoch = 0;
  let sid = "";
  let token: string | null = null;
  let flight: Promise<void> | undefined;
  let bootstrapFlight: Promise<void> | undefined;
  let loginIntent: number | undefined;
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach(listener => listener());
  function expire(clear = true) {
    epoch++; token = null; sid = "";
    if (clear) { options.storage.removeItem(ACCESS_TOKEN_KEY); options.notify(); }
    snapshot = { status: "reauth-required", actorKey: "", actorGeneration: snapshot.actorGeneration + 1, capabilities: denied }; publish();
  }
  async function adopt(raw: string, capture: number, expected = options.storage.getItem(ACCESS_TOKEN_KEY)) {
    // A stale adoption must never invalidate a newer owner. A newly observed
    // sid must hide the old owner before any authoritative network wait.
    if (capture !== epoch || options.storage.getItem(ACCESS_TOKEN_KEY) !== expected) return;
    const metadata = hints(raw);
    if (sid && metadata.sid !== sid) { expire(false); capture = epoch; }
    const user = userSchema.parse(await api.read("me", raw));
    const capabilities = capabilitiesSchema.parse(await api.read("capabilities?feature=sales", raw));
    if (capture !== epoch || options.storage.getItem(ACCESS_TOKEN_KEY) !== expected) return;
    const changed = sid !== metadata.sid || snapshot.actorKey !== String(user.userId);
    token = raw; sid = metadata.sid;
    options.storage.setItem(ACCESS_TOKEN_KEY, raw);
    snapshot = { status: "authenticated", actorKey: String(user.userId), actorGeneration: snapshot.actorGeneration + (changed ? 1 : 0), capabilities, displayName: user.displayName, expiresAt: metadata.expires }; publish(); options.notify();
  }
  async function refresh() {
    if (flight) return flight;
    const capture = epoch;
    const previous = options.storage.getItem(ACCESS_TOKEN_KEY);
    flight = options.lock(async () => {
      if (capture !== epoch) return;
      const shared = options.storage.getItem(ACCESS_TOKEN_KEY);
      if (shared && shared !== previous && hints(shared).expires > Date.now() + 30000) { await adopt(shared, capture); return; }
      const result = tokenSchema.parse(await api.change("refresh"));
      if (capture !== epoch) return;
      await adopt(result.accessToken, capture);
    }).catch(error => { if (capture === epoch && options.storage.getItem(ACCESS_TOKEN_KEY) === previous) expire(); throw error; }).finally(() => { flight = undefined; });
    return flight;
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    expire,
    async login(username: string, password: string) {
      expire(false); const capture = epoch;
      loginIntent = capture;
      try { await options.lock(async () => {
        if (capture !== epoch) return;
        // Shared storage belongs to the same cookie-change critical section.
        // A queued explicit login takes precedence over preceding refresh publication.
        options.storage.removeItem(ACCESS_TOKEN_KEY); options.notify();
        const result = await api.change("login", { username, password });
        if (capture !== epoch) return;
        await adopt(tokenSchema.parse(result).accessToken, capture, null);
      }); } finally { if (loginIntent === capture) loginIntent = undefined; }
    },
    bootstrap() {
      return bootstrapFlight ??= (async () => {
        const capture = epoch;
        try {
          const raw = options.storage.getItem(ACCESS_TOKEN_KEY);
          if (raw && hints(raw).expires > Date.now() + 30000) await adopt(raw, capture);
          else await refresh();
        } catch { if (capture === epoch) expire(); }
      })();
    },
    refresh,
    async access() {
      if (snapshot.status !== "authenticated" || !token) throw new Error("Authentication required");
      if (hints(token).expires <= Date.now() + 30000) await refresh();
      if (!token || snapshot.status !== "authenticated") throw new Error("Authentication required");
      return token;
    },
    async sync() {
      if (loginIntent !== undefined) return;
      const raw = options.storage.getItem(ACCESS_TOKEN_KEY);
      if (raw === token) return;
      if (!raw) { expire(false); return; }
      const capture = ++epoch;
      try { await adopt(raw, capture); }
      catch { if (capture === epoch) expire(options.storage.getItem(ACCESS_TOKEN_KEY) === raw); }
    },
    async logout(admit: () => Promise<boolean>) {
      const capture = epoch;
      const expected = options.storage.getItem(ACCESS_TOKEN_KEY);
      if (!await admit()) return false;
      if (capture !== epoch || options.storage.getItem(ACCESS_TOKEN_KEY) !== expected) return false;
      try { await options.lock(async () => {
        if (capture !== epoch || options.storage.getItem(ACCESS_TOKEN_KEY) !== expected) return;
        await api.change("logout");
        if (capture === epoch && options.storage.getItem(ACCESS_TOKEN_KEY) === expected) expire();
      }); }
      finally { if (capture === epoch && options.storage.getItem(ACCESS_TOKEN_KEY) === expected) expire(); }
      return true;
    },
  };
}
export type AuthSession = ReturnType<typeof createAuthSession>;

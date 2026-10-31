import { createAuthSession } from "../../infrastructure/http/authSession";
let singleton: ReturnType<typeof createAuthSession> | undefined;
export function getBrowserAuth() {
  if (singleton) return singleton;
  const channel = typeof BroadcastChannel === "undefined" ? undefined : new BroadcastChannel("mydmsvn.auth.v1");
  const session = createAuthSession({
    fetch: window.fetch.bind(window), storage: window.localStorage,
    lock: async work => {
      if (!navigator.locks) throw new Error("Trình duyệt cần hỗ trợ Web Locks.");
      return navigator.locks.request("mydmsvn.auth.v1", work);
    },
    notify: () => channel?.postMessage({ type: "auth-changed" }),
  });
  const sync = () => { void session.sync(); };
  channel?.addEventListener("message", sync);
  window.addEventListener("storage", sync);
  window.addEventListener("focus", sync);
  let timer: ReturnType<typeof setTimeout> | undefined;
  session.subscribe(() => {
    clearTimeout(timer);
    const snapshot = session.getSnapshot();
    if (snapshot.status === "authenticated" && snapshot.expiresAt) {
      timer = setTimeout(() => { void session.access().catch(() => {}); }, Math.min(2147483647, Math.max(0, snapshot.expiresAt - Date.now() - 29000)));
    }
  });
  singleton = session;
  return session;
}

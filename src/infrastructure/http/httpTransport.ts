import { HttpError, readData } from "./authApi";
import type { AuthSession } from "./authSession";
export function createHttpTransport(auth: AuthSession, fetcher: typeof fetch = fetch) {
  return {
    async request(path: string, init: RequestInit = {}): Promise<unknown> {
      if (!path.startsWith("/api/v1/") || path.startsWith("//")) throw new Error("Same-origin API required");
      const scope = auth.getSnapshot();
      const same = () => { const current = auth.getSnapshot(); return current.status === "authenticated" && current.actorKey === scope.actorKey && current.actorGeneration === scope.actorGeneration; };
      const method = (init.method ?? "GET").toUpperCase();
      const safe = method === "GET" || method === "HEAD";
      async function send() {
        const access = await auth.access();
        if (!same()) throw new Error("Stale actor");
        const headers = new Headers(init.headers); headers.set("Authorization", `Bearer ${access}`);
        if (init.body) headers.set("Content-Type", "application/json");
        const response = await fetcher(path, { ...init, method, headers, credentials: "omit", cache: "no-store", redirect: "error" });
        if (!same()) throw new Error("Stale actor");
        if (response.status === 401) throw new HttpError(401, null);
        const data = await readData(response);
        if (!same()) throw new Error("Stale actor");
        return data;
      }
      try { return await send(); } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 401 || !same()) throw error;
        if (!safe) { auth.expire(); throw error; }
        await auth.refresh();
        if (!same()) throw new Error("Stale actor");
        try { return await send(); } catch (retryError) {
          if (retryError instanceof HttpError && retryError.status === 401 && same()) auth.expire();
          throw retryError;
        }
      }
    },
  };
}

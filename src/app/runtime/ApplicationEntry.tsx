import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import type { AuthSession } from "../../infrastructure/http/authSession";
import type { WorkspaceRuntime } from "../workspace/panelRegistry";
import { WorkspaceProvider } from "../workspace/WorkspaceContext";
import { getBrowserAuth } from "./browserAuth";
import { createProductionRuntime } from "./createProductionRuntime";
export interface ProtectedRuntime { workspace: WorkspaceRuntime; content: ReactNode; }
const registry = new WeakMap<AuthSession, Map<number, ProtectedRuntime>>();
function runtimesFor(auth: AuthSession) {
  let retained = registry.get(auth);
  if (!retained) {
    retained = new Map(); registry.set(auth, retained);
    const contexts = retained;
    window.addEventListener("beforeunload", event => {
      const unsafe = [...contexts.values()].some(({ workspace }) => Object.values(workspace.store.getState().sessions).some(session => session.dirty || session.preparing || session.mutation !== "idle"));
      if (unsafe) { event.preventDefault(); event.returnValue = ""; }
    });
  }
  return retained;
}
export function ApplicationEntry({ auth = getBrowserAuth(), createRuntime = createProductionRuntime }: {
  auth?: AuthSession;
  createRuntime?: (auth: AuthSession) => ProtectedRuntime;
}) {
  const snapshot = useSyncExternalStore(auth.subscribe, auth.getSnapshot);
  const retained = runtimesFor(auth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void auth.bootstrap(); }, [auth]);
  let runtime = retained.get(snapshot.actorGeneration);
  if (snapshot.status === "authenticated" && !runtime && createRuntime) {
    runtime = createRuntime(auth); retained.set(snapshot.actorGeneration, runtime);
  }
  async function logout() {
    setBusy(true); setError("");
    try { await auth.logout(async () => !runtime || await runtime.workspace.close.closeAll("close-all") === "closed"); }
    catch { setError("Không xác nhận được đăng xuất trên máy chủ. Cần đăng nhập lại."); }
    finally { setBusy(false); }
  }
  if (snapshot.status === "bootstrapping") return <p className="p-4" role="status">Đang xác thực phiên…</p>;
  if (snapshot.status === "authenticated") {
    const content = <><div className="flex items-center gap-4 p-4"><span>{snapshot.displayName}</span><Button disabled={busy} onClick={() => { void logout(); }}>Đăng xuất</Button></div>{error && <p role="alert">{error}</p>}{runtime?.content ?? <p className="p-4">Ứng dụng chưa được kết nối dữ liệu Sales.</p>}</>;
    return runtime ? <WorkspaceProvider key={snapshot.actorGeneration} workspace={runtime.workspace}>{content}</WorkspaceProvider> : content;
  }
  return <section className="mx-auto max-w-sm space-y-4 p-6" aria-label="Đăng nhập">
    <h2 className="text-lg font-semibold">Đăng nhập MyDmsVn</h2>
    {snapshot.status === "reauth-required" && <p>Phiên đã khóa. Đăng nhập lại để bắt đầu phiên mới; tài liệu cũ được giữ riêng trong bộ nhớ.</p>}
    <form className="space-y-4" onSubmit={event => {
      event.preventDefault(); if (busy) return; setBusy(true); setError("");
      const secret = password; setPassword("");
      void auth.login(username, secret).catch(() => setError("Không thể đăng nhập. Kiểm tra thông tin và kết nối.")).finally(() => setBusy(false));
    }}>
      <label className="block space-y-2">Tên đăng nhập<Input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required /></label>
      <label className="block space-y-2">Mật khẩu<Input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
      <Button type="submit" disabled={busy}>Đăng nhập</Button>
      {error && <p role="alert">{error}</p>}
    </form>
  </section>;
}

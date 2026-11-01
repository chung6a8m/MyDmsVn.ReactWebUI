import { expect, it, vi } from "vitest";
import { createReceiptCapabilityLoading } from "../../../src/app/runtime/receiptCapabilityLoading";
import type { AuthSession, AuthSnapshot } from "../../../src/infrastructure/http/authSession";
import { deniedModuleCapabilities } from "../../../src/app/runtime/moduleCapabilities";

function fixture() {
  let snapshot: AuthSnapshot = { status: "authenticated", actorKey: "a", actorGeneration: 1, capabilities: { read: true, write: true, post: true }, features: deniedModuleCapabilities() };
  const listeners = new Set<() => void>();
  const pending: ((result: boolean) => void)[] = [];
  const publish = (next: AuthSnapshot) => { snapshot = next; listeners.forEach(fn => fn()); };
  const load = vi.fn(() => { publish({ ...snapshot, features: deniedModuleCapabilities() }); return new Promise<boolean>(resolve => pending.push(resolve)); });
  const auth = { getSnapshot: () => snapshot, subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); }, loadFeatureCapabilities: load } as unknown as AuthSession;
  return { auth, load, pending, publish, listeners };
}
it("initial restore waits for feature settlement and own grant publications do not reload", async () => {
  const f = fixture(), loading = createReceiptCapabilityLoading(f.auth);
  const disconnect = loading.connect();
  expect(f.load).toHaveBeenCalledTimes(1);
  expect(loading.state.getState().initialSettled).toBe(false);
  f.pending[0](true); await Promise.resolve();
  expect(loading.state.getState().initialSettled).toBe(true);
  f.publish({ ...f.auth.getSnapshot(), features: { ...deniedModuleCapabilities(), "goods-receipt": { read: true, write: true, post: true } } });
  expect(f.load).toHaveBeenCalledTimes(1);
  disconnect(); expect(f.listeners.size).toBe(0);
});
it("same-token authoritative refresh reloads grants without unmounting settled workspace", async () => {
  const f = fixture(), loading = createReceiptCapabilityLoading(f.auth);
  const disconnect = loading.connect();
  f.pending[0](true); await Promise.resolve();
  f.publish({ ...f.auth.getSnapshot(), capabilities: { ...f.auth.getSnapshot().capabilities } });
  expect(f.load).toHaveBeenCalledTimes(2);
  expect(loading.state.getState().initialSettled).toBe(true);
  disconnect();
});
it("stale actor settlement cannot admit the first layout; denial still settles", async () => {
  const f = fixture(), loading = createReceiptCapabilityLoading(f.auth);
  const disconnect = loading.connect();
  f.publish({ ...f.auth.getSnapshot(), actorKey: "b", actorGeneration: 2, capabilities: { read: false, write: false, post: false } });
  f.pending[0](true); await Promise.resolve();
  expect(loading.state.getState().initialSettled).toBe(false);
  f.pending[1](false); await Promise.resolve();
  expect(loading.state.getState().initialSettled).toBe(true);
  disconnect();
});

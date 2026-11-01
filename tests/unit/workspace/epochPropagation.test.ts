import { expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createStore } from "zustand/vanilla";
import { capabilitiesForModule } from "../../../src/app/runtime/moduleCapabilities";
import { createWorkspaceRuntime } from "../../../src/app/workspace/panelRegistry";
import { readBoundary } from "../../../src/infrastructure/http/readBoundary";
import { createHttpTransport } from "../../../src/infrastructure/http/httpTransport";
import type { AuthSession, AuthSnapshot } from "../../../src/infrastructure/http/authSession";
import { createLookupSearch, lookupRequestKey } from "../../../src/shared/lookup/lookupSearch";
import { inventoryKeys } from "../../../src/features/inventory/inventoryQueries";
import { observeInventoryPosts } from "../../../src/features/inventory/inventoryInvalidation";
import { injectedRuntimeFixture } from "./injectedRuntimeFixture";

const firstEpoch = "11111111-2222-4333-8444-555555555555";
const nextEpoch = "7c3baa58-9721-47ee-a1ac-88fc37c06e51";
const scope = { actorKey: "42", actorGeneration: 7, deploymentEpoch: firstEpoch };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function authFixture() {
  let snapshot: Extract<AuthSnapshot, { status: "authenticated" }> = { ...scope, status: "authenticated", capabilities: { read: true, write: true, post: true }, features: { sales: { read: true, write: true, post: true }, "goods-receipt": { read: false, write: false, post: false }, "inventory-balances": { read: false }, "inventory-stock-card": { read: false } } };
  const auth = { getSnapshot: () => snapshot, access: async () => "unit-token", expire: vi.fn(), refresh: vi.fn() } as unknown as AuthSession;
  return { auth, replaceEpoch() { snapshot = { ...snapshot, deploymentEpoch: nextEpoch }; } };
}

it("does not lend module capabilities to a same-actor scope from another database or without an epoch", () => {
  const snapshot = { ...scope, capabilities: { read: true, write: true, post: true } };
  expect(capabilitiesForModule(snapshot, scope, "sales").write).toBe(true);
  expect(capabilitiesForModule(snapshot, { ...scope, deploymentEpoch: nextEpoch }, "sales").write).toBe(false);
  expect(capabilitiesForModule(snapshot, { actorKey: scope.actorKey, actorGeneration: scope.actorGeneration }, "sales").write).toBe(false);
});

it("captures epoch on runtime scopes and simple panel ownership", async () => {
  const fixture = injectedRuntimeFixture();
  fixture.publish({ ...fixture.auth.getSnapshot(), deploymentEpoch: firstEpoch });
  const runtime = createWorkspaceRuntime(fixture.dependencies);
  expect(runtime.portContext().deploymentEpoch).toBe(firstEpoch);
  const panel = await runtime.openPanel("sales");
  expect(runtime.panelState.getState().panels[panel]?.deploymentEpoch).toBe(firstEpoch);
  const oldScope = runtime.portContext();
  fixture.publish({ ...fixture.auth.getSnapshot(), deploymentEpoch: nextEpoch });
  expect(runtime.isCurrentScope(oldScope)).toBe(false);
  expect(await runtime.openPanel("sales")).toBe("");
  runtime.dispose();
});

it("partitions lookup results and forwards the captured database to its catalog port", async () => {
  const lookupScope = { ...scope, sessionId: "s", generation: 1, clientLineId: "line", catalogContext: "sales" };
  expect(lookupRequestKey(lookupScope, "cà phê")).not.toBe(lookupRequestKey({ ...lookupScope, deploymentEpoch: nextEpoch }, "cà phê"));
  const search = vi.fn(async () => ({ kind: "success" as const, value: [] }));
  await createLookupSearch({ search }).search(lookupScope, "cà phê");
  expect(search).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ deploymentEpoch: firstEpoch }));
});

it.each(["balances", "stock-card"])("isolates cached %s data when only the database changes", kind => {
  const query = { pageNumber: 1, pageSize: 25, warehouseId: "1", productId: "2" };
  const key = (epoch: string) => kind === "balances" ? inventoryKeys.balances({ ...scope, deploymentEpoch: epoch }, query) : inventoryKeys.stockCard({ ...scope, deploymentEpoch: epoch }, query);
  const client = new QueryClient();
  client.setQueryData(key(firstEpoch), "private stock from former database");
  expect(client.getQueryData(key(nextEpoch))).toBeUndefined();
  client.clear();
});

it("invalidates only stock cached in the confirmed Post database", () => {
  const client = new QueryClient(), query = { pageNumber: 1, pageSize: 25, warehouseId: "1", productId: "2" };
  const first = inventoryKeys.balances(scope, query), next = inventoryKeys.balances({ ...scope, deploymentEpoch: nextEpoch }, query);
  const session = { ...scope, generation: 1, baseline: { status: "Draft", saved: { warehouseId: "1", lines: [{ productId: "2" }] } }, postAcknowledgement: undefined as unknown };
  const store = createStore(() => ({ sessions: { s: session } }));
  client.setQueryData(first, "first"); client.setQueryData(next, "next");
  const dispose = observeInventoryPosts(client, store, () => true);
  store.setState({ sessions: { s: { ...session, postAcknowledgement: {} } } });
  expect(client.getQueryState(first)?.isInvalidated).toBe(true);
  expect(client.getQueryState(next)?.isInvalidated).toBe(false);
  dispose(); client.clear();
});

it("does not treat a new-database session as a positive Post transition from the previous owner", () => {
  const client = new QueryClient(), query = { pageNumber: 1, pageSize: 25 };
  const key = inventoryKeys.balances({ ...scope, deploymentEpoch: nextEpoch }, query);
  const session = { ...scope, generation: 1, baseline: { status: "Draft", saved: { warehouseId: "1", lines: [{ productId: "2" }] } }, postAcknowledgement: undefined as unknown };
  const store = createStore(() => ({ sessions: { s: session } }));
  client.setQueryData(key, "next");
  const dispose = observeInventoryPosts(client, store, () => true);
  store.setState({ sessions: { s: { ...session, deploymentEpoch: nextEpoch, postAcknowledgement: {} } } });
  expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  dispose(); client.clear();
});

it("rejects foreign epoch reads before dispatch and after an awaited response", async () => {
  const f = authFixture(), work = vi.fn(async () => "private");
  expect(await readBoundary(f.auth, { ...scope, deploymentEpoch: nextEpoch, signal: new AbortController().signal }, work)).toMatchObject({ kind: "failed", error: { code: "Auth.StaleActor" } });
  expect(work).not.toHaveBeenCalled();
  const pending = deferred<string>();
  const read = readBoundary(f.auth, { ...scope, signal: new AbortController().signal }, () => pending.promise);
  f.replaceEpoch(); pending.resolve("private");
  expect(await read).toMatchObject({ kind: "failed", error: { code: "Auth.StaleActor" } });
});

it("rejects HTTP response body completion after same-actor epoch replacement", async () => {
  const f = authFixture(), body = deferred<string>();
  const fetcher = vi.fn<typeof fetch>(async () => ({ ok: true, status: 200, text: () => body.promise }) as Response);
  const pending = createHttpTransport(f.auth, fetcher).request("/api/v1/sales-receipts");
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  f.replaceEpoch(); body.resolve('{"data":"private"}');
  await expect(pending).rejects.toThrow("Stale actor");
});

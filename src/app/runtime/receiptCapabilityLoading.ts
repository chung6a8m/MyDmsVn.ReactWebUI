import { createStore } from "zustand/vanilla";
import type { AuthSession } from "../../infrastructure/http/authSession";
import { sameActorScope } from "../workspace/documentContracts";
export function createReceiptCapabilityLoading(auth: AuthSession) {
  const state = createStore(() => ({ initialSettled: false }));
  let evidence: ReturnType<AuthSession["getSnapshot"]> | undefined;
  let revision = 0;
  function observe() {
    const snapshot = auth.getSnapshot();
    if (snapshot.status !== "authenticated") { evidence = undefined; revision++; state.setState({ initialSettled: false }); return; }
    const sameOwner = evidence !== undefined && sameActorScope(evidence, snapshot);
    if (sameOwner && evidence?.capabilities === snapshot.capabilities) return;
    // Adoption replaces Sales evidence even when bearer bytes are unchanged;
    // our feature grant publications retain that reference.
    evidence = snapshot;
    if (!sameOwner) state.setState({ initialSettled: false });
    const current = ++revision;
    const settle = () => {
      const owner = auth.getSnapshot();
      if (current === revision && owner.status === "authenticated" && sameActorScope(owner, snapshot))
        state.setState({ initialSettled: true });
    };
    void Promise.allSettled((["goods-receipt", "inventory-balances", "inventory-stock-card"] as const).map(module => auth.loadFeatureCapabilities(module))).then(settle);
  }
  return { state, connect() { const unsubscribe = auth.subscribe(observe); observe(); return unsubscribe; } };
}

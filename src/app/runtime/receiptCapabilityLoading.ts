import { createStore } from "zustand/vanilla";
import type { AuthSession } from "../../infrastructure/http/authSession";
export function createReceiptCapabilityLoading(auth: AuthSession) {
  const state = createStore(() => ({ initialSettled: false }));
  let evidence: ReturnType<AuthSession["getSnapshot"]>["capabilities"] | undefined;
  let revision = 0;
  function observe() {
    const snapshot = auth.getSnapshot();
    if (snapshot.status !== "authenticated") { evidence = undefined; revision++; return; }
    if (evidence === snapshot.capabilities) return;
    // Adoption replaces Sales evidence even when bearer bytes are unchanged;
    // our feature grant publications retain that reference.
    evidence = snapshot.capabilities;
    const current = ++revision;
    const settle = () => {
      const owner = auth.getSnapshot();
      if (current === revision && owner.status === "authenticated" && owner.actorKey === snapshot.actorKey && owner.actorGeneration === snapshot.actorGeneration)
        state.setState({ initialSettled: true });
    };
    void auth.loadFeatureCapabilities("goods-receipt").then(settle, settle);
  }
  return { state, connect() { const unsubscribe = auth.subscribe(observe); observe(); return unsubscribe; } };
}

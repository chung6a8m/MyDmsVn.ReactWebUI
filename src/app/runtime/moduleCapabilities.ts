import type { RuntimeAuthSnapshot, SalesCapabilities } from "./runtimeDependencies";
import { sameActorScope, type ActorScope, type ModuleKey } from "../workspace/documentContracts";

export interface ModuleCapabilities {
  readonly sales: SalesCapabilities;
  readonly "goods-receipt": SalesCapabilities;
  readonly "inventory-balances": { readonly read: boolean };
  readonly "inventory-stock-card": { readonly read: boolean };
}

// Internal module identity is deliberately separate from the frozen HTTP name.
export const capabilityFeatureNames = {
  sales: "sales",
  "goods-receipt": "goods-receipts",
  "inventory-balances": "inventory-balances",
  "inventory-stock-card": "inventory-stock-card",
} as const satisfies Record<ModuleKey, string>;

export function deniedModuleCapabilities(): ModuleCapabilities {
  return {
    sales: { read: false, write: false, post: false },
    "goods-receipt": { read: false, write: false, post: false },
    "inventory-balances": { read: false },
    "inventory-stock-card": { read: false },
  };
}

export function capabilitiesForModule(
  snapshot: RuntimeAuthSnapshot,
  scope: ActorScope,
  module: string,
): SalesCapabilities {
  const denied = { read: false, write: false, post: false };
  if (!scope.actorKey || !sameActorScope(snapshot, scope) ||
      !Object.hasOwn(capabilityFeatureNames, module)) return denied;
  const key = module as keyof ModuleCapabilities;
  const grants = snapshot.features
    ? Object.hasOwn(snapshot.features, key) ? snapshot.features[key] : undefined
    : key === "sales" ? snapshot.capabilities : undefined;
  const writable = key === "sales" || key === "goods-receipt";
  return {
    read: grants?.read === true,
    write: writable && !!grants && "write" in grants && grants.write === true,
    post: writable && !!grants && "post" in grants && grants.post === true,
  };
}

export function hasModuleCapability(
  snapshot: RuntimeAuthSnapshot,
  scope: ActorScope,
  module: string,
  action: keyof SalesCapabilities,
): boolean {
  return capabilitiesForModule(snapshot, scope, module)[action] === true;
}

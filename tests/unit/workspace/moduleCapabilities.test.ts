import { describe, expect, it } from "vitest";
import { capabilitiesForModule, hasModuleCapability } from "../../../src/app/runtime/moduleCapabilities";
import type { RuntimeAuthSnapshot } from "../../../src/app/runtime/runtimeDependencies";

const scope = { actorKey: "11", actorGeneration: 4 };
const snapshot: RuntimeAuthSnapshot = {
  ...scope,
  capabilities: { read: true, write: true, post: true },
  features: {
    sales: { read: false, write: false, post: false },
    "goods-receipt": { read: false, write: true, post: true },
    "inventory-balances": { read: true },
    "inventory-stock-card": { read: false },
  },
};

describe("module capability boundaries", () => {
  it("uses each feature independently, including Receipt Write without Read", () => {
    expect(hasModuleCapability(snapshot, scope, "sales", "write")).toBe(false);
    expect(hasModuleCapability(snapshot, scope, "goods-receipt", "read")).toBe(false);
    expect(hasModuleCapability(snapshot, scope, "goods-receipt", "write")).toBe(true);
    expect(hasModuleCapability(snapshot, scope, "goods-receipt", "post")).toBe(true);
    expect(hasModuleCapability(snapshot, scope, "inventory-balances", "read")).toBe(true);
    expect(hasModuleCapability(snapshot, scope, "inventory-stock-card", "read")).toBe(false);
  });

  it.each([
    { actorKey: "22", actorGeneration: 4 },
    { actorKey: "11", actorGeneration: 5 },
  ])("denies grants for a different actor or auth generation: %j", previousScope => {
    expect(capabilitiesForModule(snapshot, previousScope, "goods-receipt")).toEqual({ read: false, write: false, post: false });
  });

  it("denies missing, unknown, and inherited module entries", () => {
    const incomplete = { ...snapshot, features: { sales: snapshot.capabilities } };
    expect(hasModuleCapability(incomplete, scope, "goods-receipt", "write")).toBe(false);
    expect(hasModuleCapability(snapshot, scope, "goods-receipts", "write")).toBe(false);
    expect(hasModuleCapability(snapshot, scope, "__proto__", "read")).toBe(false);
    const inherited = { ...snapshot, features: Object.create({ "goods-receipt": { read: true, write: true, post: true } }) };
    expect(hasModuleCapability(inherited, scope, "goods-receipt", "write")).toBe(false);
  });

  it("keeps legacy Sales readers compatible without granting any other feature", () => {
    const legacy: RuntimeAuthSnapshot = { ...scope, capabilities: { read: true, write: true, post: false } };
    expect(capabilitiesForModule(legacy, scope, "sales")).toEqual({ read: true, write: true, post: false });
    expect(capabilitiesForModule(legacy, scope, "goods-receipt")).toEqual({ read: false, write: false, post: false });
    expect(hasModuleCapability(legacy, scope, "inventory-balances", "read")).toBe(false);
  });

  it("never exposes inventory write or post even when a malformed reader includes them", () => {
    const malformed = { ...snapshot, features: { "inventory-balances": { read: true, write: true, post: true } } };
    expect(capabilitiesForModule(malformed, scope, "inventory-balances")).toEqual({ read: true, write: false, post: false });
  });

  it("denies empty actor ownership even if an injected reader supplies true hints", () => {
    const empty = { ...snapshot, actorKey: "" };
    expect(hasModuleCapability(empty, empty, "goods-receipt", "write")).toBe(false);
  });
});

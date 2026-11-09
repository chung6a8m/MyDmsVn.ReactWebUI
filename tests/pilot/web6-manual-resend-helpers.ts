import type { Route } from "@playwright/test";

export type Web6OperationKind = "Sales.Create" | "Sales.Update" | "Sales.Post" | "Receipt.Create" | "Receipt.Update" | "Receipt.Post";
export type Web6ManualScenario = {
  feature: "sales" | "goods-receipt";
  command: "create" | "update" | "post";
  operationKind: Web6OperationKind;
  method: "POST" | "PUT";
};

export const web6ManualScenarios: readonly Web6ManualScenario[] = [
  { feature: "sales", command: "create", operationKind: "Sales.Create", method: "POST" },
  { feature: "sales", command: "update", operationKind: "Sales.Update", method: "PUT" },
  { feature: "sales", command: "post", operationKind: "Sales.Post", method: "POST" },
  { feature: "goods-receipt", command: "create", operationKind: "Receipt.Create", method: "POST" },
  { feature: "goods-receipt", command: "update", operationKind: "Receipt.Update", method: "PUT" },
  { feature: "goods-receipt", command: "post", operationKind: "Receipt.Post", method: "POST" },
] as const;

// This cut deliberately never calls route.fetch: cancelling a browser request
// is evidence only of the selected pre-observation cut, not rollback proof.
export async function abortBeforeObservation(route: Pick<Route, "abort" | "fetch">) {
  await route.abort("failed");
}

// This cut is the opposite boundary: retain the real host's committed 200,
// then hide that response from the page. No success is fabricated.
export async function loseCommittedResponse(route: Pick<Route, "fetch" | "abort">): Promise<unknown> {
  const response = await route.fetch({ maxRetries: 0 });
  if (response.status() !== 200) {
    await response.dispose();
    throw Error("WEB6 committed-response cut requires a real 200.");
  }
  const wire = await response.json();
  await response.dispose();
  await route.abort("failed");
  return wire;
}

export type FrozenRequestEvidence = {
  operationId: string;
  operationKind: Web6OperationKind;
  deploymentEpoch: string;
  method: string;
  pathname: string;
  body: string;
  requestFingerprint: string;
};

export function assertSameFrozenRequest(original: FrozenRequestEvidence, replay: FrozenRequestEvidence) {
  if (original.operationId !== replay.operationId || original.operationKind !== replay.operationKind || original.deploymentEpoch !== replay.deploymentEpoch ||
      original.method !== replay.method || original.pathname !== replay.pathname ||
      original.body !== replay.body || original.requestFingerprint !== replay.requestFingerprint) {
    throw Error("WEB6 resend drift from the original frozen request.");
  }
}

const routeClasses = new Set([
  "resend-context", "resend-receipt", "resend-eligibility",
  "sales-write", "receipt-write", "operation-resolution",
]);
const methods = new Set(["GET", "POST", "PUT"]);
export type Web6NetworkEvent = { method: "GET" | "POST" | "PUT"; routeClass: string; status: number };
export type Web6NetworkSummary = Web6NetworkEvent & { count: number };

export function createWeb6NetworkSummary(events: readonly Web6NetworkEvent[]): Web6NetworkSummary[] {
  const counts = new Map<string, Web6NetworkSummary>();
  for (const event of events) {
    if (!methods.has(event.method) || !routeClasses.has(event.routeClass) || !Number.isSafeInteger(event.status) || event.status < 0 || event.status > 599) {
      throw Error("Invalid WEB6 network evidence.");
    }
    const key = `${event.method}:${event.routeClass}:${event.status}`;
    const current = counts.get(key);
    if (current) current.count++;
    else counts.set(key, { ...event, count: 1 });
  }
  return [...counts.values()];
}

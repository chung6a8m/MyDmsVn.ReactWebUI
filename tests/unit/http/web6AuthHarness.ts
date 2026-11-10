import contextFixture from "../../fixtures/web4-v1/corpus/context-response.json";
import intent from "../../fixtures/web4-v1/corpus/sales-create-intent.json";
import { createAuthSession } from "../../../src/infrastructure/http/authSession";
import { createHttpTransport } from "../../../src/infrastructure/http/httpTransport";
import { createWeb6ResendEligibilityPort } from "../../../src/infrastructure/http/web6ResendEligibilityPort";
import { freezeWeb4Operation } from "../../../src/infrastructure/http/web4OperationCodec";

export type AuthBoundary = "candidateMismatchOn" | "eligibility401" | "eligibility500" | "refresh-success" | "refresh-repeated-401";
type HarnessRequest = { url: () => string; method: () => string };
export async function web6AuthHarness(boundary: AuthBoundary, options: {
  expiresInMs?: number;
  beforeResponse?: (path: string) => Promise<void>;
  onRequest?: (path: string, method: string, request: HarnessRequest) => void;
  onResponse?: (path: string, method: string, status: number, request: HarnessRequest) => void;
} = {}) {
  const deploymentEpoch = contextFixture.data.deploymentEpoch;
  const operation = await freezeWeb4Operation(intent, { deploymentEpoch, actorKey: "42", operationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
  const user = { userId: 42, username: "fixture", displayName: "Fixture" };
  const accessToken = `e30.${btoa(JSON.stringify({ sid: "fixture-session", exp: options.expiresInMs === undefined ? 9999999999 : Math.floor((Date.now() + options.expiresInMs) / 1000) }))}.signature`;
  const storage = new Map<string, string>(), requests: { path: string; method: string }[] = [];
  const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
  let eligibilityCalls = 0;
  const respond: typeof fetch = async (input, init) => {
    const path = String(input); requests.push({ path, method: init?.method ?? "GET" });
    if (path === "/api/v1/auth/refresh" && boundary === "eligibility401") return response(null, 401);
    if (path === "/api/v1/auth/login" || path === "/api/v1/auth/refresh") return response({ accessToken, expiresAtUtc: "2286-11-20T17:46:39Z", user });
    if (path === "/api/v1/auth/me") return response(user);
    if (path === "/api/v1/operations/context") return response({ ...contextFixture.data, actorUserId: 42 });
    if (path.startsWith("/api/v1/auth/capabilities?")) return response({ read: true, write: true, post: true });
    if (path === "/api/v3/operations/resend-context") return boundary === "eligibility401" ? response(null, 401) : response({
      contractVersion: "web6-resend-eligibility-v1", candidateId: boundary === "candidateMismatchOn" ? "different-candidate" : "candidate-a",
      deploymentEpoch, actorUserId: 42, serverUtc: "2026-11-10T00:00:00.0000000Z", maximumEligibilitySeconds: 604800, eligibilityEnabled: true,
    });
    if (path.endsWith("/resend-eligibility")) {
      eligibilityCalls++;
      if (boundary === "eligibility500") return response(null, 500);
      if (boundary === "refresh-repeated-401" || boundary === "refresh-success" && eligibilityCalls === 1) return response(null, 401);
      return response({ contractVersion: "web6-resend-eligibility-v1", candidateId: "candidate-a", deploymentEpoch, actorUserId: 42,
        operationId: operation.operationId, operationKind: operation.request.operationKind, method: operation.request.method,
        routeScope: operation.request.routeScope, requestTargetId: null, requestFingerprint: operation.requestFingerprint,
        decision: "ALLOW", reason: "ORIGINAL_NOT_OBSERVED_RECEIPT_VALID", serverUtc: "2026-11-10T00:00:00.0000000Z", eligibleUntilUtc: "2026-11-17T00:00:00.0000000Z" });
    }
    throw Error("Unexpected fixture request");
  };
  const fetcher: typeof fetch = async (input, init) => {
    const path = String(input), method = init?.method ?? "GET";
    const request = { url: () => `https://fixture.invalid${path}`, method: () => method };
    options.onRequest?.(path, method, request);
    await options.beforeResponse?.(path);
    const result = await respond(input, init);
    options.onResponse?.(path, method, result.status, request);
    return result;
  };
  const auth = createAuthSession({ fetch: fetcher, storage: { getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); }, removeItem: key => { storage.delete(key); } }, lock: async work => work(), notify: () => {} });
  await auth.login("fixture", "fixture-secret");
  await auth.bootstrap();
  requests.length = 0;
  const snapshot = auth.getSnapshot();
  const context = { actorKey: snapshot.actorKey, actorGeneration: snapshot.actorGeneration, deploymentEpoch, signal: new AbortController().signal };
  const port = createWeb6ResendEligibilityPort(createHttpTransport(auth, fetcher), auth, "candidate-a");
  return { auth, storage, requests, operation, context, fetcher,
    async prepare() { await port.readContext(context); return port.readEligibility(operation, "fixture-receipt", context); } };
}

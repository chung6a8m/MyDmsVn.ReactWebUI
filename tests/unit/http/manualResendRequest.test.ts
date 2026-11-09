import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { manualResendRequest } from "../../../src/infrastructure/http/manualResendRequest";
import { freezeWeb4Operation, web4OperationPath } from "../../../src/infrastructure/http/web4OperationCodec";
import type { AuthSession, AuthSnapshot } from "../../../src/infrastructure/http/authSession";
import type { HttpTransport } from "../../../src/infrastructure/http/readBoundary";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/web4-v1/corpus/${name}.json`, import.meta.url), "utf8"));
const stems = ["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"];
const identity = { operationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", deploymentEpoch: "11111111-2222-4333-8444-555555555555", actorKey: "42" };
function auth() { const snapshot = { status: "authenticated", actorKey: "42", actorGeneration: 1, deploymentEpoch: identity.deploymentEpoch } as AuthSnapshot;
  return { getSnapshot: () => snapshot } as unknown as AuthSession; }

it.each(stems)("sends exact persisted %s bytes, path and original key once", async stem => {
  const operation = await freezeWeb4Operation(fixture(`${stem}-intent`), identity), dispatched = vi.fn();
  const request = vi.fn<HttpTransport["request"]>(async (_path, _init, onDispatch) => { onDispatch?.(); return fixture(`${stem}-response`).data; });
  const context = { actorKey: "42", actorGeneration: 1, deploymentEpoch: identity.deploymentEpoch, signal: new AbortController().signal };
  const result = await manualResendRequest({ request }, auth(), context, operation, dispatched);
  expect(result).toMatchObject({ kind: "committed", operationKind: operation.request.operationKind });
  expect(request).toHaveBeenCalledOnce(); expect(dispatched).toHaveBeenCalledOnce();
  const [path, init] = request.mock.calls[0];
  expect(path).toBe(web4OperationPath(operation.request));
  expect(init).toMatchObject({ method: operation.request.method, body: JSON.stringify(operation.request.body), strictResponse: true, expectedStatus: 200 });
  const headers = new Headers(init?.headers);
  expect(headers.get("Idempotency-Key")).toBe(identity.operationId); expect(headers.get("X-MyDmsVn-Deployment-Epoch")).toBe(identity.deploymentEpoch);
});

it("rehashes before dispatch and never replaces a corrupt original with a new UUID", async () => {
  const operation = await freezeWeb4Operation(fixture("sales-create-intent"), identity), request = vi.fn<HttpTransport["request"]>();
  await expect(manualResendRequest({ request }, auth(), { actorKey: "42", actorGeneration: 1, deploymentEpoch: identity.deploymentEpoch, signal: new AbortController().signal },
    { ...operation, requestFingerprint: "0".repeat(64) }, vi.fn())).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});

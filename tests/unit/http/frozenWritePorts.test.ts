import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import type { AuthSession } from "../../../src/infrastructure/http/authSession";
import { createSalesHttpPort } from "../../../src/infrastructure/http/salesHttpPort";
import { createGoodsReceiptHttpPort } from "../../../src/infrastructure/http/goodsReceiptHttpPort";
import { createHttpTransport } from "../../../src/infrastructure/http/httpTransport";
import { mapSalesDetail } from "../../../src/infrastructure/http/salesWireMapper";
import { mapGoodsReceiptDetail } from "../../../src/infrastructure/http/goodsReceiptWireMapper";
import { salesDetailSchema } from "../../../src/infrastructure/http/salesWireSchemas";
import { receiptDetailSchema } from "../../../src/infrastructure/http/goodsReceiptWireSchemas";
import { freezeWeb4Operation, type FrozenWeb4Operation, type Web4WireIntent } from "../../../src/infrastructure/http/web4OperationCodec";
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/web4-v1/corpus/${name}.json`, import.meta.url), "utf8"));
const epoch = fixture("context-response").data.deploymentEpoch as string;
const identity = { actorKey: "42", deploymentEpoch: epoch, operationId: "11111111-2222-4333-8444-555555555555" };
async function setup(stem: string, status = 200) {
  const intent = fixture(`${stem}-intent`) as Web4WireIntent;
  const response = fixture(`${stem}-response`);
  const operation = await freezeWeb4Operation(intent, identity);
  let scope = { status: "authenticated", actorKey: "42", actorGeneration: 1, deploymentEpoch: epoch };
  const auth = { getSnapshot: () => scope, access: async () => "test-token", expire: vi.fn() } as unknown as AuthSession;
  const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(response), { status }));
  const transport = createHttpTransport(auth, fetcher);
  const context = { ...scope, signal: new AbortController().signal };
  const sales = stem.startsWith("sales");
  const snapshot = sales ? mapSalesDetail(salesDetailSchema.parse(response.data)).saved : mapGoodsReceiptDetail(receiptDetailSchema.parse(response.data)).saved;
  if ("saleId" in snapshot) {
    snapshot.saleId = intent.requestTargetId; snapshot.expectedVersion = "expectedVersion" in intent.body ? intent.body.expectedVersion : null;
    if (intent.operationKind === "Sales.Create" || intent.operationKind === "Sales.Update") {
      const lines = intent.body.lines;
      snapshot.lines.forEach((line, index) => { line.saleLineId = lines[index].saleLineId === "0" ? null : lines[index].saleLineId; });
    }
  } else { snapshot.receiptId = intent.requestTargetId; snapshot.expectedVersion = "expectedVersion" in intent.body ? intent.body.expectedVersion : null; }
  const invoke = (frozen: FrozenWeb4Operation = operation) => "saleId" in snapshot
    ? createSalesHttpPort(transport, auth, { operation: frozen }).save(snapshot, context)
    : createGoodsReceiptHttpPort(transport, auth, { operation: frozen }).save(snapshot, context);
  return { intent, operation, fetcher, snapshot, invoke, response, context, auth, transport, shift: () => { scope = { ...scope, actorGeneration: 2 }; } };
}
it.each(["sales-create", "sales-update", "receipt-create", "receipt-update"])("dispatches exact frozen %s with server context and original outcome", async stem => {
  const s = await setup(stem);
  expect((await s.invoke()).kind).toBe("success");
  expect(s.fetcher).toHaveBeenCalledOnce();
  const [path, init] = s.fetcher.mock.calls[0];
  expect(path).toBe(s.intent.routeScope.replace("{saleId}", s.intent.requestTargetId ?? "").replace("{receiptId}", s.intent.requestTargetId ?? ""));
  expect(init?.method).toBe(s.intent.method); expect(init?.body).toBe(JSON.stringify(s.operation.request.body));
  expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(identity.operationId);
  expect(new Headers(init?.headers).get("X-MyDmsVn-Deployment-Epoch")).toBe(epoch);
  expect(init).not.toHaveProperty("expectedStatus"); expect(init).not.toHaveProperty("strictResponse");
});
it("reports a strict direct rejection only after actual dispatch under the same scope", async () => {
  const s = await setup("sales-create"); const onRejected = vi.fn();
  s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "ValidationError", message: "Rejected", details: [] } }), { status: 400 }));
  if (!("saleId" in s.snapshot)) throw Error("fixture");
  const port = createSalesHttpPort(s.transport, s.auth, { operation: s.operation, onRejected });
  expect((await port.save(s.snapshot, s.context)).kind).toBe("failed");
  expect(onRejected).toHaveBeenCalledWith({ operationKind: "Sales.Create", httpStatus: 400, code: "ValidationError" });
  onRejected.mockClear();
  s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "Idempotency.KeyConflict", message: "Rejected", details: [] } }), { status: 409 }));
  await port.save(s.snapshot, s.context); expect(onRejected).not.toHaveBeenCalled();
  s.shift(); await port.save(s.snapshot, s.context); expect(onRejected).not.toHaveBeenCalled(); expect(s.fetcher).toHaveBeenCalledTimes(2);
});
it.each(["sales-post", "receipt-post"])("dispatches frozen %s exactly once", async stem => {
  const intent = fixture(`${stem}-intent`) as Web4WireIntent;
  const operation = await freezeWeb4Operation(intent, identity);
  const auth = { getSnapshot: () => ({ status: "authenticated", actorKey: "42", actorGeneration: 1, deploymentEpoch: epoch }), access: async () => "test-token" } as unknown as AuthSession;
  const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(fixture(`${stem}-response`))));
  const transport = createHttpTransport(auth, fetcher); const context = { ...identity, actorGeneration: 1, signal: new AbortController().signal };
  const expectedVersion = (intent.body as { expectedVersion: string }).expectedVersion;
  const result = stem === "sales-post" ? await createSalesHttpPort(transport, auth, { operation }).post({ saleId: intent.requestTargetId!, expectedVersion }, context)
    : await createGoodsReceiptHttpPort(transport, auth, { operation }).post({ receiptId: intent.requestTargetId!, expectedVersion }, context);
  expect(result).toEqual({ kind: "success", value: fixture(`${stem}-response`).data }); expect(fetcher).toHaveBeenCalledOnce();
  expect(new Headers(fetcher.mock.calls[0][1]?.headers).get("Idempotency-Key")).toBe(identity.operationId);
});
it.each(["fingerprint", "actor", "epoch", "payload"])("rejects %s before dispatch", async fault => {
  const s = await setup("sales-create"); const frozen = structuredClone(s.operation);
  const altered = fault === "fingerprint" ? { ...frozen, requestFingerprint: "0".repeat(64) } : fault === "actor" ? { ...frozen, actorKey: "43" } : fault === "epoch" ? { ...frozen, deploymentEpoch: "22222222-2222-4333-8444-555555555555" } : frozen;
  if (fault === "payload") s.snapshot.note = "changed after freezing";
  expect(await s.invoke(altered)).toMatchObject({ kind: "failed", dispatched: false }); expect(s.fetcher).not.toHaveBeenCalled();
});
it.each([201, 202, 206])("rejects wrong success HTTP %i without retry", async status => {
  const s = await setup("sales-create", status);
  expect(await s.invoke()).toEqual({ kind: "outcome-unknown" }); expect(s.fetcher).toHaveBeenCalledOnce();
});
it("rejects later detail projection despite a syntactically valid sales detail", async () => {
  const s = await setup("sales-create"); s.response.data.customerIsActive = false;
  expect(await s.invoke()).toEqual({ kind: "outcome-unknown" }); expect(s.fetcher).toHaveBeenCalledOnce();
});
it.each(["valid", "invalid", "stale"])("only exposes strict original wire proof to committed hook for %s result", async fault => {
  const s = await setup("sales-create"); const onCommitted = vi.fn();
  if (fault === "invalid") s.response.data.customerIsActive = false;
  if (fault === "stale") s.fetcher.mockImplementation(async () => { s.shift(); return new Response(JSON.stringify(s.response)); });
  if (!("saleId" in s.snapshot)) throw new Error("Sales fixture required");
  const result = await createSalesHttpPort(s.transport, s.auth, { operation: s.operation, onCommitted }).save(s.snapshot, s.context);
  if (fault === "valid") {
    expect(result.kind).toBe("success");
    expect(onCommitted).toHaveBeenCalledExactlyOnceWith({ kind: "committed", operationKind: "Sales.Create", value: s.response.data });
  } else { expect(result.kind).toBe("outcome-unknown"); expect(onCommitted).not.toHaveBeenCalled(); }
});

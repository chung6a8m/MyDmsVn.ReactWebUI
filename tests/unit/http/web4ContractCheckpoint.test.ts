import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import provenance from "../../fixtures/web4-v1/provenance.json";
import manifest from "../../fixtures/web4-v1/corpus/manifest.json";
import vectors from "../../fixtures/web4-v1/corpus/fingerprint-vectors.json";
import { HttpError, readData } from "../../../src/infrastructure/http/authApi";
import type { AuthSession } from "../../../src/infrastructure/http/authSession";
import { mapReadFailure, type HttpTransport } from "../../../src/infrastructure/http/readBoundary";
import { createSalesHttpPort } from "../../../src/infrastructure/http/salesHttpPort";
import { createGoodsReceiptHttpPort } from "../../../src/infrastructure/http/goodsReceiptHttpPort";
import { salesDetailSchema, postAcknowledgementSchema } from "../../../src/infrastructure/http/salesWireSchemas";
import { receiptDetailSchema, receiptPostAcknowledgementSchema } from "../../../src/infrastructure/http/goodsReceiptWireSchemas";
import { mapSalesDetail, mapSaveInput } from "../../../src/infrastructure/http/salesWireMapper";
import { mapGoodsReceiptDetail, mapGoodsReceiptSaveInput } from "../../../src/infrastructure/http/goodsReceiptWireMapper";
import { web3ErrorEnvelopeSchema } from "../../../src/infrastructure/http/web3WireSchemas";

const corpus = new URL("../../fixtures/web4-v1/corpus/", import.meta.url);
const stems = ["sales-create", "sales-update", "sales-post", "receipt-create", "receipt-update", "receipt-post"] as const;
const fixture = <T = unknown>(name: string): T => JSON.parse(readFileSync(new URL(name, corpus), "utf8")) as T;
interface Intent { operationKind: string; method: string; routeScope: string; requestTargetId: string | null; body: Record<string, unknown> }
interface Status { data: { operationId: string; deploymentEpoch: string; requestFingerprint: string; requestTargetId: string | null; state: string; outcome: unknown } }
interface Oracle {
  canonicalizeRequest(intent: unknown): string;
  fingerprintRequest(intent: unknown): string;
  validateRequest(intent: unknown): boolean;
  validateOutcome(kind: string, payload: unknown): boolean;
  validateContext(payload: unknown): boolean;
  validateStatus(payload: unknown, intent: unknown, identity: { operationId: string; deploymentEpoch: string }): boolean;
  validateHeaders(pairs: string[][], mode: "write" | "status", expected: { deploymentEpoch: string; requestFingerprint?: string }): boolean;
}
// Import the unmodified backend oracle through a dynamic path. A declaration
// inside its strict, hash-pinned directory would change the authoritative mirror.
let oracle: Oracle;
beforeAll(async () => { const path = fileURLToPath(new URL("validate-corpus.mjs", corpus)); oracle = await import(/* @vite-ignore */ path) as Oracle; });
const identity = (status: Status) => ({ operationId: status.data.operationId, deploymentEpoch: status.data.deploymentEpoch });

describe("WEB4 F01 pinned contract compatibility (no runtime status settlement)", () => {
  it("checks every mirrored Git blob and executes the complete backend corpus oracle", () => {
    expect(readdirSync(corpus).sort()).toEqual(provenance.files.map(file => file.file).sort());
    for (const file of provenance.files) expect(createHash("sha256").update(readFileSync(new URL(file.file, corpus))).digest("hex"), file.file).toBe(file.sha256);
    expect(createHash("sha256").update(readFileSync(new URL("manifest.json", corpus))).digest("hex")).toBe(provenance.manifestSha256);
    expect(manifest.sourceBaseline).toBe(provenance.sourceBaseline);
    const result = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL("validate-corpus.mjs", corpus)), fileURLToPath(corpus)], { encoding: "utf8" }));
    expect(result).toMatchObject({ fixtures: manifest.fixtures.length, protectedStatuses: 8, fingerprintVectors: vectors.vectors.length, artifacts: manifest.artifacts.length });
    expect(result.expandedLines).toBeGreaterThan(0);
    expect(result.protocolScenarios).toBeGreaterThan(0);
  });

  it.each(stems)("existing production port encodes request and decodes original authorized outcome: %s", async stem => {
    const intent = fixture<Intent>(`${stem}-intent.json`);
    const response = fixture<{ data: unknown }>(`${stem}-response.json`);
    const request = vi.fn<HttpTransport["request"]>(async (_path, _init, dispatched) => { dispatched?.(); return response.data; });
    const auth = { getSnapshot: () => ({ status: "authenticated", actorKey: "42", actorGeneration: 1 }) } as unknown as AuthSession;
    const context = { actorKey: "42", actorGeneration: 1, signal: new AbortController().signal };
    const sales = stem.startsWith("sales");
    const post = stem.endsWith("post");
    let result;
    if (post) {
      const expectedVersion = intent.body.expectedVersion as string;
      result = sales
        ? await createSalesHttpPort({ request }, auth).post({ saleId: intent.requestTargetId!, expectedVersion }, context)
        : await createGoodsReceiptHttpPort({ request }, auth).post({ receiptId: intent.requestTargetId!, expectedVersion }, context);
      expect(result).toEqual({ kind: "success", value: response.data });
    } else if (sales) {
      const body = fixture<ReturnType<typeof mapSaveInput> & { expectedVersion?: string }>(`${stem}-request.json`);
      const snapshot = mapSalesDetail(salesDetailSchema.parse(response.data)).saved;
      snapshot.saleId = intent.requestTargetId;
      snapshot.expectedVersion = body.expectedVersion ?? null;
      snapshot.lines = snapshot.lines.map((line, i) => ({ ...line, clientLineId: `local:${i}`, saleLineId: body.lines[i].saleLineId === "0" ? null : body.lines[i].saleLineId }));
      result = await createSalesHttpPort({ request }, auth).save(snapshot, context);
      expect(result.kind).toBe("success");
      if (result.kind === "success") {
        expect(result.value.saved.lines.map(line => line.clientLineId)).toEqual(snapshot.lines.map(line => line.clientLineId));
        expect(result.value.saleId).toBe("9223372036854775807");
        expect(result.value.saved.lines.map(line => [line.productId, line.qty, line.unitPrice, line.isGift])).toEqual(snapshot.lines.map(line => [line.productId, line.qty, line.unitPrice, line.isGift]));
        expect(new Set(result.value.saved.lines.map(line => line.productId)).size).toBe(1);
        expect(result.value.saved.lines.some(line => line.isGift)).toBe(true);
      }
    } else {
      const body = fixture<ReturnType<typeof mapGoodsReceiptSaveInput> & { expectedVersion?: string }>(`${stem}-request.json`);
      const detail = receiptDetailSchema.parse(response.data);
      const snapshot = mapGoodsReceiptDetail(detail).saved;
      snapshot.receiptId = intent.requestTargetId;
      snapshot.expectedVersion = body.expectedVersion ?? null;
      snapshot.lines = snapshot.lines.map((line, i) => ({ ...line, clientLineId: `local:${i}`, receiptLineId: intent.requestTargetId ? String(9007199254740994n + BigInt(i)) : null }));
      result = await createGoodsReceiptHttpPort({ request }, auth).save(snapshot, context);
      expect(result.kind).toBe("success");
      if (result.kind === "success") {
        expect(result.value.receiptId).toBe("9007199254740993");
        expect(result.value.saved.lines.map(line => line.clientLineId)).toEqual(snapshot.lines.map(line => line.clientLineId));
        expect(result.value.saved.lines.map(line => line.receiptLineId)).toEqual(detail.lines.map(line => line.receiptLineId));
        expect(result.value.saved.lines.map(line => [line.productId, line.quantity, line.unitCost])).toEqual(snapshot.lines.map(line => [line.productId, line.quantity, line.unitCost]));
      }
    }
    expect(oracle.validateRequest(intent)).toBe(true);
    expect(oracle.validateOutcome(intent.operationKind, response)).toBe(true);
    expect(request).toHaveBeenCalledOnce();
    const [path, init] = request.mock.calls[0];
    expect(path).toBe(intent.routeScope.replace(sales ? "{saleId}" : "{receiptId}", intent.requestTargetId ?? ""));
    expect(init?.method).toBe(intent.method);
    expect(JSON.parse(init?.body as string)).toEqual(intent.body);
    // This is current body/outcome compatibility only. WEB4 headers and protected
    // status integration belong to F03, not to these existing production ports.
  });

  it("keeps Sales Post version mandatory and rejects a fabricated Receipt Post version", async () => {
    const sales = await readData(new Response(JSON.stringify(fixture("sales-post-response.json"))));
    const receipt = await readData(new Response(JSON.stringify(fixture("receipt-post-response.json"))));
    const salesAck = postAcknowledgementSchema.parse(sales);
    const receiptAck = receiptPostAcknowledgementSchema.parse(receipt);
    const { version: _version, ...missingVersion } = salesAck;
    expect(postAcknowledgementSchema.safeParse(missingVersion).success).toBe(false);
    expect(receiptPostAcknowledgementSchema.safeParse({ ...receiptAck, version: salesAck.version }).success).toBe(false);
    expect(oracle.validateOutcome("Sales.Post", { data: salesAck })).toBe(true);
    expect(oracle.validateOutcome("Receipt.Post", { data: receiptAck })).toBe(true);
  });

  it("uses backend canonical vectors and exposes why normalized UI detail cannot reconstruct frozen intent", () => {
    for (const vector of vectors.vectors) {
      expect(oracle.canonicalizeRequest(vector.intent), vector.name).toBe(vector.canonical);
      expect(oracle.fingerprintRequest(vector.intent), vector.name).toBe(vector.sha256);
    }
    const intent = fixture<Intent>("sales-create-intent.json");
    const response = fixture<{ data: ReturnType<typeof salesDetailSchema.parse> }>("sales-create-response.json");
    intent.body.note = null;
    response.data.note = null;
    const mapped = mapSalesDetail(salesDetailSchema.parse(response.data));
    expect(mapped.saved.note).toBe("");
    const reconstructed = structuredClone(intent);
    reconstructed.body.note = mapped.saved.note;
    expect(oracle.fingerprintRequest(reconstructed)).not.toBe(oracle.fingerprintRequest(intent));
  });

  it("validates all six protected identities against frozen intent and rejects mismatched or corrupt metadata", () => {
    for (const stem of stems) {
      const intent = fixture<Intent>(`${stem}-intent.json`), status = fixture<Status>(`${stem}-status.json`);
      expect(oracle.validateStatus(status, intent, identity(status)), stem).toBe(true);
      expect(status.data.requestFingerprint).toBe(oracle.fingerprintRequest(intent));
      expect(status.data.requestTargetId).toBe(intent.requestTargetId);
      if (stem.endsWith("create")) expect(status.data.requestTargetId).toBeNull();
    }
    const intent = fixture<Intent>("sales-create-intent.json"), status = fixture<Status>("sales-create-status.json");
    const mismatches: Record<string, unknown> = { operationId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee", deploymentEpoch: "22222222-2222-4333-8444-555555555555", operationKind: "Receipt.Create", method: "PUT", routeScope: "/api/v1/goods-receipts", requestTargetId: "9223372036854775807", requestFingerprint: "0".repeat(64) };
    for (const [key, value] of Object.entries(mismatches)) expect(() => oracle.validateStatus({ data: { ...status.data, [key]: value } }, intent, identity(status)), key).toThrow();
    const changed = structuredClone(intent); changed.body.note = "changed after freezing";
    expect(() => oracle.validateStatus(status, changed, identity(status))).toThrow();
    expect(() => oracle.validateStatus({ data: { ...status.data, requestFingerprint: undefined } }, intent, identity(status))).toThrow();
    expect(() => oracle.validateStatus({ data: { ...status.data, outcome: null } }, intent, identity(status))).toThrow();
  });

  it("requires epoch on writes/status and expected fingerprint on status without treating unavailable results as positive", () => {
    const intent = fixture<Intent>("sales-create-intent.json"), status = fixture<Status>("sales-create-status.json");
    const expected = { deploymentEpoch: status.data.deploymentEpoch, requestFingerprint: oracle.fingerprintRequest(intent) };
    const epoch = ["X-MyDmsVn-Deployment-Epoch", expected.deploymentEpoch];
    const key = ["Idempotency-Key", status.data.operationId];
    const fingerprint = ["X-MyDmsVn-Operation-Fingerprint", expected.requestFingerprint];
    expect(oracle.validateHeaders([epoch, key], "write", expected)).toBe(true);
    expect(oracle.validateHeaders([epoch, fingerprint], "status", expected)).toBe(true);
    for (const pairs of [[epoch], [key], [epoch, key, ["idempotency-key", key[1]]]]) expect(() => oracle.validateHeaders(pairs, "write", expected)).toThrow();
    for (const pairs of [[epoch], [fingerprint], [epoch, [fingerprint[0], "0".repeat(64)]]]) expect(() => oracle.validateHeaders(pairs, "status", expected)).toThrow();
    for (const state of ["expired", "unavailable"]) {
      const unavailable = fixture<Status>(`status-result-${state}.json`);
      expect(oracle.validateStatus(unavailable, intent, identity(status))).toBe(false);
      expect(unavailable.data.outcome).toBeNull();
    }
  });

  it("W4-CON-02 rejects changed intents against the same original operation identity and maps KeyConflict", () => {
    const original = fixture<Intent>("sales-update-intent.json"), status = fixture<Status>("sales-update-status.json");
    const body = structuredClone(original); body.body.note = "different frozen body";
    const version = structuredClone(original); version.body.expectedVersion = "AAAAAAAAAAM=";
    const target = structuredClone(original); target.requestTargetId = "9007199254740993";
    const alternatives = [body, version, target, fixture<Intent>("sales-post-intent.json"), fixture<Intent>("receipt-update-intent.json")];
    for (const changed of alternatives) {
      expect(oracle.validateRequest(changed)).toBe(true);
      expect(oracle.fingerprintRequest(changed)).not.toBe(oracle.fingerprintRequest(original));
      expect(() => oracle.validateStatus(status, changed, identity(status))).toThrow();
    }
    const conflict = fixture("error-idempotency-keyconflict.json");
    expect(web3ErrorEnvelopeSchema.parse(conflict).error.code).toBe("Idempotency.KeyConflict");
    expect(mapReadFailure(new HttpError(409, conflict), web3ErrorEnvelopeSchema)).toMatchObject({ kind: "conflict", code: "Idempotency.KeyConflict", correlationId: "web4-corpus-001" });
  });

  it("validates server context contract/actor/epoch without claiming a runtime actor fence", () => {
    const context = fixture<{ data: Record<string, unknown> }>("context-response.json");
    expect(oracle.validateContext(context)).toBe(true);
    expect(context.data).toMatchObject({ actorUserId: 42, contractVersion: "web4-v1" });
    expect(() => oracle.validateContext({ data: { ...context.data, contractVersion: "web4-v2" } })).toThrow();
    for (const field of ["actorUserId", "deploymentEpoch"]) {
      const missing = structuredClone(context); delete missing.data[field];
      expect(() => oracle.validateContext(missing), field).toThrow();
    }
  });

  it("maps canonical errors through the existing strict shared boundary without interpreting read failure as rollback", () => {
    const kinds: Record<number, string> = { 400: "validation", 401: "unauthorized", 403: "forbidden", 404: "not-found", 409: "conflict", 410: "unavailable", 500: "unavailable", 503: "unavailable" };
    for (const entry of manifest.fixtures.filter(entry => entry.kind === "error")) {
      const payload = fixture(entry.file), parsed = web3ErrorEnvelopeSchema.parse(payload);
      expect(mapReadFailure(new HttpError(entry.status!, payload), web3ErrorEnvelopeSchema)).toMatchObject({ kind: kinds[entry.status!], code: parsed.error.code, correlationId: parsed.error.correlationId });
    }
    // No recovery state is implemented here: a mapped 404/403/410/503 remains a
    // read error, not an authoritative positive status or permission to resend.
  });
});

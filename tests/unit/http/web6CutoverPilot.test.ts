import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { TestInfo } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";
import { fingerprintWeb4Request } from "../../../src/infrastructure/http/web4OperationCodec";
import { captureProtectedCutoverState, verifyAuthenticCommittedCutoverSetup, verifyProtectedCutoverState } from "../../pilot/web6-cutover-helpers";
import { createCutoverControlFrame, requestCutoverControl, type CutoverAction } from "../../pilot/web6-cutover-control";

type CutoverHook = (fixtures: Record<string, never>, testInfo: TestInfo) => void | Promise<void>;
const hooks = vi.hoisted(() => ({
  beforeEach: [] as CutoverHook[],
  afterEach: [] as CutoverHook[],
}));

vi.mock("@playwright/test", () => ({
  test: Object.assign(() => {}, {
    beforeEach: (hook: CutoverHook) => hooks.beforeEach.push(hook),
    afterEach: (hook: CutoverHook) => hooks.afterEach.push(hook),
  }),
}));
vi.mock("../../pilot/web4-helpers", () => ({
  manifest: { mode: "web6-candidate", cutover: {}, recovery: { controlToken: "test-token", controlPipe: "test-pipe" } },
  readStore: vi.fn(),
  recordWeb6Check: vi.fn(),
}));
vi.mock("../../pilot/web6-cutover-control", async importOriginal => ({
  ...await importOriginal<typeof import("../../pilot/web6-cutover-control")>(),
  requestCutoverControl: vi.fn<typeof requestCutoverControl>(),
}));

const epoch = "11111111-2222-4333-8444-555555555555";
const committedRequest = {
  operationKind: "Sales.Create", method: "POST", routeScope: "/api/v1/sales-receipts", requestTargetId: null,
  body: { saleDate: "2024-02-29", customerId: 1, warehouseId: 2, employeeId: 3, note: null,
    lines: [{ saleLineId: "0", productId: 4, qty: "1.0000", unitPrice: "25.0000", isGift: false }] },
} as const;
const operation = {
  schemaVersion: 1, deploymentEpoch: epoch, actorKey: "42", operationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  feature: "sales", localDocumentId: "local-1", localPersistSequence: 1, draftCheckpointSequence: 1,
  draftCheckpointEditRevision: 0, createdAt: "2026-11-10T00:00:00.000Z", state: "DISPATCHED", settlement: null,
  frozen: { schemaVersion: 1, deploymentEpoch: epoch, actorKey: "42", operationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    requestFingerprint: "8".repeat(64), request: { operationKind: "Sales.Create", method: "POST", routeScope: "collection", requestTargetId: null, body: { saleDate: "2024-02-29" } } },
} as any;
const receipt = {
  schemaVersion: 1, candidateId: "candidate-a", frozen: operation.frozen, feature: "sales", localDocumentId: "local-1",
  sourceDraftSequence: 1, sourceOperationSequence: 1, editRevision: 0,
  issuedAtUtc: "2026-11-10T00:00:00.0000000Z", eligibleUntilUtc: "2026-11-10T00:05:00.0000000Z", receipt: "private-receipt",
} as any;

describe("WEB6 cutover protected browser state", () => {
  it("binds one authentic committed-response-lost setup effect to its frozen request", async () => {
    const frozen = { ...operation.frozen, request: committedRequest, requestFingerprint: await fingerprintWeb4Request(committedRequest) };
    const committedOperation = { ...operation, frozen };
    await expect(verifyAuthenticCommittedCutoverSetup(committedOperation, {
      status: 200,
      operationId: committedOperation.operationId,
      deploymentEpoch: committedOperation.deploymentEpoch,
      method: committedOperation.frozen.request.method,
      pathname: "/api/v1/sales-receipts",
      body: committedOperation.frozen.request.body,
    })).resolves.toEqual({
      operationId: committedOperation.operationId,
      operationKind: "Sales.Create",
      requestFingerprint: frozen.requestFingerprint,
      authorizedBusinessEffects: 1,
      checkId: "web6-cutover-authentic-committed-setup",
    });
  });

  it("emits only the allowlisted committed setup fields", async () => {
    const frozen = { ...operation.frozen, request: committedRequest, requestFingerprint: await fingerprintWeb4Request(committedRequest) };
    const evidence = await verifyAuthenticCommittedCutoverSetup({ ...operation, frozen }, {
      status: 200, operationId: operation.operationId, deploymentEpoch: operation.deploymentEpoch,
      method: committedRequest.method, pathname: "/api/v1/sales-receipts", body: committedRequest.body,
    });
    expect(Object.keys(evidence).sort()).toEqual([
      "authorizedBusinessEffects", "checkId", "operationId", "operationKind", "requestFingerprint",
    ]);
    expect(JSON.stringify(evidence)).not.toMatch(/body|receipt|token|password/i);
  });

  it("rejects a committed setup whose transmitted body drifts", async () => {
    const frozen = { ...operation.frozen, request: committedRequest, requestFingerprint: await fingerprintWeb4Request(committedRequest) };
    const committedOperation = { ...operation, frozen };
    await expect(verifyAuthenticCommittedCutoverSetup(committedOperation, {
      status: 200, operationId: committedOperation.operationId, deploymentEpoch: committedOperation.deploymentEpoch,
      method: committedOperation.frozen.request.method, pathname: "/api/v1/sales-receipts", body: { saleDate: "2024-03-01" },
    })).rejects.toThrow(/committed cutover setup/);
  });

  it("requires the exact dispatched operation and receipt with no claim", async () => {
    const baseline = captureProtectedCutoverState(operation, receipt);
    await expect(verifyProtectedCutoverState(baseline, { operation, receipt, claim: undefined })).resolves.toBeUndefined();
  });

  it.each([
    ["missing operation", { operation: undefined, receipt, claim: undefined }],
    ["missing receipt", { operation, receipt: undefined, claim: undefined }],
    ["settled operation", { operation: { ...operation, state: "SETTLED" }, receipt, claim: undefined }],
    ["changed epoch", { operation: { ...operation, deploymentEpoch: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }, receipt, claim: undefined }],
    ["changed frozen body", { operation: { ...operation, frozen: { ...operation.frozen, request: { ...operation.frozen.request, body: { saleDate: "2024-03-01" } } } }, receipt, claim: undefined }],
    ["changed receipt identity", { operation, receipt: { ...receipt, receipt: "different-private-receipt" }, claim: undefined }],
    ["claim appeared", { operation, receipt, claim: { state: "CLAIMED" } }],
  ])("rejects %s", async (_name, state) => {
    const baseline = captureProtectedCutoverState(operation, receipt);
    await expect(verifyProtectedCutoverState(baseline, state as any)).rejects.toThrow(/protected cutover state/);
  });
});
const source = readFileSync(new URL("../../pilot/web6-cutover-live.spec.ts", import.meta.url), "utf8");

it("routes every live cutover frame through the scenario allowance and shared transport", () => {
  expect(source).toMatch(/scenario\.body\(action, \(requestAllowanceMs, allowanceSampledAt\) =>\s+sendCutoverFrame\(action, requestAllowanceMs, allowanceSampledAt, operationId, committedSetup\)\)/);
  expect(source).toMatch(/createCutoverControlFrame\(id, manifest\.recovery\.controlToken, action, requestAllowanceMs, operationId, committedSetup\)/);
  expect(source).toMatch(/requestCutoverControl\(action, manifest\.recovery\.controlPipe, id, request, requestAllowanceMs, undefined, undefined, allowanceSampledAt\)/);
  expect(source.match(/\brequestCutoverControl\(/g)).toHaveLength(1);
  expect(source.match(/\bsendCutoverFrame\(/g)).toHaveLength(3);
  expect(source.match(/\bcreateCutoverScenarioDeadline\(/g)).toHaveLength(1);
  expect(source.match(/\bcontrolPipe\b/g)).toHaveLength(1);
  expect(source).not.toMatch(/node:net|pilot-pipe-connect/);
  const callSites = [...source.matchAll(/await cutoverControl\(testInfo, "([^"]+)"/g)].map(match => match[1]);
  expect(callSites).toEqual([
    "oldClientNewHostOn", "verifyNoCutoverMutation", "newClientOldHostOn", "verifyNoCutoverMutation",
    "committedUnavailable", "verifyNoCutoverMutation", "sameEpochRestart", "revokeGrantOn", "revokeGrantOff",
    "restoreEpoch", "verifyNoCutoverMutation",
  ]);
  expect(source.match(/\bcutoverControl\(/g)).toHaveLength(callSites.length + 1);
});

it("limits the one best-effort reset to the same scenario deadline", () => {
  const cleanup = source.slice(source.indexOf("test.afterEach"), source.indexOf("\ntest("));
  expect(source.match(/\[420_000, 180_000\]/g)).toHaveLength(2);
  expect(source.match(/\[690_000, 60_000\]/g)).toHaveLength(1);
  expect(source).toMatch(/testInfo\.setTimeout\(totalMs\)/);
  expect(cleanup).toMatch(/await scenario\.reset\(\(requestAllowanceMs, allowanceSampledAt\) =>\s+sendCutoverFrame\("resetCutover", requestAllowanceMs, allowanceSampledAt\)\)/);
  expect(source.match(/\bsendCutoverFrame\("resetCutover"/g)).toHaveLength(1);
  expect(cleanup).toMatch(/if \(testInfo\.errors\.length === 0\) throw error/);
  expect(cleanup).toMatch(/testInfo\.annotations\.push/);
  expect(cleanup).not.toMatch(/oldClientNewHostOff|newClientOldHostOff|revokeGrantOff/);
});

it("pins the Playwright active-slot behavior used to tighten afterEach", () => {
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve("playwright/package.json");
  expect(JSON.parse(readFileSync(packagePath, "utf8")).version).toBe("1.64.1");
  const worker = readFileSync(join(dirname(packagePath), "lib/worker/workerProcessEntry.js"), "utf8");
  expect(worker).toContain('this._runEachHooksForSuites(reversedSuites, "afterEach", testInfo, afterHooksSlot)');
  expect(worker).toContain('this._fixtureRunner.teardownScope("test", testInfo, { type: "test", slot: afterHooksSlot })');
  expect(worker).toContain('const runnable = { type: hook.type, location: hook.location, slot }');
  expect(worker).toContain("slot: runnable.fixture?.slot || runnable.slot || this._defaultSlot");
  expect(worker).toMatch(/setTimeout\(timeout\) \{\s+const slot = this\._running \? this\._running\.slot : this\._defaultSlot;\s+slot\.timeout = timeout;/);
  expect(worker).toContain("running.start + (running.slot.timeout - running.slot.elapsed)");
});

describe.each(["healthy", "failed"] as const)("WEB6 afterEach with a %s body", body => {
  it.each([[5001, 5001], [5000, 5000], [1, 1], [0, 1]])(
    "passes the cumulative remainder %i ms to teardown as %i ms", async (remainingMs, teardownTimeoutMs) => {
      await import("../../pilot/web6-cutover-live.spec");
      const [beforeEach] = hooks.beforeEach;
      const [afterEach] = hooks.afterEach;
      const primary = Error("primary test failure");
      const errors = body === "failed" ? [primary] : [];
      const annotations: TestInfo["annotations"] = [];
      const bodySlot = { timeout: 60_000 };
      const inheritedTeardownSlot = { timeout: 420_000 };
      let activeSlot = bodySlot;
      const setTimeout = vi.fn((timeout: number) => { activeSlot.timeout = timeout; });
      const testInfo = {
        title: "cached WEB4 client on compatible new host has no resend path", errors, annotations, setTimeout,
      } as unknown as TestInfo;
      const clock = vi.spyOn(performance, "now").mockReturnValue(0);
      const send = vi.mocked(requestCutoverControl).mockReset().mockResolvedValue({});
      try {
        await beforeEach({}, testInfo);
        expect(bodySlot.timeout).toBe(420_000);
        activeSlot = inheritedTeardownSlot;
        setTimeout.mockClear();
        clock.mockReturnValue(420_000 - remainingMs);

        const cleanup = Promise.resolve(afterEach({}, testInfo));
        if (body === "healthy" && remainingMs <= 5000)
          await expect(cleanup).rejects.toThrow(/scenario-exhausted/);
        else
          await expect(cleanup).resolves.toBeUndefined();

        expect(setTimeout).toHaveBeenCalledExactlyOnceWith(teardownTimeoutMs);
        expect(inheritedTeardownSlot.timeout).toBe(teardownTimeoutMs);
        expect(errors).toEqual(body === "failed" ? [primary] : []);
        expect(annotations).toEqual(body === "failed" && remainingMs <= 5000
          ? [{ type: "web6-cutover-reset-failed" }] : []);
        if (remainingMs <= 5000) {
          expect(send).not.toHaveBeenCalled();
        } else {
          expect(send).toHaveBeenCalledExactlyOnceWith("resetCutover", "test-pipe", expect.any(Number),
            expect.any(Buffer), 5001, undefined, undefined, 414_999);
        }
      } finally {
        clock.mockRestore();
      }
    },
  );
});

const proof = { operationId: operation.operationId, operationKind: "Sales.Create", requestFingerprint: "8".repeat(64),
  authorizedBusinessEffects: 1, checkId: "web6-cutover-authentic-committed-setup" } as const;

it.each([
  ["oldClientNewHostOn"], ["oldClientNewHostOff"], ["newClientOldHostOn"], ["newClientOldHostOff"], ["resetCutover"],
  ["revokeGrantOff"], ["revokeGrantOff", operation.operationId], ["revokeGrantOn", operation.operationId],
  ["sameEpochRestart", operation.operationId], ["restoreEpoch", operation.operationId],
  ["verifyNoCutoverMutation", operation.operationId], ["committedUnavailable", operation.operationId, proof],
] satisfies [CutoverAction, string?, typeof proof?][])("frames %s with the backend's exact field set", (action, operationId?: string, committedSetup?: typeof proof) => {
  const request = createCutoverControlFrame(17, "test-token", action, 5001, operationId, committedSetup);
  expect(request.readInt32LE()).toBe(request.length - 4);
  expect(JSON.parse(request.subarray(4).toString("utf8"))).toEqual({
    id: 17, token: "test-token", action, requestAllowanceMs: 5001,
    ...(operationId === undefined ? {} : { operationId }), ...(committedSetup === undefined ? {} : { committedSetup }),
  });
});

it.each([
  ["resetCutover", operation.operationId], ["sameEpochRestart"], ["committedUnavailable", operation.operationId],
  ["committedUnavailable", "11111111-2222-4333-8444-555555555555", proof], ["verifyNoCutoverMutation", operation.operationId, proof],
] satisfies [CutoverAction, string?, typeof proof?][])("refuses incompatible %s frame fields", (action, operationId?: string, committedSetup?: typeof proof) => {
  expect(() => createCutoverControlFrame(17, "test-token", action, 5001, operationId, committedSetup))
    .toThrow("Invalid WEB6 cutover control frame.");
});

import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertWeb6SanitizedResult,
  createWeb6PilotCountSummary,
  createWeb6PilotResult,
  readWeb6PilotManifest,
} from "../../pilot/web6-candidate-manifest";

const roots: string[] = [];
const originalManifestPath = process.env.MYDMSVN_WEB_PILOT_MANIFEST;
const originalCutoverRequired = process.env.MYDMSVN_WEB6_CUTOVER_REQUIRED;
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  if (originalManifestPath === undefined) delete process.env.MYDMSVN_WEB_PILOT_MANIFEST;
  else process.env.MYDMSVN_WEB_PILOT_MANIFEST = originalManifestPath;
  if (originalCutoverRequired === undefined) delete process.env.MYDMSVN_WEB6_CUTOVER_REQUIRED;
  else process.env.MYDMSVN_WEB6_CUTOVER_REQUIRED = originalCutoverRequired;
  vi.resetModules();
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "web6-pilot-"));
  roots.push(root);
  const path = join(root, "private-manifest.json");
  const value = {
    version: 2,
    mode: "web6-candidate",
    origin: "https://localhost:44321",
    candidateId: "web6-candidate-01",
    frontendSourceSha: "1".repeat(40),
    backendSourceSha: "2".repeat(40),
    frontendDistManifestSha256: "3".repeat(64),
    resultPath: join(root, "browser-result.json"),
    actors: {
      integratedEditor: { username: "editor", password: "private-editor" },
      poster: { username: "poster", password: "private-poster" },
      receiptPoster: { username: "receipt-poster", password: "private-receipt-poster" },
      bob: { username: "bob", password: "private-bob" },
      alice: { username: "alice", password: "private-alice" },
      receiptEditor: { username: "receipt-editor", password: "private-receipt-editor" },
      receiptReader: { username: "receipt-reader", password: "private-receipt-reader" },
      balanceReader: { username: "balance-reader", password: "private-balance-reader" },
      cardReader: { username: "card-reader", password: "private-card-reader" },
    },
    catalog: { customerId: 1, warehouseId: 2, employeeId: 3, productId: 4 },
    receiptCatalog: { warehouseId: 2, employeeId: 3, productId: 4 },
    integratedCatalog: { warehouseId: 2, otherWarehouseId: 5, employeeId: 3, customerId: 1, productId: 4 },
    recovery: {
      version: 1,
      originalFirst: true,
      deploymentEpoch: "11111111-2222-4333-8444-555555555555",
      controlPipe: "\\\\.\\pipe\\mydmsvn-web6-candidate",
      controlToken: "private-control-token",
    },
  };
  return { root, path, value };
}

function read(value: object, path: string) {
  writeFileSync(path, JSON.stringify(value), "utf8");
  return readWeb6PilotManifest(path);
}

function withCutover(value: ReturnType<typeof fixture>["value"]) {
  return {
    ...value,
    cutover: {
      version: 1,
      currentPairId: "web6-current-pair",
      oldPairId: "web4-exact12-pair",
      restoredPairId: "web6-restored-pair",
      currentOrigin: value.origin,
      oldOrigin: "https://localhost:44322",
      frontendWeb4SourceSha: "ea104582a5aa4bcdf0d04999296a30a3c43e450e",
      backendWeb4SourceSha: "a3f3db16381a38bdf0b76e8ab36cb55bec02bbd2",
      frontendWeb4DistManifestSha256: "4".repeat(64),
      backendWeb4ArtifactSha256: "5".repeat(64),
      currentDatabaseOwnershipReceiptSha256: "6".repeat(64),
      oldDatabaseOwnershipReceiptSha256: "7".repeat(64),
      restoredDatabaseOwnershipReceiptSha256: "8".repeat(64),
      currentSchema: 13,
      oldSchema: 12,
      currentDeploymentEpoch: value.recovery.deploymentEpoch,
      restoredDeploymentEpoch: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    },
  };
}

describe("WEB6 private pilot manifest", () => {
  it("reads the exact version 2 candidate fixture", () => {
    const { path, value } = fixture();
    expect(read(value, path)).toEqual(value);
  });

  it.each([
    ["HTTP origin", (value: any) => { value.origin = "http://localhost:44321"; }],
    ["wrong mode", (value: any) => { value.mode = "web5-recovery"; }],
    ["wrong version", (value: any) => { value.version = 1; }],
    ["missing field", (value: any) => { delete value.backendSourceSha; }],
    ["extra field", (value: any) => { value.token = "private"; }],
    ["malformed candidate", (value: any) => { value.candidateId = "candidate/invalid"; }],
    ["overlong candidate", (value: any) => { value.candidateId = `c${"x".repeat(64)}`; }],
    ["uppercase SHA", (value: any) => { value.frontendSourceSha = "A".repeat(40); }],
    ["short SHA", (value: any) => { value.backendSourceSha = "2".repeat(39); }],
    ["malformed hash", (value: any) => { value.frontendDistManifestSha256 = "z".repeat(64); }],
    ["extra nested actor field", (value: any) => { value.actors.alice.token = "private"; }],
    ["unbounded credential", (value: any) => { value.actors.alice.password = "x".repeat(1025); }],
    ["nonpositive catalog handle", (value: any) => { value.catalog.customerId = 0; }],
    ["malformed epoch", (value: any) => { value.recovery.deploymentEpoch = "not-an-epoch"; }],
  ])("rejects %s", (_name, mutate) => {
    const { path, value } = fixture();
    mutate(value);
    expect(() => read(value, path)).toThrow(/WEB6 candidate manifest/);
  });

  it("rejects a result path outside the owned manifest root", () => {
    const { path, value } = fixture();
    value.resultPath = join(tmpdir(), "outside-browser-result.json");
    expect(() => read(value, path)).toThrow(/WEB6 candidate manifest/);
  });

  it.runIf(process.platform === "win32")("rejects a result path through a junction child", () => {
    const { root, path, value } = fixture();
    const outside = mkdtempSync(join(tmpdir(), "web6-pilot-outside-"));
    roots.push(outside);
    const junction = join(root, "redirected");
    symlinkSync(outside, junction, "junction");
    value.resultPath = join(junction, "browser-result.json");
    expect(() => read(value, path)).toThrow(/WEB6 candidate manifest/);
  });

  it("creates only the allowlisted sanitized result identity", () => {
    const { path, value } = fixture();
    const manifest = read(value, path);
    const result = createWeb6PilotResult(manifest);
    expect(result).toEqual({
      version: 2,
      mode: "web6-candidate",
      candidateId: value.candidateId,
      frontendSourceSha: value.frontendSourceSha,
      backendSourceSha: value.backendSourceSha,
      frontendDistManifestSha256: value.frontendDistManifestSha256,
      operations: [],
      checks: [],
    });
    expect(JSON.stringify(result)).not.toMatch(/password|token|cookie|connectionString|receipt|payload|controlPipe/i);
  });

  it.each(["token", "cookie", "connectionString", "receipt", "payload"])(
    "rejects secret field %s in the sanitized result shape",
    field => {
      const { path, value } = fixture();
      const result = createWeb6PilotResult(read(value, path)) as any;
      result[field] = "private";
      expect(() => assertWeb6SanitizedResult(result)).toThrow(/sanitized WEB6 result/);
    },
  );

  it.each([
    "https://outside.invalid/check",
    "Bearer private-access-token",
    '{"payload":"private"}',
  ])("rejects a sensitive checkId value %s", checkId => {
    const { path, value } = fixture();
    const result = createWeb6PilotResult(read(value, path));
    result.operations.push({
      operationKind: "Sales.Create",
      operationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      requestFingerprint: "4".repeat(64),
      consentDispatches: 1,
      candidateId: value.candidateId,
      checkId,
    });
    expect(() => assertWeb6SanitizedResult(result)).toThrow(/sanitized WEB6 result/);
  });

  it("creates a numeric-only browser count", () => {
    const summary = createWeb6PilotCountSummary(["passed", "failed", "skipped", "interrupted"], 2);
    expect(summary).toEqual({ version: 2, discovered: 4, passed: 1, failed: 1, skipped: 1, interrupted: 1, retries: 2 });
    expect(Object.values(summary).every(value => typeof value === "number")).toBe(true);
  });

  it("reads exact pinned and schema-compatible cutover handles", () => {
    const { path, value } = fixture();
    const cutover = withCutover(value);
    expect(read(cutover, path).cutover).toEqual(cutover.cutover);
  });

  it.each([
    ["wrong frontend archive", (value: any) => { value.cutover.frontendWeb4SourceSha = "1".repeat(40); }],
    ["wrong backend archive", (value: any) => { value.cutover.backendWeb4SourceSha = "2".repeat(40); }],
    ["same pair identity", (value: any) => { value.cutover.oldPairId = value.cutover.currentPairId; }],
    ["same origin", (value: any) => { value.cutover.oldOrigin = value.cutover.currentOrigin; }],
    ["HTTP old origin", (value: any) => { value.cutover.oldOrigin = "http://localhost:44322"; }],
    ["out-of-range old origin", (value: any) => { value.cutover.oldOrigin = "https://localhost:99999"; }],
    ["credentialed old origin", (value: any) => { value.cutover.oldOrigin = "https://user@localhost:44322"; }],
    ["schema13 old pair", (value: any) => { value.cutover.oldSchema = 13; }],
    ["schema12 current pair", (value: any) => { value.cutover.currentSchema = 12; }],
    ["same restored epoch", (value: any) => { value.cutover.restoredDeploymentEpoch = value.cutover.currentDeploymentEpoch; }],
    ["wrong current epoch", (value: any) => { value.cutover.currentDeploymentEpoch = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"; }],
    ["malformed old artifact hash", (value: any) => { value.cutover.backendWeb4ArtifactSha256 = "z".repeat(64); }],
    ["malformed database receipt hash", (value: any) => { value.cutover.currentDatabaseOwnershipReceiptSha256 = "x".repeat(64); }],
    ["same database allocation receipt", (value: any) => { value.cutover.oldDatabaseOwnershipReceiptSha256 = value.cutover.currentDatabaseOwnershipReceiptSha256; }],
    ["malformed restored database receipt hash", (value: any) => { value.cutover.restoredDatabaseOwnershipReceiptSha256 = "x".repeat(64); }],
    ["restored receipt repeats current", (value: any) => { value.cutover.restoredDatabaseOwnershipReceiptSha256 = value.cutover.currentDatabaseOwnershipReceiptSha256; }],
    ["restored receipt repeats old", (value: any) => { value.cutover.restoredDatabaseOwnershipReceiptSha256 = value.cutover.oldDatabaseOwnershipReceiptSha256; }],
    ["extra cutover field", (value: any) => { value.cutover.database = "private"; }],
  ])("rejects cutover boundary %s", (_name, mutate) => {
    const { path, value } = fixture();
    const cutover = withCutover(value) as any;
    mutate(cutover);
    expect(() => read(cutover, path)).toThrow(/WEB6 candidate manifest/);
  });

  it("selects only the fail-closed WEB6 pilot pack", async () => {
    const { path, value } = fixture();
    read(value, path);
    process.env.MYDMSVN_WEB_PILOT_MANIFEST = path;
    vi.resetModules();
    const config = (await import("../../../playwright.pilot.config")).default;
    expect(config).toMatchObject({
      testMatch: ["web6-manual-resend-live.spec.ts"],
      workers: 1,
      retries: 0,
      use: { baseURL: value.origin, ignoreHTTPSErrors: false, trace: "off", video: "off", screenshot: "off" },
    });
  });

  it("selects the cutover pack only when strict cutover handles are present", async () => {
    const { path, value } = fixture();
    read(withCutover(value), path);
    process.env.MYDMSVN_WEB_PILOT_MANIFEST = path;
    process.env.MYDMSVN_WEB6_CUTOVER_REQUIRED = "1";
    vi.resetModules();
    const config = (await import("../../../playwright.pilot.config")).default;
    expect(config.testMatch).toEqual(["web6-cutover-live.spec.ts"]);
  });

  it("fails the owning cutover command before discovery when handles are absent", async () => {
    const { path, value } = fixture();
    read(value, path);
    process.env.MYDMSVN_WEB_PILOT_MANIFEST = path;
    process.env.MYDMSVN_WEB6_CUTOVER_REQUIRED = "1";
    vi.resetModules();
    await expect(import("../../../playwright.pilot.config")).rejects.toThrow(/cutover handles are required/);
  });

  it("refuses a missing candidate manifest before browser discovery", async () => {
    delete process.env.MYDMSVN_WEB_PILOT_MANIFEST;
    vi.resetModules();
    await expect(import("../../../playwright.pilot.config")).rejects.toThrow(/pilot manifest is required/);
  });

  it.each([
    ["missing mode", (value: any) => { delete value.mode; }],
    ["wrong candidate mode", (value: any) => { value.mode = "web5-recovery"; }],
  ])("refuses a version 2 candidate-shaped manifest with %s before discovery", async (_name, mutate) => {
    const { path, value } = fixture();
    mutate(value);
    writeFileSync(path, JSON.stringify(value), "utf8");
    process.env.MYDMSVN_WEB_PILOT_MANIFEST = path;
    vi.resetModules();
    await expect(import("../../../playwright.pilot.config")).rejects.toThrow(/WEB6 candidate manifest/);
  });

  it("preserves the existing WEB5 pilot selection", async () => {
    const { root } = fixture();
    const path = join(root, "web5-private-manifest.json");
    writeFileSync(path, JSON.stringify({ mode: "web5-recovery", origin: "https://localhost:44321" }), "utf8");
    process.env.MYDMSVN_WEB_PILOT_MANIFEST = path;
    vi.resetModules();
    const config = (await import("../../../playwright.pilot.config")).default;
    expect(config.testMatch).toEqual(["web4-recovery-live.spec.ts", "web4-boundaries-live.spec.ts", "web5-resolution-live.spec.ts", "web5-negative-six-live.spec.ts"]);
  });
});

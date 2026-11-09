import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export type Web6Actor = "integratedEditor" | "poster" | "receiptPoster" | "bob" | "alice" | "receiptEditor" | "receiptReader" | "balanceReader" | "cardReader";
type Credentials = { username: string; password: string };
type Catalog = { customerId: number; warehouseId: number; employeeId: number; productId: number };
type ReceiptCatalog = { warehouseId: number; employeeId: number; productId: number };
type IntegratedCatalog = { warehouseId: number; otherWarehouseId: number; employeeId: number; customerId: number; productId: number };
type Recovery = { version: 1; originalFirst?: boolean; deploymentEpoch: string; controlPipe: string; controlToken: string };

export type Web6CutoverHandles = {
  version: 1;
  currentPairId: string;
  oldPairId: string;
  restoredPairId: string;
  currentOrigin: string;
  oldOrigin: string;
  frontendWeb4SourceSha: "ea104582a5aa4bcdf0d04999296a30a3c43e450e";
  backendWeb4SourceSha: "a3f3db16381a38bdf0b76e8ab36cb55bec02bbd2";
  frontendWeb4DistManifestSha256: string;
  backendWeb4ArtifactSha256: string;
  currentSchema: 13;
  oldSchema: 12;
  currentDeploymentEpoch: string;
  restoredDeploymentEpoch: string;
};

export type Web6PilotManifest = {
  version: 2;
  mode: "web6-candidate";
  origin: "https://localhost:44321";
  candidateId: string;
  frontendSourceSha: string;
  backendSourceSha: string;
  frontendDistManifestSha256: string;
  resultPath: string;
  actors: Record<Web6Actor, Credentials>;
  catalog: Catalog;
  receiptCatalog: ReceiptCatalog;
  integratedCatalog: IntegratedCatalog;
  recovery: Recovery;
  cutover?: Web6CutoverHandles;
};

export type Web6PilotOperationResult = {
  operationKind: "Sales.Create" | "Sales.Update" | "Sales.Post" | "Receipt.Create" | "Receipt.Update" | "Receipt.Post";
  operationId: string;
  requestFingerprint: string;
  consentDispatches: number;
  candidateId: string;
  checkId: string;
};

export type Web6PilotResult = {
  version: 2;
  mode: "web6-candidate";
  candidateId: string;
  frontendSourceSha: string;
  backendSourceSha: string;
  frontendDistManifestSha256: string;
  operations: Web6PilotOperationResult[];
  checks: string[];
};

const manifestKeys = ["version", "mode", "origin", "candidateId", "frontendSourceSha", "backendSourceSha", "frontendDistManifestSha256", "resultPath", "actors", "catalog", "receiptCatalog", "integratedCatalog", "recovery"] as const;
const cutoverKeys = ["version", "currentPairId", "oldPairId", "restoredPairId", "currentOrigin", "oldOrigin", "frontendWeb4SourceSha", "backendWeb4SourceSha", "frontendWeb4DistManifestSha256", "backendWeb4ArtifactSha256", "currentSchema", "oldSchema", "currentDeploymentEpoch", "restoredDeploymentEpoch"] as const;
const actorKeys: Web6Actor[] = ["integratedEditor", "poster", "receiptPoster", "bob", "alice", "receiptEditor", "receiptReader", "balanceReader", "cardReader"];
const candidatePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const shaPattern = /^[0-9a-f]{40}$/;
const hashPattern = /^[0-9a-f]{64}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const operationKinds = new Set(["Sales.Create", "Sales.Update", "Sales.Post", "Receipt.Create", "Receipt.Update", "Receipt.Post"]);

function fail(): never { throw Error("Invalid WEB6 candidate manifest."); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail();
}
function boundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value);
}
function positiveInteger(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) > 0; }
function strictMarker(value: unknown): value is string {
  return boundedString(value, 128) && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}
function parseCredentials(value: unknown): Credentials {
  if (!isRecord(value)) fail();
  exactKeys(value, ["username", "password"]);
  if (!boundedString(value.username, 128) || !boundedString(value.password, 1024)) fail();
  return value as Credentials;
}
function parsePositiveObject<T>(value: unknown, keys: readonly string[]): T {
  if (!isRecord(value)) fail();
  exactKeys(value, keys);
  if (!keys.every(key => positiveInteger(value[key]))) fail();
  return value as T;
}
function parseRecovery(value: unknown): Recovery {
  if (!isRecord(value)) fail();
  const allowed = value.originalFirst === undefined
    ? ["version", "deploymentEpoch", "controlPipe", "controlToken"]
    : ["version", "originalFirst", "deploymentEpoch", "controlPipe", "controlToken"];
  exactKeys(value, allowed);
  if (value.version !== 1 || (value.originalFirst !== undefined && typeof value.originalFirst !== "boolean") ||
      typeof value.deploymentEpoch !== "string" || !uuidPattern.test(value.deploymentEpoch) ||
      !boundedString(value.controlPipe, 512) || !boundedString(value.controlToken, 1024)) fail();
  return value as Recovery;
}
function isOwnedHttpsOrigin(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 128) return false;
  try {
    const parsed = new URL(value);
    const port = Number(parsed.port);
    return parsed.protocol === "https:" && parsed.hostname === "localhost" && parsed.username === "" && parsed.password === "" &&
      parsed.pathname === "/" && parsed.search === "" && parsed.hash === "" && Number.isInteger(port) && port >= 1024 && port <= 65535;
  } catch { return false; }
}
function parseCutover(value: unknown, origin: string, deploymentEpoch: string): Web6CutoverHandles {
  if (!isRecord(value)) fail();
  exactKeys(value, cutoverKeys);
  if (value.version !== 1 ||
      typeof value.currentPairId !== "string" || !candidatePattern.test(value.currentPairId) ||
      typeof value.oldPairId !== "string" || !candidatePattern.test(value.oldPairId) ||
      typeof value.restoredPairId !== "string" || !candidatePattern.test(value.restoredPairId) ||
      new Set([value.currentPairId, value.oldPairId, value.restoredPairId]).size !== 3 ||
      value.currentOrigin !== origin || !isOwnedHttpsOrigin(value.oldOrigin) || value.oldOrigin === origin ||
      value.frontendWeb4SourceSha !== "ea104582a5aa4bcdf0d04999296a30a3c43e450e" ||
      value.backendWeb4SourceSha !== "a3f3db16381a38bdf0b76e8ab36cb55bec02bbd2" ||
      typeof value.frontendWeb4DistManifestSha256 !== "string" || !hashPattern.test(value.frontendWeb4DistManifestSha256) ||
      typeof value.backendWeb4ArtifactSha256 !== "string" || !hashPattern.test(value.backendWeb4ArtifactSha256) ||
      value.currentSchema !== 13 || value.oldSchema !== 12 ||
      typeof value.currentDeploymentEpoch !== "string" || !uuidPattern.test(value.currentDeploymentEpoch) ||
      value.currentDeploymentEpoch !== deploymentEpoch ||
      typeof value.restoredDeploymentEpoch !== "string" || !uuidPattern.test(value.restoredDeploymentEpoch) ||
      value.restoredDeploymentEpoch === deploymentEpoch) fail();
  return value as Web6CutoverHandles;
}
function ownedResultPath(manifestPath: string, resultPath: unknown): string {
  if (typeof resultPath !== "string" || !isAbsolute(resultPath) || resultPath.length > 1024 || /[\u0000-\u001f\u007f]/.test(resultPath)) fail();
  const ownedRoot = realpathSync(dirname(manifestPath));
  const resolvedResult = resolve(resultPath);
  const child = relative(ownedRoot, resolvedResult);
  if (!child || child.startsWith("..") || isAbsolute(child) || relative(ownedRoot, dirname(resolvedResult)) !== "") fail();
  if (existsSync(resolvedResult)) {
    if (lstatSync(resolvedResult).isSymbolicLink() || realpathSync(resolvedResult) !== resolvedResult) fail();
  }
  return resolvedResult;
}

export function isWeb6CandidateManifestShape(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return value.version === 2 || value.mode === "web6-candidate" ||
    "candidateId" in value || "frontendSourceSha" in value || "backendSourceSha" in value || "frontendDistManifestSha256" in value;
}

export function readWeb6PilotManifest(path: string): Web6PilotManifest {
  if (!isAbsolute(path)) fail();
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(path, "utf8")); } catch { fail(); }
  if (!isRecord(raw)) fail();
  exactKeys(raw, raw.cutover === undefined ? manifestKeys : [...manifestKeys, "cutover"]);
  if (raw.version !== 2 || raw.mode !== "web6-candidate" || raw.origin !== "https://localhost:44321" ||
      typeof raw.candidateId !== "string" || !candidatePattern.test(raw.candidateId) ||
      typeof raw.frontendSourceSha !== "string" || !shaPattern.test(raw.frontendSourceSha) ||
      typeof raw.backendSourceSha !== "string" || !shaPattern.test(raw.backendSourceSha) ||
      typeof raw.frontendDistManifestSha256 !== "string" || !hashPattern.test(raw.frontendDistManifestSha256)) fail();
  if (!isRecord(raw.actors)) fail();
  const actorValues = raw.actors;
  exactKeys(actorValues, actorKeys);
  const actors = Object.fromEntries(actorKeys.map(actor => [actor, parseCredentials(actorValues[actor])])) as Record<Web6Actor, Credentials>;
  const recovery = parseRecovery(raw.recovery);
  return {
    version: 2,
    mode: "web6-candidate",
    origin: "https://localhost:44321",
    candidateId: raw.candidateId,
    frontendSourceSha: raw.frontendSourceSha,
    backendSourceSha: raw.backendSourceSha,
    frontendDistManifestSha256: raw.frontendDistManifestSha256,
    resultPath: ownedResultPath(path, raw.resultPath),
    actors,
    catalog: parsePositiveObject<Catalog>(raw.catalog, ["customerId", "warehouseId", "employeeId", "productId"]),
    receiptCatalog: parsePositiveObject<ReceiptCatalog>(raw.receiptCatalog, ["warehouseId", "employeeId", "productId"]),
    integratedCatalog: parsePositiveObject<IntegratedCatalog>(raw.integratedCatalog, ["warehouseId", "otherWarehouseId", "employeeId", "customerId", "productId"]),
    recovery,
    ...(raw.cutover === undefined ? {} : { cutover: parseCutover(raw.cutover, raw.origin, recovery.deploymentEpoch) }),
  };
}

export function createWeb6PilotResult(manifest: Web6PilotManifest): Web6PilotResult {
  return {
    version: 2,
    mode: "web6-candidate",
    candidateId: manifest.candidateId,
    frontendSourceSha: manifest.frontendSourceSha,
    backendSourceSha: manifest.backendSourceSha,
    frontendDistManifestSha256: manifest.frontendDistManifestSha256,
    operations: [],
    checks: [],
  };
}

export function assertWeb6SanitizedResult(value: unknown): asserts value is Web6PilotResult {
  if (!isRecord(value)) throw Error("Invalid sanitized WEB6 result.");
  try {
    exactKeys(value, ["version", "mode", "candidateId", "frontendSourceSha", "backendSourceSha", "frontendDistManifestSha256", "operations", "checks"]);
    if (value.version !== 2 || value.mode !== "web6-candidate" || typeof value.candidateId !== "string" || !candidatePattern.test(value.candidateId) ||
        typeof value.frontendSourceSha !== "string" || !shaPattern.test(value.frontendSourceSha) ||
        typeof value.backendSourceSha !== "string" || !shaPattern.test(value.backendSourceSha) ||
        typeof value.frontendDistManifestSha256 !== "string" || !hashPattern.test(value.frontendDistManifestSha256) ||
        !Array.isArray(value.operations) || !Array.isArray(value.checks)) throw Error();
    for (const operation of value.operations) {
      if (!isRecord(operation)) throw Error();
      exactKeys(operation, ["operationKind", "operationId", "requestFingerprint", "consentDispatches", "candidateId", "checkId"]);
      if (typeof operation.operationKind !== "string" || !operationKinds.has(operation.operationKind) ||
          typeof operation.operationId !== "string" || !uuidPattern.test(operation.operationId) ||
          typeof operation.requestFingerprint !== "string" || !hashPattern.test(operation.requestFingerprint) ||
          !Number.isSafeInteger(operation.consentDispatches) || (operation.consentDispatches as number) < 0 ||
          typeof operation.candidateId !== "string" || !candidatePattern.test(operation.candidateId) ||
          !strictMarker(operation.checkId)) throw Error();
    }
    if (!value.checks.every(strictMarker)) throw Error();
  } catch { throw Error("Invalid sanitized WEB6 result."); }
}

export type Web6PilotCountSummary = { version: 2; discovered: number; passed: number; failed: number; skipped: number; interrupted: number; retries: number };
export function createWeb6PilotCountSummary(statuses: readonly ("passed" | "failed" | "skipped" | "interrupted")[], retries: number): Web6PilotCountSummary {
  if (!Number.isSafeInteger(retries) || retries < 0) throw Error("Invalid WEB6 browser count.");
  const summary: Web6PilotCountSummary = { version: 2, discovered: statuses.length, passed: 0, failed: 0, skipped: 0, interrupted: 0, retries };
  for (const status of statuses) summary[status]++;
  return summary;
}

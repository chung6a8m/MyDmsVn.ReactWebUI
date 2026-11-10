import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const script = join(projectRoot, "scripts", "web6-candidate-artifact.mjs");
const tempRoot = realpathSync(tmpdir());
const candidateId = "web6-candidate-plan";
const markerFile = "web6-candidate-build.json";

let root: string;
let dist: string;
let output: string;

beforeEach(() => {
  root = mkdtempSync(join(tempRoot, "web6-artifact-"));
  dist = join(root, "dist");
  output = join(root, "artifact.json");
  mkdirSync(join(dist, "assets"), { recursive: true });
  writeFileSync(join(dist, "assets", "app.js"), "export {};\n");
  writeFileSync(join(dist, "index.html"), "<!doctype html>\n");
  writeMarker(null);
});

afterEach(() => {
  expect(dirname(root)).toBe(tempRoot);
  rmSync(root, { recursive: true });
});

function writeMarker(candidateId: string | null, directory = dist) {
  writeFileSync(join(directory, markerFile), JSON.stringify({ version: 1, candidateId }));
}

function invoke(args: string[], command = [script]) {
  return spawnSync(process.execPath, [...command, ...args], {
    cwd: projectRoot,
    env: { ...process.env, VITE_MYDMSVN_WEB6_CANDIDATE_ID: candidateId },
    encoding: "utf8",
  });
}

function ordinaryArgs(distPath = dist, outputPath = output) {
  return ["--dist", distPath, "--mode", "ordinary", "--output", outputPath];
}

function candidateArgs(...id: string[]) {
  return ["--dist", dist, "--mode", "candidate", "--output", output, ...id];
}

it("ordinary artifact reports candidateId null", () => {
  const result = invoke(ordinaryArgs(), ["--run", "web6:artifact", "--"]);
  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(output, "utf8")).toBe(
    '{"version":1,"mode":"ordinary","candidateId":null,"files":['
    + '{"path":"assets/app.js","sha256":"8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881"},'
    + '{"path":"index.html","sha256":"335fca8574f060eea24ebcdae6b78f32414f5de03da1084fd0e73d710768e3a9"},'
    + '{"path":"web6-candidate-build.json","sha256":"1d1a82f94198ed6062e4bafa32eceac9c1cac279dfef9607c4dd21e005f71033"}],'
    + '"manifestSha256":"104fa2c6f5e7712ac6a97c45efd1c7f014442f7bb18d5c1b33001034ac9875b2"}',
  );
});

it("candidate artifact requires and records the canonical ID", () => {
  writeMarker(candidateId);
  const missingId = invoke(candidateArgs());
  expect(missingId.status, missingId.stderr).toBe(1);
  expect(missingId.stderr).toMatch(/candidate ID/i);
  const invalidId = invoke(candidateArgs("--candidate-id", "invalid/id"));
  expect(invalidId.status, invalidId.stderr).toBe(1);
  expect(invalidId.stderr).toMatch(/candidate ID/i);
  expect(existsSync(output)).toBe(false);

  const result = invoke(candidateArgs("--candidate-id", candidateId));
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(readFileSync(output, "utf8"))).toMatchObject({ mode: "candidate", candidateId });
});

it("ordinary build cannot prove a one-character candidate ID appearing in JavaScript", () => {
  writeFileSync(join(dist, "assets", "app.js"), 'console.log("A");');
  const result = invoke(candidateArgs("--candidate-id", "A"));
  expect(result.status, result.stderr).toBe(1);
  expect(result.stderr).toMatch(/build marker/i);
  expect(existsSync(output)).toBe(false);
});

it("a build marked with a one-character candidate ID proves that exact ID", () => {
  writeMarker("A");
  const result = invoke(candidateArgs("--candidate-id", "A"));
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(readFileSync(output, "utf8")).candidateId).toBe("A");
});

it.each([`${candidateId}-other`, `other-${candidateId}`])(
  "refuses an ID appearing as a prefix or suffix of the configured candidate %s",
  (configuredId) => {
    writeMarker(configuredId);
    writeFileSync(join(dist, "assets", "app.js"), `const candidate = "${configuredId}";`);
    const result = invoke(candidateArgs("--candidate-id", candidateId));
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/build marker/i);
    expect(existsSync(output)).toBe(false);
  },
);

it("candidate build cannot prove an ordinary artifact", () => {
  writeMarker(candidateId);
  const result = invoke(ordinaryArgs());
  expect(result.status, result.stderr).toBe(1);
  expect(result.stderr).toMatch(/build marker/i);
  expect(existsSync(output)).toBe(false);
});

it("refuses a missing build marker", () => {
  rmSync(join(dist, markerFile));
  const result = invoke(ordinaryArgs());
  expect(result.status, result.stderr).toBe(1);
  expect(result.stderr).toMatch(/build marker/i);
  expect(existsSync(output)).toBe(false);
});

it.each([
  "{",
  '{"version":2,"candidateId":null}',
  '{"version":1}',
  '{"version":1,"candidateId":null,"extra":true}',
  '{"version":1,"candidateId":"other","candidateId":null}',
])("refuses a malformed or noncanonical build marker %s", (marker) => {
  writeFileSync(join(dist, markerFile), marker);
  const result = invoke(ordinaryArgs());
  expect(result.status, result.stderr).toBe(1);
  expect(result.stderr).toMatch(/build marker/i);
  expect(existsSync(output)).toBe(false);
});

it("ordinary artifact refuses an explicit candidate ID", () => {
  const result = invoke([...ordinaryArgs(), "--candidate-id", candidateId]);
  expect(result.status, result.stderr).toBe(1);
  expect(result.stderr).toMatch(/ordinary/i);
  expect(existsSync(output)).toBe(false);
});

it("manifest is stable across enumeration order", () => {
  const otherDist = join(root, "other-dist");
  const otherOutput = join(root, "other-artifact.json");
  for (const [directory, names] of [
    [dist, ["Z.js", "A.js", "assets/a.js"]],
    [otherDist, ["assets/a.js", "A.js", "Z.js"]],
  ] as const) {
    mkdirSync(join(directory, "assets"), { recursive: true });
    for (const name of names) writeFileSync(join(directory, name), name);
    writeFileSync(join(directory, "assets", "app.js"), "export {};\n");
    writeFileSync(join(directory, "index.html"), "<!doctype html>\n");
    writeMarker(null, directory);
  }

  const first = invoke(ordinaryArgs());
  expect(first.status, first.stderr).toBe(0);
  const second = invoke(ordinaryArgs(otherDist, otherOutput));
  expect(second.status, second.stderr).toBe(0);
  const manifest = readFileSync(output, "utf8");
  expect(readFileSync(otherOutput, "utf8")).toBe(manifest);
  expect(JSON.parse(manifest).files.map(({ path }: { path: string }) => path)).toEqual([
    "A.js", "Z.js", "assets/a.js", "assets/app.js", "index.html", markerFile,
  ]);
});

it("refuses a relative dist, an output inside dist, and unknown arguments", () => {
  const relative = invoke(ordinaryArgs("dist"));
  expect(relative.status, relative.stderr).toBe(1);
  expect(relative.stderr).toMatch(/absolute/i);

  const inside = join(dist, "artifact.json");
  const inDist = invoke(ordinaryArgs(dist, inside));
  expect(inDist.status, inDist.stderr).toBe(1);
  expect(inDist.stderr).toMatch(/outside dist/i);
  expect(existsSync(inside)).toBe(false);

  const unknown = invoke([...ordinaryArgs(), "--extra", "value"]);
  expect(unknown.status, unknown.stderr).toBe(1);
  expect(unknown.stderr).toMatch(/unknown (argument|option)/i);
  expect(existsSync(output)).toBe(false);
});

it("refuses junctions or symbolic links in artifact paths", () => {
  const outside = join(root, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "external.js"), "outside dist");
  const alias = join(dist, "escape");
  symlinkSync(outside, alias, process.platform === "win32" ? "junction" : "dir");

  const nestedLink = invoke(ordinaryArgs());
  expect(nestedLink.status, nestedLink.stderr).toBe(1);
  expect(nestedLink.stderr).toMatch(/link/i);
  const linkedDist = invoke(ordinaryArgs(alias));
  expect(linkedDist.status, linkedDist.stderr).toBe(1);
  expect(linkedDist.stderr).toMatch(/link/i);
  expect(existsSync(output)).toBe(false);

  const linkedOutput = join(root, "output-alias");
  symlinkSync(outside, linkedOutput, process.platform === "win32" ? "junction" : "dir");
  const escapedOutput = invoke(ordinaryArgs(outside, join(linkedOutput, "artifact.json")));
  expect(escapedOutput.status, escapedOutput.stderr).toBe(1);
  expect(escapedOutput.stderr).toMatch(/link/i);
  expect(existsSync(join(outside, "artifact.json"))).toBe(false);
});

it("does not overwrite an existing manifest", () => {
  writeFileSync(output, "preserve me");
  const result = invoke(ordinaryArgs());
  expect(result.status, result.stderr).toBe(1);
  expect(result.stderr).toMatch(/EEXIST/);
  expect(readFileSync(output, "utf8")).toBe("preserve me");
});

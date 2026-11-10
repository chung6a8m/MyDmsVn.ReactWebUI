import { createHash, randomUUID } from "node:crypto";
import {
  closeSync, constants, fstatSync, fsyncSync, linkSync, lstatSync, openSync,
  readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

const candidateIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const statOptions = { bigint: true };
const buildMarkerPath = "web6-candidate-build.json";
const jsMarkerPrefix = "/* MyDmsVn WEB6 build marker ";

function readOptions(args) {
  const { values, tokens } = parseArgs({
    args,
    options: {
      dist: { type: "string" },
      mode: { type: "string" },
      "candidate-id": { type: "string" },
      output: { type: "string" },
    },
    tokens: true,
  });
  if (new Set(tokens.map(token => token.name)).size !== tokens.length) {
    throw new Error("Duplicate argument.");
  }

  const { dist, mode, output, "candidate-id": id } = values;
  if (!dist || !isAbsolute(dist) || (process.platform === "win32" && parse(dist).root.length === 1)) {
    throw new Error("--dist must be an absolute path.");
  }
  if (!output) throw new Error("--output is required.");
  if (mode !== "ordinary" && mode !== "candidate") {
    throw new Error("--mode must be ordinary or candidate.");
  }
  if (mode === "ordinary" && id !== undefined) {
    throw new Error("An ordinary artifact cannot have an explicit candidate ID.");
  }
  if (mode === "candidate" && (!id || !candidateIdPattern.test(id))) {
    throw new Error("A candidate artifact requires a canonical candidate ID.");
  }
  return { dist: resolve(dist), mode, candidateId: id ?? null, output: resolve(output) };
}

function rejectLink(entry, path) {
  if (entry.isSymbolicLink()) throw new Error(`Symbolic link or reparse point refused: ${path}`);
}

function statWithoutLink(path) {
  const stats = lstatSync(path, statOptions);
  rejectLink(stats, path);
  return stats;
}

function canonicalDirectory(path) {
  const { root } = parse(path);
  let directory = root;
  for (const name of path.slice(root.length).split(sep).filter(Boolean)) {
    const child = join(directory, name);
    if (process.platform === "win32") {
      // Windows directory entries expose reparse points that lstat may treat as ordinary.
      const entry = readdirSync(directory, { withFileTypes: true })
        .find(item => item.name.toLowerCase() === name.toLowerCase());
      if (!entry) throw new Error(`Directory not found: ${child}`);
      rejectLink(entry, child);
    }
    if (!statWithoutLink(child).isDirectory()) throw new Error(`Directory required: ${child}`);
    directory = child;
  }
  return realpathSync.native(directory);
}

function assertSameEntry(expected, actual, path, checkContent = false) {
  // On Windows the path-based stat can report a zero volume ID for the same entry.
  const changedVolume = expected.dev !== 0n && actual.dev !== 0n && expected.dev !== actual.dev;
  if (changedVolume || expected.ino !== actual.ino ||
      (checkContent && (expected.size !== actual.size || expected.mtimeNs !== actual.mtimeNs ||
        expected.ctimeNs !== actual.ctimeNs))) {
    throw new Error(`Artifact path changed during measurement: ${path}`);
  }
}

function withPinnedPath(path, kind, action) {
  const expected = statWithoutLink(path);
  const matchesKind = kind === "directory" ? expected.isDirectory() : expected.isFile();
  if (!matchesKind) throw new Error(`Expected a regular ${kind}: ${path}`);

  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const verify = (checkContent = false) => {
      assertSameEntry(expected, fstatSync(fd, statOptions), path, checkContent);
      assertSameEntry(expected, statWithoutLink(path), path, checkContent);
    };
    verify(true);
    return action(fd, verify);
  } finally {
    closeSync(fd);
  }
}

function visitFiles(directory, prefix, verifyDirectory, record) {
  verifyDirectory();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const name = prefix + entry.name;
    rejectLink(entry, path);
    if (entry.name.includes("\\")) throw new Error(`Invalid relative artifact path: ${name}`);
    verifyDirectory();
    if (entry.isDirectory()) {
      withPinnedPath(path, "directory", (_fd, verify) => {
        visitFiles(path, name + "/", () => {
          verifyDirectory();
          verify(true);
        }, record);
      });
    } else if (entry.isFile()) {
      withPinnedPath(path, "file", (fd, verify) => {
        verifyDirectory();
        const bytes = readFileSync(fd);
        verify(true);
        record(name, bytes);
      });
    } else {
      throw new Error(`Expected a regular artifact file: ${path}`);
    }
  }
  verifyDirectory();
}

function validateBuildMarker(bytes, jsMarker, candidateId) {
  if (bytes === undefined) throw new Error("Vite build marker is missing.");
  let marker;
  try {
    marker = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Vite build marker is not valid JSON.");
  }

  const expected = JSON.stringify({ version: 1, candidateId });
  // Canonical bytes also reject extra or duplicate fields and noncanonical encoding.
  if (marker?.version !== 1 || marker.candidateId !== candidateId ||
      !bytes.equals(Buffer.from(expected))) {
    throw new Error("Vite build marker does not match the requested mode and candidate ID.");
  }

  const expectedJsMarker = Buffer.from(`\n${jsMarkerPrefix}${expected} */\n`);
  if (!jsMarker?.equals(expectedJsMarker)) {
    throw new Error("Vite JavaScript build marker is missing or does not match the sidecar.");
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function publishManifest(output, parent, verifyParent, verifyDist, json) {
  const temporary = join(parent, `.${randomUUID()}.tmp`);
  verifyParent();
  const fd = openSync(temporary, "wx", 0o600);
  try {
    writeFileSync(fd, json, "utf8");
    fsyncSync(fd);
    verifyDist(true);
    verifyParent();
    assertSameEntry(fstatSync(fd, statOptions), statWithoutLink(temporary), temporary);
    // A hard link publishes the complete file atomically and fails if output already exists.
    linkSync(temporary, output);
  } finally {
    try {
      verifyParent();
      assertSameEntry(fstatSync(fd, statOptions), statWithoutLink(temporary), temporary);
      unlinkSync(temporary);
    } finally {
      closeSync(fd);
    }
  }
}

function createManifest(args) {
  const { dist, mode, candidateId, output } = readOptions(args);
  const root = canonicalDirectory(dist);
  const parent = canonicalDirectory(dirname(output));
  const destination = join(parent, basename(output));
  const outputFromDist = relative(root, destination);
  if (!outputFromDist || (outputFromDist !== ".." &&
      !outputFromDist.startsWith(".." + sep) && !isAbsolute(outputFromDist))) {
    throw new Error("--output must be outside dist.");
  }

  withPinnedPath(root, "directory", (_fd, verifyDist) => {
    const files = [];
    let marker;
    let jsMarker;
    visitFiles(root, "", () => verifyDist(true), (path, bytes) => {
      files.push({ path, sha256: sha256(bytes) });
      if (path === buildMarkerPath) marker = bytes;
      if (!path.endsWith(".js")) return;

      const offset = bytes.indexOf(jsMarkerPrefix);
      if (offset === -1) return;
      if (jsMarker || bytes.indexOf(jsMarkerPrefix, offset + jsMarkerPrefix.length) !== -1) {
        throw new Error("Duplicate Vite JavaScript build marker.");
      }
      // Compare the entire trailing comment, including its preceding newline.
      jsMarker = bytes.subarray(Math.max(0, offset - 1));
    });
    validateBuildMarker(marker, jsMarker, candidateId);
    files.sort((a, b) => a.path < b.path ? -1 : Number(a.path > b.path));
    const payload = { version: 1, mode, candidateId, files };
    const manifest = { ...payload, manifestSha256: sha256(JSON.stringify(payload)) };
    withPinnedPath(parent, "directory", (_parentFd, verifyParent) => {
      publishManifest(destination, parent, verifyParent, verifyDist, JSON.stringify(manifest));
    });
  });
}

try {
  createManifest(process.argv.slice(2));
} catch (error) {
  console.error(`web6:artifact: ${error.message}`);
  process.exitCode = 1;
}

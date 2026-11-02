import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
it("consumes the exact separately pinned backend resolution corpus without altering WEB4 vectors", () => {
  const root = new URL("../../fixtures/web5-resolution-v1/", import.meta.url);
  const provenance = JSON.parse(readFileSync(new URL("../../fixtures/web5-resolution-v1.provenance.json", import.meta.url), "utf8"));
  const manifest = readFileSync(new URL("manifest.json", root));
  expect(provenance.sourceCommit).toBe("2d72700294227ef69f1a7a61a2969a6bfe2c58be");
  const digest = createHash("sha256").update(manifest).digest("hex");
  expect(digest).toBe("fef5f1f18d3a556bf35d5c9ed6bc38af3eeb0c1a89dd5f9d125d7fb190a133b2");
  expect(digest).toBe(provenance.manifestSha256);
  for (const entry of JSON.parse(manifest.toString("utf8")).files) {
    const bytes = readFileSync(new URL(entry.path, root));
    expect(bytes.length, entry.path).toBe(entry.bytes);
    expect(createHash("sha256").update(bytes).digest("hex"), entry.path).toBe(entry.sha256);
  }
});

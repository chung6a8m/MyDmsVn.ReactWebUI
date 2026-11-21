import { describe, expect, it } from "vitest";
import { catalogEntries, findCatalogEntry, parseCatalogEntry } from "../../../src/lab/catalog/catalogEntries";

describe("WEB7-08 catalog allowlist and provenance", () => {
  it("exposes three groups, unique IDs and focused metadata for every entry", () => {
    expect(new Set(catalogEntries.map(entry => entry.id)).size).toBe(catalogEntries.length);
    expect(new Set(catalogEntries.map(entry => entry.group))).toEqual(new Set(["primitives", "controls", "recipes"]));
    for (const entry of catalogEntries) {
      expect(entry.purpose).not.toBe("");
      expect(entry.source).not.toBe("");
      expect(entry.keyboard).not.toBe("");
      expect(entry.validation).not.toBe("");
      if (entry.status === "available") {
        expect(entry.consumers.length).toBeGreaterThan(0);
        expect(entry.states.length).toBeGreaterThan(0);
        expect(entry.tests.length).toBeGreaterThan(0);
      }
    }
  });
  it("rejects arbitrary deep links without loading arbitrary components", () => {
    expect(parseCatalogEntry("__proto__")).toBe("button");
    expect(parseCatalogEntry("../../src/app/runtime")).toBe("button");
    expect(parseCatalogEntry(null)).toBe("button");
    expect(findCatalogEntry("date-field")?.id).toBe("date-field");
    expect(findCatalogEntry("advanced-grid")?.status).toBe("planned");
  });
});

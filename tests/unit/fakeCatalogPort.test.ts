import { describe, it, expect } from "vitest";
import { createFakeCatalogPort } from "../../src/infrastructure/fake/fakeCatalogPort";
const context = () => ({
  actorKey: "demo",
  actorGeneration: 1,
  signal: new AbortController().signal,
});

describe("fake catalog", () => {
  it("filters active options by kind and Vietnamese name before limiting", async () => {
    const port = createFakeCatalogPort();
    const result = await port.search(
      { kind: "product", search: "CÀ PHÊ", limit: 1 },
      context(),
    );
    expect(result).toMatchObject({
      kind: "success",
      value: [{ id: "9007199254740993", name: "Cà phê sữa", isActive: true }],
    });
    if (result.kind === "success") expect(result.value).toHaveLength(1);
    const customer = await port.search(
      { kind: "customer", search: "", limit: 25 },
      context(),
    );
    expect(customer).toMatchObject({
      kind: "success",
      value: [{ code: "KH001" }],
    });
  });
  it("provides deterministic empty scenario and rejects invalid limits", async () => {
    expect(
      await createFakeCatalogPort("empty-catalog").search(
        { kind: "product", search: "", limit: 25 },
        context(),
      ),
    ).toEqual({ kind: "success", value: [] });
    expect(
      await createFakeCatalogPort().search(
        { kind: "product", search: "", limit: -1 },
        context(),
      ),
    ).toMatchObject({ kind: "failed", error: { kind: "validation" } });
  });
  it("observes cancellation across its async boundary", async () => {
    const controller = new AbortController();
    const pending = createFakeCatalogPort().search(
      { kind: "product", search: "", limit: 25 },
      { ...context(), signal: controller.signal },
    );
    controller.abort();
    expect(await pending).toMatchObject({
      kind: "failed",
      error: { code: "aborted" },
    });
  });
});

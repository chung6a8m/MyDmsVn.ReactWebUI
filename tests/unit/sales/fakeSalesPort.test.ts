import { expect, test } from "vitest";
import { createFakeSalesPort } from "../../../src/infrastructure/fake/fakeSalesPort";
import { createScenarioController } from "../../../src/infrastructure/fake/scenarioController";
const ctx = {
  actorKey: "test",
  actorGeneration: 1,
  signal: new AbortController().signal,
};
test("save preserves client identity, advances opaque baseline and rejects stale writes", async () => {
  const port = createFakeSalesPort();
  const read = await port.get("1001", ctx);
  if (read.kind !== "success") throw Error("fixture");
  const snapshot = { ...read.value.saved, note: "Đã sửa" };
  const saved = await port.save(snapshot, ctx);
  expect(saved.kind).toBe("success");
  if (saved.kind !== "success") return;
  expect(saved.value.saved.expectedVersion).toBe(saved.value.version);
  expect(saved.value.version).not.toBe(read.value.version);
  expect(saved.value.lines[0].clientLineId).toBe(
    snapshot.lines[0].clientLineId,
  );
  expect(await port.save(snapshot, ctx)).toMatchObject({
    kind: "failed",
    error: { kind: "conflict" },
  });
});
test("eventual commit stays old until external release and Write does not grant Post", async () => {
  const controller = createScenarioController();
  const port = createFakeSalesPort(controller);
  const read = await port.get("1001", ctx);
  if (read.kind !== "success") throw Error("fixture");
  controller.setMode("eventual-commit");
  expect(await port.save({ ...read.value.saved, note: "late" }, ctx)).toEqual({
    kind: "outcome-unknown",
  });
  expect(await port.get("1001", ctx)).toMatchObject({
    kind: "success",
    value: { saved: { note: "" } },
  });
  controller.complete(controller.state.getState().pending[0].requestId);
  expect(await port.get("1001", ctx)).toMatchObject({
    kind: "success",
    value: { saved: { note: "late" } },
  });
  controller.setMode("success");
  controller.setCapabilities({ post: false });
  expect(
    await port.post({ saleId: "1001", expectedVersion: "any" }, ctx),
  ).toMatchObject({ kind: "failed", error: { kind: "forbidden" } });
});
test("new lines never reuse an existing backend line identity", async () => {
  const port = createFakeSalesPort();
  const read = await port.get("1001", ctx);
  if (read.kind !== "success") throw Error("fixture");
  const lines = [
    {
      ...read.value.saved.lines[0],
      clientLineId: "inserted",
      saleLineId: null,
    },
    ...read.value.saved.lines,
  ];
  const result = await port.save({ ...read.value.saved, lines }, ctx);
  expect(result.kind).toBe("success");
  if (result.kind !== "success") return;
  expect(new Set(result.value.lines.map((l) => l.saleLineId)).size).toBe(
    lines.length,
  );
});
test("inactive references remain readable but cannot be selected by save", async () => {
  const port = createFakeSalesPort();
  const read = await port.get("1004", ctx);
  if (read.kind !== "success") throw Error("fixture");
  expect(read.value.lines.some((l) => l.product.isActive === false)).toBe(true);
  expect(await port.save(read.value.saved, ctx)).toMatchObject({
    kind: "failed",
    error: { code: "reference-conflict" },
  });
});
test("delay releases in explicit order; lost response commits once; public reads detach", async () => {
  const controller = createScenarioController();
  const port = createFakeSalesPort(controller);
  const read = await port.get("1001", ctx);
  if (read.kind !== "success") throw Error("fixture");
  read.value.saved.note = "mutated clone";
  expect(await port.get("1001", ctx)).toMatchObject({
    kind: "success",
    value: { saved: { note: "" } },
  });
  controller.setMode("delay");
  const pending = port.save({ ...read.value.saved, note: "delayed" }, ctx);
  controller.complete(controller.state.getState().pending[0].requestId);
  expect(await pending).toMatchObject({
    kind: "success",
    value: { saved: { note: "delayed" } },
  });
  const latest = await port.get("1001", ctx);
  if (latest.kind !== "success") throw Error("fixture");
  controller.setMode("commit-then-response-lost");
  expect(
    await port.post(
      { saleId: "1001", expectedVersion: latest.value.version },
      ctx,
    ),
  ).toEqual({ kind: "outcome-unknown" });
  expect(await port.get("1001", ctx)).toMatchObject({
    kind: "success",
    value: { status: "Posted", totalCost: "0.0000" },
  });
});
test("Read Write Post capabilities are independent at the port boundary", async () => {
  const c = createScenarioController(),
    p = createFakeSalesPort(c);
  const r = await p.get("1001", ctx);
  if (r.kind !== "success") throw Error("fixture");
  c.setCapabilities({ read: false, write: true, post: false });
  expect(await p.get("1001", ctx)).toMatchObject({
    kind: "failed",
    error: { kind: "forbidden" },
  });
  expect(await p.list({ pageSize: 25 }, ctx)).toMatchObject({
    kind: "failed",
    error: { kind: "forbidden" },
  });
  const save = await p.save(r.value.saved, ctx);
  expect(save.kind).toBe("success");
  if (save.kind !== "success") return;
  c.setCapabilities({ write: false, post: true });
  expect(await p.save(save.value.saved, ctx)).toMatchObject({
    kind: "failed",
    error: { kind: "forbidden" },
  });
  expect(
    await p.post({ saleId: "1001", expectedVersion: save.value.version }, ctx),
  ).toMatchObject({ kind: "success", value: { status: "Posted" } });
});
test("Post rejects stored references that are no longer eligible", async () => {
  const p = createFakeSalesPort();
  const r = await p.get("1004", ctx);
  if (r.kind !== "success") throw Error("fixture");
  expect(
    await p.post(
      { saleId: r.value.saleId, expectedVersion: r.value.version },
      ctx,
    ),
  ).toMatchObject({ kind: "failed", error: { code: "reference-conflict" } });
});
test("delayed completion rechecks revoked Write and Post capabilities", async () => {
  for (const operation of ["save", "post"] as const) {
    const c = createScenarioController(),
      p = createFakeSalesPort(c);
    const r = await p.get("1001", ctx);
    if (r.kind !== "success") throw Error("fixture");
    c.setMode("delay");
    const pending =
      operation === "save"
        ? p.save({ ...r.value.saved, note: "revoked" }, ctx)
        : p.post({ saleId: "1001", expectedVersion: r.value.version }, ctx);
    c.setCapabilities({ write: false, post: false });
    c.complete(c.state.getState().pending[0].requestId);
    expect(await pending).toMatchObject({
      kind: "failed",
      error: { kind: "forbidden" },
    });
    expect(await p.get("1001", ctx)).toMatchObject({
      kind: "success",
      value: { version: r.value.version, status: "Draft", saved: { note: "" } },
    });
  }
});
test("create rejects version tokens and orphan server line IDs", async () => {
  const p = createFakeSalesPort();
  const r = await p.get("1001", ctx);
  if (r.kind !== "success") throw Error("fixture");
  const create = {
    ...r.value.saved,
    saleId: null,
    expectedVersion: null,
    lines: r.value.saved.lines.map((l) => ({ ...l, saleLineId: null })),
  };
  expect(
    await p.save({ ...create, expectedVersion: "orphan-version" }, ctx),
  ).toMatchObject({ kind: "failed", error: { kind: "validation" } });
  expect(
    await p.save({ ...create, lines: r.value.saved.lines }, ctx),
  ).toMatchObject({ kind: "failed", error: { kind: "conflict" } });
});

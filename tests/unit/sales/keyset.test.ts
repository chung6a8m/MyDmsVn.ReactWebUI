import { expect, test } from "vitest";
import { createFakeSalesPort } from "../../../src/infrastructure/fake/fakeSalesPort";
const ctx = {
  actorKey: "test",
  actorGeneration: 1,
  signal: new AbortController().signal,
};
test("keyset traverses deterministic documents without duplicates and binds filters", async () => {
  const port = createFakeSalesPort();
  const first = await port.list({ pageSize: 25 }, ctx);
  expect(first.kind).toBe("success");
  if (first.kind !== "success") return;
  expect(first.value.items).toHaveLength(25);
  expect(first.value.items.slice(0, 2).map((x) => x.saleId)).toEqual([
    "9007199254740994",
    "9007199254740993",
  ]);
  expect(first.value.nextCursor).toBeTruthy();
  const second = await port.list(
    { pageSize: 25, cursor: first.value.nextCursor! },
    ctx,
  );
  expect(second.kind).toBe("success");
  if (second.kind !== "success") return;
  expect(
    new Set([...first.value.items, ...second.value.items].map((x) => x.saleId))
      .size,
  ).toBeGreaterThanOrEqual(30);
  expect(
    await port.list(
      {
        pageSize: 25,
        productId: "9007199254740993",
        cursor: first.value.nextCursor!,
      },
      ctx,
    ),
  ).toMatchObject({ kind: "failed" });
});
test("Product membership keeps totals for every line and keyset reverses", async () => {
  const port = createFakeSalesPort();
  const first = await port.list(
    { pageSize: 3, productId: "9007199254740994" },
    ctx,
  );
  if (first.kind !== "success") throw Error("page");
  for (const item of first.value.items) {
    const read = await port.get(item.saleId, ctx);
    if (read.kind !== "success") throw Error("detail");
    expect(item.totalAmount).toBe(read.value.totalAmount);
    expect(
      read.value.lines.some((l) => l.productId === "9007199254740994"),
    ).toBe(true);
  }
  const next = await port.list(
    {
      pageSize: 3,
      productId: "9007199254740994",
      cursor: first.value.nextCursor!,
    },
    ctx,
  );
  if (next.kind !== "success") throw Error("next");
  const back = await port.list(
    {
      pageSize: 3,
      productId: "9007199254740994",
      cursor: next.value.previousCursor!,
    },
    ctx,
  );
  expect(back).toEqual(first);
  const all = await port.list({ pageSize: 25 }, ctx);
  expect(all).toMatchObject({
    kind: "success",
    value: {
      items: expect.arrayContaining([
        expect.objectContaining({ saleId: "9007199254740994" }),
      ]),
    },
  });
});
test("every list filter is applied before the cursor and invalidated by changes", async () => {
  const port = createFakeSalesPort();
  const query = {
    pageSize: 2,
    fromDate: "2026-10-01",
    toDate: "2026-10-31",
    customerId: "101",
    warehouseId: "201",
    employeeId: "301",
    status: "Draft" as const,
    search: "Sales",
  };
  const page = await port.list(query, ctx);
  if (page.kind !== "success") throw Error("page");
  for (const field of [
    "fromDate",
    "toDate",
    "customerId",
    "warehouseId",
    "employeeId",
    "status",
    "search",
  ] as const) {
    const changed = {
      ...query,
      [field]: field === "status" ? "Posted" : "changed",
      cursor: page.value.nextCursor!,
    };
    expect(await port.list(changed, ctx)).toMatchObject({
      kind: "failed",
      error: { code: "invalid-cursor" },
    });
  }
  expect(await port.list({ ...query, customerId: "999" }, ctx)).toMatchObject({
    kind: "success",
    value: { items: [] },
  });
});

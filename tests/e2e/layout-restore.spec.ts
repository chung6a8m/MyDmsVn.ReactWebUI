import { test, expect, type Page, type Locator } from "@playwright/test";
import { openDecimal } from "./decimal-helpers";
// Browser plugin not available; use the repository Chromium project against real UI.
const storageKey = "mydmsvn.workspace.layout.v2:workspace-demo";
const legacyStorageKey = "mydmsvn.workspace.layout.v1:workspace-demo";
let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) errors.push(m.text());
  });
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/lab/sales");
});
test.afterEach(() => expect(errors).toEqual([]));
const b = (page: Page | Locator, name: string) =>
  page.getByRole("button", { name, exact: true });
async function open(page: Page, id = "1001") {
  await b(page, `Mở mẫu ${id}`).click();
  const p = page.getByRole("region", { name: `Chứng từ ${id}`, exact: true });
  await expect(p.getByLabel("Ghi chú", { exact: true })).toBeVisible();
  return p;
}
async function stored(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), storageKey);
}
async function controls(page: Page) {
  await page
    .getByText("Điều khiển fake Sales (ngoài sản phẩm)", { exact: true })
    .click();
}
function envelope(saleId?: string) {
  const panels: Record<string, unknown> = {
    "foundation-catalog": {
      id: "foundation-catalog",
      contentComponent: "catalog",
    },
  };
  const views = ["foundation-catalog"];
  if (saleId) {
    const id = `sales-${saleId}`;
    panels[id] = { id, contentComponent: "sales", params: { saleId } };
    views.push(id);
  }
  return {
    schemaVersion: 1,
    registryVersion: 1,
    scope: { actorKey: "workspace-demo", actorGeneration: 1 },
    dropped: 0,
    layout: {
      panels,
      grid: {
        width: 1440,
        height: 500,
        orientation: "HORIZONTAL",
        root: {
          type: "branch",
          data: [
            {
              type: "leaf",
              size: 1440,
              data: { id: "group-1", views, activeView: views.at(-1) },
            },
          ],
        },
      },
      activeGroup: "group-1",
    },
  };
}
function v2Envelope(saleId?: string) {
  const legacy = envelope(saleId);
  const panels: Record<string, unknown> = {
    "foundation-catalog": {
      id: "foundation-catalog",
      contentComponent: "catalog",
      params: { kind: "records", module: "sales" },
    },
  };
  if (saleId) {
    const id = `sales-${saleId}`;
    panels[id] = { id, contentComponent: "sales", params: { kind: "document", module: "sales", serverId: saleId } };
  }
  return { ...legacy, schemaVersion: 2, registryVersion: 2,
    scope: { actorKey: "workspace-demo" }, layout: { ...legacy.layout, panels } };
}
async function inject(page: Page, value: string, version: 1 | 2 = 1, staleV1?: string) {
  await page.addInitScript(
    ({ key, legacyKey, value, version, staleV1 }) => {
      // Apply once after pagehide persistence, then let later reloads exercise the stored result.
      if (sessionStorage.getItem("web3-layout-injected")) return;
      sessionStorage.setItem("web3-layout-injected", "1");
      if (version === 1) {
        localStorage.removeItem(key);
        localStorage.setItem(legacyKey, value);
      } else {
        if (staleV1 !== undefined) localStorage.setItem(legacyKey, staleV1);
        localStorage.setItem(key, value);
      }
    },
    {
      key: storageKey,
      legacyKey: legacyStorageKey,
      value,
      version,
      staleV1,
    },
  );
  await page.reload();
}

test("reload restores split saved records with fresh sessions and baseline, drops unsaved tab and raw contents", async ({
  page,
}) => {
  const a = await open(page);
  const sessionA = await a.getAttribute("data-session-id");
  await a.getByLabel("Ghi chú", { exact: true }).fill("SECRET-UNSAVED-NOTE");
  await (await openDecimal(a, "qty")).fill("98765,4321");
  await b(page, "Tách sang phải").click();
  const other = await open(page, "1002");
  const sessionB = await other.getAttribute("data-session-id");
  await b(page, "Sales mới").click();
  await expect.poll(async () => await stored(page)).toContain('"dropped":1');
  const raw = (await stored(page))!;
  expect(raw).not.toContain("SECRET-UNSAVED-NOTE");
  expect(raw).not.toContain("98765");
  expect(raw).not.toContain(sessionA!);
  expect(raw).not.toContain(sessionB!);
  expect(JSON.parse(raw).layout.grid.root.data.length).toBeGreaterThan(1);
  await page.reload();
  await expect(page.getByText(/bỏ 1 tab không thể khôi phục/)).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Sales mới", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Sales 1001", exact: true }).click();
  const restored = page.getByRole("region", {
    name: "Chứng từ 1001",
    exact: true,
  });
  await expect(restored.getByLabel("Ghi chú", { exact: true })).toHaveValue("");
  await expect(restored).not.toHaveAttribute("data-session-id", sessionA!);
  await expect(
    restored.locator('.ag-row[row-index="0"] [col-id="qty"]'),
  ).toHaveText("1.0000");
  await expect(
    page.getByText(
      "Bản nháp chưa lưu sẽ mất khi tải lại hoặc đóng trang. Bố cục được nhớ, nội dung chưa lưu không được khôi phục.",
      { exact: true },
    ),
  ).toBeVisible();
});
test("restore refetches inactive product summary and keeps split geometry usable", async ({
  page,
}, testInfo) => {
  const list = page.getByRole("region", {
    name: "Danh sách Sales",
    exact: true,
  });
  await list.getByLabel("Tìm chứng từ", { exact: true }).fill("Sales 1004");
  await list.locator('.ag-row [col-id="saleId"]').dblclick();
  const p = page.getByRole("region", { name: "Chứng từ 1004", exact: true });
  const previous = await p.getAttribute("data-session-id");
  await expect(
    p.locator('.ag-row[row-index="0"] [col-id="product"]'),
  ).toHaveText("Cà phê ngừng bán");
  await expect.poll(() => stored(page)).toContain("sales-1004");
  await page.reload();
  await expect(
    p.locator('.ag-row[row-index="0"] [col-id="product"]'),
  ).toHaveText("Cà phê ngừng bán");
  await expect(p).not.toHaveAttribute("data-session-id", previous!);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect
    .poll(async () => (await p.boundingBox())!.width)
    .toBeLessThanOrEqual(1280);
  await expect
    .poll(() => p.evaluate((el) => el.scrollWidth - el.clientWidth))
    .toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("layout-restore.png") });
});
for (const mode of [
  "json",
  "schema",
  "scope",
  "component",
  "params",
  "hidden",
]) {
  test(`legacy untrusted ${mode} storage cannot restore arbitrary state`, async ({
    page,
  }) => {
    const data = envelope(mode === "params" ? "1001" : undefined);
    let raw: string;
    if (mode === "json") raw = "{";
    else {
      if (mode === "schema") data.schemaVersion = 99;
      if (mode === "scope") data.scope.actorKey = "foreign";
      if (mode === "hidden")
        Object.assign(data.layout.grid.root.data[0], { visible: false });
      if (mode === "component")
        data.layout.panels["foundation-catalog"] = {
          id: "foundation-catalog",
          contentComponent: "arbitrary-module",
          params: { secret: "INJECTED-DRAFT" },
        };
      if (mode === "params")
        data.layout.panels["sales-1001"] = {
          id: "sales-1001",
          contentComponent: "sales",
          title: "INJECTED-TITLE",
          params: {
            saleId: "1001",
            sessionId: "old-session",
            draft: { note: "INJECTED-DRAFT" },
          },
        };
      raw = JSON.stringify(data);
    }
    await inject(page, raw);
    await expect(b(page, "Mở mẫu 1001")).toBeEnabled();
    await expect(page.getByText("INJECTED-DRAFT", { exact: true })).toHaveCount(
      0,
    );
    if (mode === "params") {
      const p = page.getByRole("region", {
        name: "Chứng từ 1001",
        exact: true,
      });
      await expect(p.getByLabel("Ghi chú", { exact: true })).toHaveValue("");
      await expect(p).not.toHaveAttribute("data-session-id", "old-session");
    } else {
      const p = await open(page);
      await expect(p.getByLabel("Ghi chú", { exact: true })).toBeEnabled();
    }
  });
}
test("v1 migration prunes unknown groups, writes v2 and retains v1 through reset and reload", async ({ page }) => {
  const data = envelope("1001");
  data.layout.panels.unknown = { id: "unknown", contentComponent: "not-registered" };
  data.layout.grid.root.data.push({ type: "leaf", size: 300,
    data: { id: "unknown-group", views: ["unknown"], activeView: "unknown" } });
  const raw = JSON.stringify(data);
  await inject(page, raw);
  await expect(page.getByRole("region", { name: "Chứng từ 1001", exact: true }).getByLabel("Ghi chú", { exact: true })).toBeVisible();
  await expect.poll(() => stored(page)).toContain('"schemaVersion":2');
  const migrated = JSON.parse((await stored(page))!);
  expect(migrated.layout.panels["sales-1001"].params).toEqual({ kind: "document", module: "sales", serverId: "1001" });
  expect(migrated.layout.grid.root.data).toHaveLength(1);
  expect(await page.evaluate(key => localStorage.getItem(key), legacyStorageKey)).toBe(raw);
  await b(page, "Đặt lại bố cục").click();
  await expect(page.getByRole("tab", { name: "Sales 1001", exact: true })).toHaveCount(0);
  await expect.poll(async () => Object.keys(JSON.parse((await stored(page))!).layout.panels)).toEqual(["foundation-catalog"]);
  await page.reload();
  await expect(b(page, "Mở mẫu 1001")).toBeEnabled();
  await expect(page.getByRole("tab", { name: "Sales 1001", exact: true })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), legacyStorageKey)).toBe(raw);
});
test("legacy ID outside positive int64 fails migration without creating a rounded record", async ({ page }) => {
  await inject(page, JSON.stringify(envelope("9223372036854775808")));
  await expect(page.getByText(/Bố cục đã lưu không hợp lệ/)).toBeVisible();
  await expect(page.getByRole("tab", { name: /Sales 922337/ })).toHaveCount(0);
  await expect(b(page, "Mở mẫu 1001")).toBeEnabled();
});
for (const mode of ["json", "empty", "module", "kind", "component", "params", "scope", "int64"]) {
  test(`invalid present v2 ${mode} fails whole layout without falling back to valid v1`, async ({ page }) => {
    const data = v2Envelope("1001");
    const document = data.layout.panels["sales-1001"] as { contentComponent: string; params: Record<string, unknown> };
    if (mode === "module") document.params.module = "unknown";
    if (mode === "kind") document.params.kind = "read-only";
    if (mode === "component") document.contentComponent = "not-registered";
    if (mode === "params") document.params.draft = "INJECTED-DRAFT";
    if (mode === "scope") data.scope.actorKey = "foreign";
    if (mode === "int64") document.params.serverId = "9223372036854775808";
    const raw = mode === "json" ? "{" : mode === "empty" ? "" : JSON.stringify(data);
    const legacy = JSON.stringify(envelope("1002"));
    await inject(page, raw, 2, legacy);
    await expect(page.getByText(/Bố cục đã lưu không hợp lệ/)).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Sales 100[12]$/ })).toHaveCount(0);
    await expect(page.getByText("INJECTED-DRAFT", { exact: true })).toHaveCount(0);
    await expect(b(page, "Mở mẫu 1001")).toBeEnabled();
    expect(await page.evaluate(key => localStorage.getItem(key), legacyStorageKey)).toBe(legacy);
  });
}
test("v2 reload keeps overlapping Sale and Receipt IDs separate and restores read-only singleton without private drafts", async ({ page }) => {
  const sale = await open(page);
  const saleSession = await sale.getAttribute("data-session-id");
  await sale.getByLabel("Ghi chú", { exact: true }).fill("PRIVATE-SALE-DRAFT");
  await b(page, "Mở Receipt stub 1001").click();
  const receipt = page.getByRole("region", { name: "Nhập kho stub 1001", exact: true });
  const receiptSession = await receipt.getAttribute("data-session-id");
  expect(receiptSession).not.toBe(saleSession);
  await receipt.getByLabel("Raw Receipt", { exact: true }).fill("PRIVATE-RECEIPT-DRAFT");
  await b(page, "Tách sang phải").click();
  await b(page, "Thẻ kho stub").click();
  await expect.poll(() => stored(page)).toContain('"module":"inventory-stock-card"');
  const raw = (await stored(page))!;
  expect(raw).toContain('"module":"sales","serverId":"1001"');
  expect(raw).toContain('"module":"goods-receipt","serverId":"1001"');
  expect(raw).not.toMatch(/PRIVATE-SALE-DRAFT|PRIVATE-RECEIPT-DRAFT/);
  expect(raw).not.toContain(saleSession!); expect(raw).not.toContain(receiptSession!);
  await page.reload();
  await page.getByRole("tab", { name: "Sales 1001", exact: true }).click();
  await expect(sale.getByLabel("Ghi chú", { exact: true })).toHaveValue("");
  await expect(sale).not.toHaveAttribute("data-session-id", saleSession!);
  await page.getByRole("tab", { name: "Nhập kho 1001", exact: true }).click();
  await expect(receipt.getByLabel("Raw Receipt", { exact: true })).toHaveValue("");
  await expect(receipt).not.toHaveAttribute("data-session-id", receiptSession!);
  await b(page, "Thẻ kho stub").click();
  await expect(page.getByRole("tab", { name: "Thẻ kho", exact: true })).toHaveCount(1);
  const stockCard = page.locator("section").getByText("WEB3-02 · Panel chỉ đọc thử vòng đời; chưa đọc tồn kho hoặc ledger.").locator("..");
  await expect(stockCard).toBeVisible();
  await expect(stockCard.getByRole("button", { name: /Lưu|Post|Ghi sổ/ })).toHaveCount(0);
  await expect(page.locator(".dv-groupview")).toHaveCount(2);
});
test("missing persisted record presents read failure with retry and safe close", async ({
  page,
}) => {
  await inject(page, JSON.stringify(envelope("999999")));
  const p = page.getByRole("region", { name: "Chứng từ 999999", exact: true });
  await expect(p.getByRole("alert")).toContainText("Không tìm thấy");
  await b(p, "Thử đọc lại chứng từ").click();
  await expect(p.getByRole("alert")).toContainText("Không tìm thấy");
  await page
    .getByRole("tab", { name: "Sales 999999", exact: true })
    .getByRole("button", { name: "Close tab", exact: true })
    .click();
  await expect(p).toHaveCount(0);
  await expect(b(page, "Mở mẫu 1001")).toBeEnabled();
});
test("invalid raw cancel blocks reset restore and actor change; discard admits reset", async ({
  page,
}) => {
  const p = await open(page);
  const session = await p.getAttribute("data-session-id");
  const qty = await openDecimal(p, "qty");
  await qty.fill("-");
  await qty.press("Enter");
  await controls(page);
  for (const action of ["reset", "restore", "actor"]) {
    if (action === "actor")
      await page
        .getByLabel("Actor demo", { exact: true })
        .selectOption("workspace-other");
    else
      await b(
        page,
        action === "reset" ? "Đặt lại bố cục" : "Khôi phục bố cục",
      ).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await b(dialog, "Tiếp tục sửa").click();
    await expect(p).toHaveAttribute("data-session-id", session!);
    await expect(p.locator('.ag-row[row-index="0"] [col-id="qty"]')).toHaveText(
      "-",
    );
    await expect(page.getByLabel("Actor demo", { exact: true })).toHaveValue(
      "workspace-demo",
    );
  }
  await b(page, "Đặt lại bố cục").click();
  await b(page.getByRole("dialog"), "Bỏ thay đổi").click();
  await expect(p).toHaveCount(0);
  await expect(
    page.locator('section[aria-label="Danh sách Sales"]'),
  ).toBeVisible();
});
for (const mode of ["delay", "commit-then-response-lost"]) {
  test(`${mode} blocks reset restore and scope without discard`, async ({
    page,
  }) => {
    const p = await open(page);
    const session = await p.getAttribute("data-session-id");
    await controls(page);
    await page
      .getByLabel("Kết quả mutation", { exact: true })
      .selectOption(mode);
    await p.getByLabel("Ghi chú", { exact: true }).fill("Khóa mutation");
    await b(p, "Lưu chứng từ").click();
    await expect(b(p, "Lưu chứng từ")).toBeDisabled();
    for (const action of ["Đặt lại bố cục", "Khôi phục bố cục"]) {
      await b(page, action).click();
      await expect(page.getByText(/Giữ bố cục hiện tại/)).toBeVisible();
      await expect(p).toHaveAttribute("data-session-id", session!);
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await page
      .getByLabel("Actor demo", { exact: true })
      .selectOption("workspace-other");
    await expect(page.getByLabel("Actor demo", { exact: true })).toHaveValue(
      "workspace-demo",
    );
    await expect(p.getByLabel("Ghi chú", { exact: true })).toHaveValue(
      "Khóa mutation",
    );
  });
}
test("close save failure blocks layout replacement and preserves raw note", async ({
  page,
}) => {
  const p = await open(page);
  await controls(page);
  await page
    .getByLabel("Kết quả mutation", { exact: true })
    .selectOption("known-failure");
  await p.getByLabel("Ghi chú", { exact: true }).fill("Giữ sau lỗi save");
  await b(page, "Đặt lại bố cục").click();
  await b(page.getByRole("dialog"), "Lưu").click();
  await expect(p.getByRole("alert")).toContainText("chưa được thực hiện");
  await expect(p.getByLabel("Ghi chú", { exact: true })).toHaveValue(
    "Giữ sau lỗi save",
  );
  await expect(page.getByText(/Giữ bố cục hiện tại/)).toBeVisible();
});

test("same actor layout survives switching away and back then browser reload", async ({
  page,
}) => {
  const p = await open(page);
  const first = await p.getAttribute("data-session-id");
  await expect.poll(() => stored(page)).toContain("sales-1001");
  await controls(page);
  const actor = page.getByLabel("Actor demo", { exact: true });
  await actor.selectOption("workspace-other");
  await expect(actor).toBeEnabled();
  await actor.selectOption("workspace-demo");
  await expect(p.getByLabel("Ghi chú", { exact: true })).toBeVisible();
  await expect(p).not.toHaveAttribute("data-session-id", first!);
  const second = await p.getAttribute("data-session-id");
  await page.reload();
  await expect(p.getByLabel("Ghi chú", { exact: true })).toBeVisible();
  await expect(p).not.toHaveAttribute("data-session-id", second!);
});

test("remount during close save admission preserves split after failure", async ({
  page,
}) => {
  const a = await open(page);
  const idA = await a.getAttribute("data-session-id");
  const second = await open(page, "1002");
  const idB = await second.getAttribute("data-session-id");
  await b(page, "Tách sang phải").click();
  await expect(page.locator(".dv-groupview")).toHaveCount(2);
  await a.getByLabel("Ghi chú", { exact: true }).fill("giữ split sau lỗi save");
  await controls(page);
  await page
    .getByLabel("Kết quả mutation", { exact: true })
    .selectOption("delay");
  await b(page, "Đặt lại bố cục").click();
  await b(page.getByRole("dialog"), "Lưu").click();
  await expect(b(page, "Báo lỗi request-1")).toBeVisible();
  await page.getByRole("link", { name: "Components Lab", exact: true }).click();
  await page.getByRole("link", { name: "Sales Lab", exact: true }).click();
  await controls(page);
  await b(page, "Báo lỗi request-1").click();
  await expect(page.getByText(/Giữ bố cục hiện tại/)).toBeVisible();
  await expect(page.locator(".dv-groupview")).toHaveCount(2);
  await expect(a).toHaveAttribute("data-session-id", idA!);
  await expect(second).toHaveAttribute("data-session-id", idB!);
  await expect(a.getByLabel("Ghi chú", { exact: true })).toHaveValue(
    "giữ split sau lỗi save",
  );
});

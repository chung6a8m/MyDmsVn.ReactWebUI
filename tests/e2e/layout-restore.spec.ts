import { test, expect, type Page, type Locator } from "@playwright/test";
import { openDecimal } from "./decimal-helpers";
// Browser plugin not available; use the repository Chromium project against real UI.
const storageKey = "mydmsvn.workspace.layout.v1:workspace-demo";
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
async function inject(page: Page, value: string) {
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    {
      key: storageKey,
      value,
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
  await b(page, "Chứng từ mới").click();
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
  test(`untrusted ${mode} storage cannot restore arbitrary state`, async ({
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

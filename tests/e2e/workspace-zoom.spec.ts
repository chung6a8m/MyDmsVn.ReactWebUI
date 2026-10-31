import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
// Native tab zoom, verified with chrome.tabs.getZoom; not CSS zoom or device emulation.
// https://developer.chrome.com/docs/extensions/reference/api/tabs#method-setZoom
// Extension exists only in an isolated temporary browser profile for this test.
test("native browser zoom125 and200 preserves editing and usable controls", async ({}, testInfo) => {
  const dir = await mkdtemp(join(tmpdir(), "web07-zoom-"));
  await writeFile(
    join(dir, "manifest.json"),
    JSON.stringify({
      manifest_version: 3,
      name: "Local zoom acceptance",
      version: "1.0",
      permissions: ["tabs"],
      host_permissions: ["http://127.0.0.1/*"],
      background: { service_worker: "worker.js" },
    }),
  );
  await writeFile(
    join(dir, "worker.js"),
    "chrome.runtime.onInstalled.addListener(() => {});",
  );
  const context = await chromium.launchPersistentContext(join(dir, "profile"), {
    channel: "chromium",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    args: [
      `--disable-extensions-except=${dir}`,
      `--load-extension=${dir}`,
      "--window-size=1440,1000",
    ],
  });
  try {
    const errors: string[] = [];
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker"));
    await page.goto("http://127.0.0.1:5173/");
    await page
      .getByRole("button", { name: "Mở mẫu 1001", exact: true })
      .click();
    const panel = page.getByRole("region", {
      name: "Chứng từ 1001",
      exact: true,
    });
    const sessionId = await panel.getAttribute("data-session-id");
    const note = panel.getByLabel("Ghi chú", { exact: true });
    await note.fill("giữ qua zoom");
    for (const zoom of [1.25, 2]) {
      const actual = await worker.evaluate(
        `(async()=>{const [tab]=await chrome.tabs.query({url:'http://127.0.0.1:5173/*'});await chrome.tabs.setZoom(tab.id,${zoom});return chrome.tabs.getZoom(tab.id);})()`,
      );
      expect(actual).toBe(zoom);
      await expect(note).toBeFocused();
      await expect(note).toHaveValue("giữ qua zoom");
      await expect(panel).toHaveAttribute("data-session-id", sessionId!);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
      await note.focus();
      await note.press("End");
      await note.press("!");
      await expect(note).toBeFocused();
      await panel
        .getByRole("button", { name: "Lưu chứng từ", exact: true })
        .click();
      await expect(panel.getByRole("alert")).toContainText("Đã lưu");
      await page.getByRole("button", { name: "Dark", exact: true }).click();
      await expect(note).toHaveValue("giữ qua zoom!");
      await page.getByRole("button", { name: "Light", exact: true }).click();
      await note.fill("giữ qua zoom");
      await page.screenshot({ path: testInfo.outputPath(`zoom-${zoom}.png`) });
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep))
      throw Error("Unexpected temporary profile path");
    await rm(dir, { recursive: true, force: true });
  }
});

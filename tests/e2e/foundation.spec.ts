import { test, expect } from "@playwright/test";

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
]) {
  test(`default_libraries_render_and_switch_theme ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type()))
        errors.push(message.text());
    });
    for (const route of ["/", "/lab/sales", "/lab/components"]) {
      await page.goto(route);
      await expect(page).toHaveTitle("MyDmsVn Web UI");
      await expect(
        page.getByRole("heading", { name: "MyDmsVn" }),
      ).toBeVisible();
      const grid = page.getByRole("grid");
      await expect(grid).toBeVisible();
      expect((await grid.boundingBox())!.height).toBeGreaterThan(200);
      expect((await grid.boundingBox())!.width).toBeGreaterThan(300);
      await expect(
        page.getByRole("gridcell", { name: "Cà phê sữa", exact: true }),
      ).toBeVisible();
      // Keep references: theme changes must preserve the actual panel/grid DOM.
      const panel = await page
        .locator('[data-testid="foundation-grid"]')
        .elementHandle();
      for (const theme of ["Dark", "Light"]) {
        await page.getByRole("button", { name: theme, exact: true }).click();
        await expect(
          page.getByRole("button", { name: theme, exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator("html")).toHaveAttribute(
          "data-ag-theme-mode",
          theme.toLowerCase(),
        );
        expect(await panel!.evaluate((node) => node.isConnected)).toBe(true);
        await expect(
          page.getByRole("gridcell", { name: "Cà phê sữa", exact: true }),
        ).toBeVisible();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
}

test("unknown_scenario_falls_back_to_default", async ({ page }) => {
  await page.goto("/lab/sales?scenario=untrusted");
  await expect(
    page.getByText("Scenario: default", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("gridcell", { name: "Cà phê sữa", exact: true }),
  ).toBeVisible();
  await page.goto("/lab/components?scenario=empty-catalog");
  await expect(
    page.getByText("Scenario: empty-catalog", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".ag-overlay-no-rows-center"),
  ).toBeVisible();
});

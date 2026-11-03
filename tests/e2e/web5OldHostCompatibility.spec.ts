import { expect, test } from "@playwright/test";
import { draftRecords, opRecords, respond, setup } from "./helpers/web4RecoveryWorkspaceSetup";

// Controlled HTTP models the old host's absent v2 extension. It does not prove
// behavior of deployed old assets, IIS, SQL, a host transition, or rollback.
for (const stem of ["sales-create", "receipt-post"]) {
  test(`${stem}: explicit v2 check on an old-host response falls back to protected v1 without another write`, async ({ page }) => {
    const scenario = await setup(page, stem, "lost", { originalGrantOnly: true });
    let v2Reads = 0;
    await page.route("**/api/v2/**", route => {
      v2Reads++;
      expect(new URL(route.request().url()).pathname).toBe("/api/v2/operations/context");
      expect(route.request().method()).toBe("GET");
      return respond(route, { error: { code: "NotFound", message: "Old host", details: [] } }, 404);
    });
    await scenario.button.click();
    const operation = (await opRecords(page))[0];
    expect(operation.state).toBe("DISPATCHED");
    const before = (await draftRecords(page)).find(value => value.localDocumentId === stem)!;
    expect(v2Reads).toBe(0); expect(scenario.reads).toHaveLength(0); expect(scenario.writes).toHaveLength(1);
    await page.getByRole("button", { name: "Đối soát thao tác", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Bản nháp trên thiết bị" });
    await dialog.getByRole("button", { name: "Kiểm tra xử lý hỗ trợ", exact: true }).click();
    await expect.poll(async () => (await opRecords(page))[0].state).toBe("SETTLED");
    const settled = (await opRecords(page))[0];
    const after = (await draftRecords(page)).find(value => value.localDocumentId === stem)!;
    expect(settled.frozen).toEqual(operation.frozen);
    expect(after.snapshot.draft.lines.map(line => line.clientLineId)).toEqual(before.snapshot.draft.lines.map(line => line.clientLineId));
    expect(after.unresolvedOperation).toBe(false);
    expect(v2Reads).toBe(1); expect(scenario.reads).toHaveLength(1); expect(scenario.details).toHaveLength(0); expect(scenario.writes).toHaveLength(1);
  });
}

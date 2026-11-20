import { expect, type Page } from "@playwright/test";

// Product-only selectors: Lab intentionally retains the old direct pilot
// command buttons for its focused keyboard/session scenarios.
export type CreateModule = "sales" | "goods-receipt";
export type ProductModule = CreateModule | "inventory-balances" | "inventory-stock-card";
const creates: Record<CreateModule, string> = {
  sales: "Sales mới",
  "goods-receipt": "Phiếu nhập mới",
};
const moduleNames: Record<ProductModule, string> = {
  sales: "Bán hàng",
  "goods-receipt": "Phiếu nhập",
  "inventory-balances": "Tồn kho",
  "inventory-stock-card": "Thẻ kho",
};

export function productModuleButton(page: Page, module: ProductModule) {
  return page.getByRole("navigation", { name: "Chức năng" })
    .getByRole("button", { name: `Mở ${moduleNames[module]}`, exact: true });
}

export async function createProductDocument(page: Page, module: CreateModule) {
  await page.getByRole("button", { name: "Tạo chứng từ", exact: true }).click();
  await page.getByRole("menuitem", { name: creates[module], exact: true }).click();
}

export async function expectCreateEnabled(page: Page, module: CreateModule, enabled: boolean) {
  const trigger = page.getByRole("button", { name: "Tạo chứng từ", exact: true });
  if (!enabled) {
    // Other module may still have Write; never infer per-module denial from
    // the root trigger's enabled state alone.
    if (await trigger.isDisabled()) return;
  }
  await trigger.click();
  const entry = page.getByRole("menuitem", { name: creates[module], exact: true });
  if (enabled) await expect(entry).toBeEnabled();
  else await expect(entry).toBeDisabled();
  await page.keyboard.press("Escape");
}

export async function productWorkspaceAction(page: Page, name:
  "Tách sang phải" | "Đóng tài liệu" | "Đóng tab hiện tại" | "Đóng tất cả" | "Khôi phục bố cục" | "Đặt lại bố cục") {
  await page.getByRole("button", { name: "Tác vụ Workspace", exact: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

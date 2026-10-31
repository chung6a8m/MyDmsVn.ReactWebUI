import type { SalesDocument, ServerId } from "../../features/sales/contracts";
import type { SalesPort } from "../../ports/salesPort";

// Read-only document fixture for WEB-02; full SalesPort is WEB-06.
export function createWorkspaceDocument(saleId: ServerId): SalesDocument {
  const product = {
    id: "9007199254740993",
    code: "SP001",
    name: "Cà phê sữa",
    isActive: true,
  };
  const lines = Array.from({ length: 40 }, (_, index) => ({
    clientLineId: `fixture-${index}`,
    saleLineId: `${saleId}${String(index + 1).padStart(3, "0")}`,
    productId: product.id,
    qty: "1.0000",
    unitPrice: "0.0000",
    isGift: false,
  }));
  const saved = {
    saleId,
    expectedVersion: "workspace-v1",
    saleDate: "2026-10-31",
    customerId: "101",
    warehouseId: "201",
    employeeId: "301",
    note: "",
    lines,
  };
  return {
    saleId,
    saleNumber: `Sales ${saleId}`,
    version: "workspace-v1",
    status: "Draft",
    saved,
    references: {
      customer: {
        id: "101",
        code: "KH001",
        name: "Khách hàng mẫu",
        isActive: true,
      },
      warehouse: { id: "201", code: "K001", name: "Kho mẫu", isActive: true },
      employee: {
        id: "301",
        code: "NV001",
        name: "Nhân viên mẫu",
        isActive: true,
      },
    },
    lines: lines.map((line) => ({
      ...line,
      product,
      unit: "Hộp",
      lineAmount: "0.0000",
      costAmount: null,
    })),
    totalAmount: "0.0000",
    totalCost: null,
    grossProfit: null,
  };
}
export const readWorkspaceDocument: SalesPort["get"] = async (id, context) => {
  await Promise.resolve();
  if (context.signal.aborted)
    return {
      kind: "failed",
      error: {
        kind: "unavailable",
        code: "aborted",
        message: "Đã hủy đọc chứng từ.",
      },
    };
  if (!["1001", "1002"].includes(id))
    return {
      kind: "failed",
      error: {
        kind: "not-found",
        code: "workspace-fixture-only",
        message: "Không có chứng từ mẫu này.",
      },
    };
  return { kind: "success", value: createWorkspaceDocument(id) };
};

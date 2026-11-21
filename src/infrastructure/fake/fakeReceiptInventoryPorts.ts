import { createStore } from "zustand/vanilla";
import type { CatalogPort } from "../../ports/catalogPort";
import type { GoodsReceiptPort } from "../../ports/goodsReceiptPort";
import type { InventoryPort } from "../../ports/inventoryPort";
import type { PortContext, ReadResult, UiFailure } from "../../ports/portContracts";
import type { GoodsReceiptDocument, GoodsReceiptSaveSnapshot } from "../../features/goodsReceipt/contracts";
import type { InventoryPage, StockBalanceRow, StockCardRow } from "../../features/inventory/contracts";
import { validateGoodsReceipt } from "../../features/goodsReceipt/validation";
import { catalogFixtures } from "./fixtures";

export type LabReadMode = "ready" | "latency" | "empty" | "error" | "forbidden";

export function createLabReadScenarios() {
  const state = createStore<{ mode: LabReadMode; revision: number }>(() => ({ mode: "ready", revision: 0 }));
  return {
    state,
    setMode(mode: LabReadMode) {
      state.setState(previous => ({ mode, revision: previous.revision + 1 }));
    },
  };
}
export type LabReadScenarios = ReturnType<typeof createLabReadScenarios>;

const productOptions = [
  { id: "401", code: "SP401", name: "Cà phê sữa", unit: "Hộp", isActive: true },
  { id: "402", code: "SP402", name: "Trà sen", unit: "Hộp", isActive: true },
  { id: "403", code: "SP403", name: "Cà phê rang xay - gói dùng thử", unit: "Gói", isActive: true },
];
const allOptions = { ...catalogFixtures, product: productOptions };
export function createLabReceiptCatalog(): CatalogPort {
  return {
    async search(query, context) {
      await Promise.resolve();
      if (context.signal.aborted) return { kind: "failed", error: failure("unavailable", "Đã hủy đọc danh mục.") };
      const search = query.search.trim().normalize("NFC").toLocaleLowerCase("vi");
      return { kind: "success", value: allOptions[query.kind]
        .filter(value => value.isActive && (value.code + " " + value.name).normalize("NFC").toLocaleLowerCase("vi").includes(search))
        .slice(0, Math.min(25, query.limit)).map(value => ({ ...value })) };
    },
  };
}
const failure = (kind: UiFailure["kind"], message: string): UiFailure => ({ kind, code: "lab-" + kind, message });
const copy = <T>(value: T): T => structuredClone(value);
const rejected = (kind: UiFailure["kind"], message: string) => ({ kind: "failed" as const, error: failure(kind, message) });
const refs = {
  warehouse: { id: "201", displayName: "K001 · Kho mẫu", isActive: true },
  employee: { id: "301", displayName: "NV001 · Nhân viên mẫu", isActive: true },
};
function buildReceipt(snapshot: GoodsReceiptSaveSnapshot, id: string, version: string, status: "Draft" | "Posted" = "Draft"): GoodsReceiptDocument {
  const saved = {
    ...copy(snapshot),
    receiptId: id,
    expectedVersion: version,
    lines: snapshot.lines.map((line, index) => ({
      ...line, receiptLineId: line.receiptLineId ?? String(8000 + index + Number(id) * 10),
    })),
  };
  return {
    receiptId: id, receiptNumber: "PN-" + id, version, status,
    postedAtUtc: status === "Posted" ? "2026-11-20T08:30:00.1234567Z" : null,
    saved, references: copy(refs),
    lines: saved.lines.map((line, index) => ({
      ...line, lineNumber: index + 1,
      product: { id: line.productId!, displayName: productOptions.find(p => p.id === line.productId)?.name ?? null, isActive: true },
    })),
  };
}
function initialReceipt(id: string): GoodsReceiptDocument {
  return buildReceipt({
    receiptId: id, expectedVersion: "lab-v1", receiptDate: "2026-11-20",
    warehouseId: "201", employeeId: "301", note: "Phiếu nhập mẫu " + id,
    lines: [{ clientLineId: "seed-" + id, receiptLineId: null, productId: "401", quantity: "2.0000", unitCost: "12.5000" }],
  }, id, "lab-v1");
}
async function readGate(scenarios: LabReadScenarios, context: PortContext): Promise<UiFailure | null> {
  const mode = scenarios.state.getState().mode;
  if (mode === "latency") await new Promise<void>(resolve => setTimeout(resolve, 650));
  if (context.signal.aborted) return failure("unavailable", "Yêu cầu đọc đã bị hủy.");
  if (mode === "error") return failure("unavailable", "Lab mô phỏng lỗi đọc dữ liệu.");
  if (mode === "forbidden") return failure("forbidden", "Lab mô phỏng HTTP 403.");
  return null;
}
export function createFakeGoodsReceiptPort(scenarios: LabReadScenarios): GoodsReceiptPort {
  const documents = new Map(["1501", "1502", "1503"].map(id => [id, initialReceipt(id)]));
  let version = 1, nextId = 1800;
  return {
    async list(query, context) {
      const denied = await readGate(scenarios, context);
      if (denied) return { kind: "failed", error: denied };
      const items = scenarios.state.getState().mode === "empty" ? [] : [...documents.values()]
        .filter(doc => (!query.warehouseId || doc.saved.warehouseId === query.warehouseId) &&
          (!query.status || doc.status === query.status) &&
          (!query.search || (doc.receiptNumber + " " + (doc.saved.note ?? "")).toLocaleLowerCase("vi").includes(query.search.toLocaleLowerCase("vi"))))
        .sort((a, b) => Number(b.receiptId) - Number(a.receiptId));
      return { kind: "success", value: { items: copy(items.slice((query.pageNumber - 1) * query.pageSize, query.pageNumber * query.pageSize)),
        pageNumber: query.pageNumber, pageSize: query.pageSize, totalCount: String(items.length) } };
    },
    async get(id, context) {
      const denied = await readGate(scenarios, context);
      if (denied) return { kind: "failed", error: denied };
      const doc = documents.get(id);
      return doc ? { kind: "success", value: copy(doc) } : rejected("not-found", "Không tìm thấy phiếu nhập mẫu.");
    },
    async save(snapshot) {
      const issues = validateGoodsReceipt(snapshot);
      if (issues.length) return { kind: "failed", error: { ...failure("validation", "Kiểm tra dữ liệu phiếu nhập."), issues } };
      const existing = snapshot.receiptId ? documents.get(snapshot.receiptId) : undefined;
      if (snapshot.receiptId && (!existing || existing.version !== snapshot.expectedVersion || existing.status !== "Draft"))
        return rejected("conflict", "Phiếu nhập mẫu đã thay đổi.");
      const id = snapshot.receiptId ?? String(nextId++);
      const value = buildReceipt(snapshot, id, "lab-v" + ++version);
      documents.set(id, value);
      return { kind: "success", value: copy(value) };
    },
    async post(input) {
      const existing = documents.get(input.receiptId);
      if (!existing || existing.version !== input.expectedVersion || existing.status !== "Draft")
        return rejected("conflict", "Phiếu nhập mẫu không thể Post.");
      documents.set(input.receiptId, buildReceipt(existing.saved, existing.receiptId, existing.version, "Posted"));
      return { kind: "success", value: {
        receiptId: input.receiptId, status: "Posted" as const,
        postedAtUtc: "2026-11-20T08:30:00.1234567Z",
      } };
    },
  };
}

const balances: readonly StockBalanceRow[] = productOptions.slice(0, 2).map((p, i) => ({
  warehouseId: "201", warehouseCode: "K001", warehouseName: "Kho mẫu", warehouseIsActive: true,
  productId: p.id, productCode: p.code, productName: p.name, productIsActive: true,
  quantity: i ? "18.0000" : "120.0000", inventoryValue: i ? "360.0000" : "1500.0000", averageUnitCost: i ? "20.0000" : "12.5000",
}));
const ledger: readonly StockCardRow[] = [
  { ...balances[0], ledgerId: "lab-ledger-1", postedAtUtc: "2026-11-20T08:30:00.1234567Z",
    documentType: "GoodsReceipt", documentId: "1501", documentNumber: "PN-1501", quantityChange: "2.0000", valueChange: "25.0000" },
  { ...balances[0], ledgerId: "lab-ledger-2", postedAtUtc: "2026-11-20T09:00:00Z",
    documentType: "Sales", documentId: "1001", documentNumber: "Sales 1001", quantityChange: "-1.0000", valueChange: "-12.5000" },
];
function page<T>(items: readonly T[], pageNumber: number, pageSize: number): InventoryPage<T> {
  return { items: copy(items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize)),
    pageNumber, pageSize, totalCount: String(items.length) };
}
export function createFakeInventoryPort(scenarios: LabReadScenarios): InventoryPort {
  return {
    async balances(query, context): Promise<ReadResult<InventoryPage<StockBalanceRow>>> {
      const denied = await readGate(scenarios, context);
      if (denied) return { kind: "failed", error: denied };
      const search = query.search?.toLocaleLowerCase("vi") ?? "";
      const items = scenarios.state.getState().mode === "empty" ? [] : balances.filter(row =>
        (!query.warehouseId || query.warehouseId === row.warehouseId) &&
        (!query.productId || query.productId === row.productId) &&
        (!search || (row.productName + " " + row.productCode + " " + row.warehouseName).toLocaleLowerCase("vi").includes(search)));
      return { kind: "success", value: page(items, query.pageNumber, query.pageSize) };
    },
    async stockCard(query, context): Promise<ReadResult<InventoryPage<StockCardRow>>> {
      const denied = await readGate(scenarios, context);
      if (denied) return { kind: "failed", error: denied };
      const items = scenarios.state.getState().mode === "empty" ? [] : ledger.filter(row =>
        row.warehouseId === query.warehouseId && row.productId === query.productId &&
        (!query.fromUtc || row.postedAtUtc >= query.fromUtc) &&
        (!query.toUtc || row.postedAtUtc <= query.toUtc));
      return { kind: "success", value: page(items, query.pageNumber, query.pageSize) };
    },
  };
}

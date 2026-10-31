import type { CatalogKind, LookupOption } from "../../features/sales/contracts";

export const catalogFixtures: Record<CatalogKind, readonly LookupOption[]> = {
  product: [
    {
      id: "9007199254740993",
      code: "SP001",
      name: "Cà phê sữa",
      isActive: true,
      unit: "Hộp",
    },
    {
      id: "9007199254740994",
      code: "SP002",
      name: "Cà phê rang xay nguyên chất – gói dùng thử",
      isActive: true,
      unit: "Gói",
    },
    {
      id: "9007199254740995",
      code: "SP003",
      name: "Trà sen",
      isActive: true,
      unit: "Hộp",
    },
    {
      id: "9007199254740996",
      code: "SP004",
      name: "Cà phê ngừng bán",
      isActive: false,
      unit: "Hộp",
    },
  ],
  customer: [
    { id: "101", code: "KH001", name: "Khách hàng mẫu", isActive: true },
  ],
  warehouse: [{ id: "201", code: "K001", name: "Kho mẫu", isActive: true }],
  employee: [
    { id: "301", code: "NV001", name: "Nhân viên mẫu", isActive: true },
  ],
};

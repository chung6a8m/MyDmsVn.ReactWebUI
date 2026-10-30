import type { CatalogKind, LookupOption } from "../../features/sales/contracts";
import type { SessionIdentity } from "../../features/sales/salesSessionStore";
export interface LookupValue {
  selectedId: string | null;
  displayText: string;
  query: string;
  confirmed: boolean;
  composing: boolean;
}
export interface LookupScope extends SessionIdentity {
  clientLineId: string;
  catalogContext: string;
  catalogKind?: CatalogKind;
}
export const emptyLookup: LookupValue = {
  selectedId: null,
  displayText: "",
  query: "",
  confirmed: true,
  composing: false,
};
export function typeQuery(
  value: LookupValue,
  query: string,
  composing = false,
): LookupValue {
  return { ...value, query, confirmed: false, composing };
}
export function selectOption(option: LookupOption): LookupValue {
  return {
    selectedId: option.id,
    displayText: option.name,
    query: option.name,
    confirmed: true,
    composing: false,
  };
}
export function restoreSelection(value: LookupValue): LookupValue {
  return {
    ...value,
    query: value.displayText,
    confirmed: true,
    composing: false,
  };
}
export function lookupIssue(
  value: LookupValue,
  required = true,
): string | undefined {
  return value.composing
    ? "Hoàn tất nhập liệu."
    : !value.confirmed
      ? "Chọn sản phẩm hoặc khôi phục lựa chọn."
      : required && !value.selectedId
        ? "Cần chọn sản phẩm."
        : undefined;
}

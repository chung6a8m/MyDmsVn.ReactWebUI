// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GoodsReceiptProvider } from "../../../src/features/goodsReceipt/GoodsReceiptContext";
import { GoodsReceiptHeaderForm } from "../../../src/features/goodsReceipt/GoodsReceiptHeaderForm";
import { createGoodsReceiptWorkspaceAdapter } from "../../../src/features/goodsReceipt/goodsReceiptWorkspaceAdapter";
import { injectedRuntimeFixture } from "../../unit/workspace/injectedRuntimeFixture";
import { setup } from "../../unit/goodsReceipt/fixtures";
import "@testing-library/jest-dom/vitest";
import { GoodsReceiptFeedback } from "../../../src/features/goodsReceipt/GoodsReceiptFeedback";
import { GoodsReceiptDecimalEditor } from "../../../src/features/goodsReceipt/GoodsReceiptEditors";
import { WorkspaceProvider } from "../../../src/app/workspace/WorkspaceContext";
import { createWorkspaceRuntime } from "../../../src/app/workspace/panelRegistry";
afterEach(cleanup);
async function fixture() {
  const f = injectedRuntimeFixture();
  f.publish({ ...f.auth.getSnapshot(), features: { "goods-receipt": { read: true, write: true, post: true } } });
  const scope = () => f.auth.getSnapshot();
  const runtime = createGoodsReceiptWorkspaceAdapter({ auth: f.auth, catalog: f.catalog, port: setup().port, today: () => "2026-11-01" }, { scope, isCurrentScope: s => s.actorKey === scope().actorKey && s.actorGeneration === scope().actorGeneration, blocked: () => false, show: vi.fn(), remove: vi.fn() });
  const id = await runtime.feature.open("1001");
  return { ...f, runtime, id };
}
it("Receipt raw note composition stays in its own session and StrictMode releases subscription", async () => {
  const f = await fixture();
  const view = render(<StrictMode><GoodsReceiptProvider runtime={f.runtime}><GoodsReceiptHeaderForm sessionId={f.id} /></GoodsReceiptProvider></StrictMode>);
  const note = screen.getByLabelText("Ghi chú");
  fireEvent.compositionStart(note); fireEvent.change(note, { target: { value: "Tiếng Việt ệ" } });
  expect(f.runtime.store.getState().sessions[f.id].rawBuffers.note).toEqual({ raw: "Tiếng Việt ệ", composing: true });
  fireEvent.compositionEnd(note, { data: "ệ" });
  expect(f.runtime.store.getState().sessions[f.id].rawBuffers.note.composing).toBe(false);
  expect(f.observerCount()).toBe(1); view.unmount(); expect(f.observerCount()).toBe(0);
});
it("historical inactive names render and Receipt denial never inherits Sales Write", async () => {
  const f = await fixture();
  render(<GoodsReceiptProvider runtime={f.runtime}><GoodsReceiptHeaderForm sessionId={f.id} /></GoodsReceiptProvider>);
  expect((screen.getByRole("combobox", { name: "Nhân viên" }) as HTMLInputElement).value).toBe("Nhân viên");
  expect((screen.getByRole("combobox", { name: "Kho" }) as HTMLInputElement).value).toBe("ID 1");
  expect(screen.getByText("Ngừng hoạt động")).toBeTruthy();
  const { act } = await import("@testing-library/react");
  act(() => f.publish({ ...f.auth.getSnapshot(), features: undefined }));
  expect((screen.getByLabelText("Ghi chú") as HTMLInputElement).disabled).toBe(true);
  expect(f.runtime.writeBuffer(f.id, "note", "denied")).toBe(false);
  expect(f.runtime.store.getState().sessions[f.id].rawBuffers.note).toBeUndefined();
});
it("date note and server lookup errors describe their actual header controls", async () => {
  const f = await fixture(), workspace = createWorkspaceRuntime(f.dependencies);
  f.runtime.store.setState(s => ({ sessions: { ...s.sessions, [f.id]: { ...s.sessions[f.id], issues: [
    { code: "date", field: "receiptDate", message: "Ngày nhập không hợp lệ." },
    { code: "note", field: "note", message: "Ghi chú quá dài." },
    { code: "server", field: "warehouseId", message: "Kho đã bị khóa trên máy chủ." },
  ] } } }));
  render(<WorkspaceProvider workspace={workspace}><GoodsReceiptProvider runtime={f.runtime}><GoodsReceiptFeedback sessionId={f.id} /><GoodsReceiptHeaderForm sessionId={f.id} /></GoodsReceiptProvider></WorkspaceProvider>);
  for (const [name, message] of [["Ngày nhập", "Ngày nhập không hợp lệ."], ["Ghi chú", "Ghi chú quá dài."], ["Kho", "Kho đã bị khóa trên máy chủ."]] as const) {
    const input = screen.getByLabelText(name);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(message);
  }
});
it("numeric errors stay associated with stable line identity across row order", async () => {
  const f = await fixture(), workspace = createWorkspaceRuntime(f.dependencies), session = f.runtime.store.getState().sessions[f.id];
  const first = session.draft!.lines[0], second = { ...first, clientLineId: "second-stable-row" };
  f.runtime.store.setState(s => ({ sessions: { ...s.sessions, [f.id]: { ...session, draft: { ...session.draft!, lines: [second, first] }, issues: [
    { code: "server", field: `quantity:${first.clientLineId}`, clientLineId: first.clientLineId, message: "Số lượng sản phẩm đầu vượt giới hạn." },
    { code: "decimal", field: `quantity:${second.clientLineId}`, clientLineId: second.clientLineId, message: "Số lượng sản phẩm sau chưa hợp lệ." },
  ] } } }));
  const binding = (lineId: string, row: number) => ({ runtime: f.runtime, identity: session, lineId, row, kind: "quantity", onValueChange: vi.fn() }) as unknown as Parameters<typeof GoodsReceiptDecimalEditor>[0];
  render(<WorkspaceProvider workspace={workspace}><GoodsReceiptProvider runtime={f.runtime}><GoodsReceiptFeedback sessionId={f.id} /><GoodsReceiptDecimalEditor {...binding(second.clientLineId, 0)} /><GoodsReceiptDecimalEditor {...binding(first.clientLineId, 1)} /></GoodsReceiptProvider></WorkspaceProvider>);
  expect(screen.getByLabelText("Số lượng dòng 1")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByLabelText("Số lượng dòng 1")).toHaveAccessibleDescription("Số lượng sản phẩm sau chưa hợp lệ.");
  expect(screen.getByLabelText("Số lượng dòng 2")).toHaveAccessibleDescription("Số lượng sản phẩm đầu vượt giới hạn.");
});

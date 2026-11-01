// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GoodsReceiptProvider } from "../../../src/features/goodsReceipt/GoodsReceiptContext";
import { GoodsReceiptHeaderForm } from "../../../src/features/goodsReceipt/GoodsReceiptHeaderForm";
import { createGoodsReceiptWorkspaceAdapter } from "../../../src/features/goodsReceipt/goodsReceiptWorkspaceAdapter";
import { injectedRuntimeFixture } from "../../unit/workspace/injectedRuntimeFixture";
import { setup } from "../../unit/goodsReceipt/fixtures";
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

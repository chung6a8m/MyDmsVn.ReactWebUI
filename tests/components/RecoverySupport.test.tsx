// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RecoverySupport } from "../../src/app/workspace/RecoverySupport";
afterEach(cleanup);
const operationId = "11111111-2222-4333-8444-555555555555";
it("keeps protected actions disabled and copies identifier-only summary only on explicit admitted click", async () => {
  const writeText = vi.fn(async () => {}); Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  let allowed = true;
  render(<RecoverySupport metadata={{ operationId, correlationId: "token=private", snapshot: "private" }} current={() => allowed ? { operationId } : null} />);
  expect(writeText).not.toHaveBeenCalled();
  expect((screen.getByRole("button", { name: "Gửi lại đúng thao tác" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Mở khóa thao tác" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/chưa xác minh/i)).toBeTruthy(); expect(screen.queryByText(/private/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Sao chép thông tin hỗ trợ" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(`Mã thao tác: ${operationId}`));
  allowed = false; fireEvent.click(screen.getByRole("button", { name: "Sao chép thông tin hỗ trợ" }));
  expect(writeText).toHaveBeenCalledTimes(1);
});
it("keeps selectable identifiers and gives a recovery message when clipboard is unavailable", async () => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  render(<RecoverySupport metadata={{ operationId }} current={() => ({ operationId })} />);
  fireEvent.click(screen.getByRole("button", { name: "Sao chép thông tin hỗ trợ" }));
  expect((await screen.findByRole("status")).textContent).toContain("Chọn và sao chép các mã định danh ở trên");
});
it("requires an explicit confirmation, supports cancel, and consumes the resend action once", async () => {
  const prepare = vi.fn(async () => ({ operationId, operationKind: "Sales.Create" as const, documentLabel: "S-104", consumed: false }));
  const confirm = vi.fn(async () => ({ kind: "outcome-unknown" }));
  vi.spyOn(crypto, "randomUUID").mockReturnValue("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  render(<RecoverySupport metadata={{ operationId }} current={() => ({ operationId })} resend={{ prepare, confirm }} />);
  fireEvent.click(screen.getByRole("button", { name: "Gửi lại đúng thao tác" }));
  expect(await screen.findByRole("dialog", { name: "Gửi lại đúng thao tác gốc?" })).toBeTruthy();
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Gửi lại đúng thao tác" }));
  await screen.findByRole("dialog");
  const approve = screen.getByRole("button", { name: "Xác nhận gửi thao tác gốc" });
  fireEvent.click(approve); fireEvent.click(approve);
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  expect(confirm).toHaveBeenCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await waitFor(() => expect((screen.getByRole("button", { name: "Quyền gửi lại đã dùng" }) as HTMLButtonElement).disabled).toBe(true));
});

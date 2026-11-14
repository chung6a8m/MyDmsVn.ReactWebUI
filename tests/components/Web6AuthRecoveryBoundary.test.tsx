// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApplicationEntry } from "../../src/app/runtime/ApplicationEntry";
import { createProductionRuntime } from "../../src/app/runtime/createProductionRuntime";
import { RecoverySupport } from "../../src/app/workspace/RecoverySupport";
import { web6AuthHarness } from "../unit/http/web6AuthHarness";

afterEach(() => { cleanup(); vi.useRealTimers(); });
it.each([
  { boundary: "candidateMismatchOn", expiring: false }, { boundary: "eligibility401", expiring: false },
  { boundary: "eligibility401", expiring: true }, { boundary: "eligibility500", expiring: false },
] as const)("$boundary expiring=$expiring preserves the required auth/recovery presentation", async ({ boundary, expiring }) => {
  if (expiring) vi.useFakeTimers({ toFake: ["Date"] });
  const s = await web6AuthHarness(boundary, { expiresInMs: expiring ? 31_000 : undefined });
  const runtime = createProductionRuntime(s.auth, { fetch: s.fetcher, storage: null });
  const sessionId = await runtime.workspace.openSalesDocument(null);
  expect(runtime.workspace.store.getState().sessions[sessionId]).toBeDefined();
  let transmissions = 0;
  render(<ApplicationEntry auth={s.auth} createRuntime={() => ({ ...runtime, content:
    <RecoverySupport metadata={{ operationId: s.operation.operationId }} current={() => s.auth.getSnapshot().status === "authenticated" ? { operationId: s.operation.operationId } : null}
      resend={{ prepare: async () => { await s.prepare(); return null; }, confirm: async () => { transmissions++; } }} /> })} />);
  if (expiring) vi.setSystemTime(Date.now() + 1001);
  fireEvent.click(screen.getByRole("button", { name: "Gửi lại đúng thao tác" }));
  if (boundary === "eligibility401") {
    await screen.findByRole("region", { name: "Đăng nhập" });
    expect(screen.queryByRole("region", { name: "Thông tin hỗ trợ đối soát" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Gửi lại đúng thao tác" })).toBeNull();
    expect(screen.queryByText(s.operation.operationId, { exact: false })).toBeNull();
    expect(runtime.workspace.store.getState().sessions).toEqual({});
    expect(runtime.drafts.copySnapshot("sales", sessionId)).toBeNull();
    if (expiring) expect(s.requests.some(request => request.path === "/api/v3/operations/resend-context")).toBe(false);
  } else {
    await waitFor(() => expect((screen.getByRole("button", { name: "Gửi lại đúng thao tác" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole("region", { name: "Đăng nhập" })).toBeNull();
    expect(screen.getByRole("region", { name: "Thông tin hỗ trợ đối soát" })).toBeTruthy();
  }
  expect(screen.queryByRole("dialog", { name: "Gửi lại đúng thao tác gốc?" })).toBeNull();
  expect(transmissions).toBe(0);
  expect(s.requests.filter(request => request.method !== "GET")).toEqual(boundary === "eligibility401"
    ? [{ path: "/api/v1/auth/refresh", method: "POST" }] : []);
  runtime.workspace.dispose();
});

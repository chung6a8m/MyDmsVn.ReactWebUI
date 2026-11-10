// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ApplicationEntry } from "../../src/app/runtime/ApplicationEntry";
import { createProductionRuntime } from "../../src/app/runtime/createProductionRuntime";
import { RecoverySupport } from "../../src/app/workspace/RecoverySupport";
import { web6AuthHarness } from "../unit/http/web6AuthHarness";

afterEach(cleanup);
it.each(["candidateMismatchOn", "eligibility401", "eligibility500"] as const)("%s preserves the required auth/recovery presentation", async boundary => {
  const s = await web6AuthHarness(boundary);
  const runtime = createProductionRuntime(s.auth, { fetch: s.fetcher, storage: null });
  const sessionId = await runtime.workspace.openSalesDocument(null);
  expect(runtime.workspace.store.getState().sessions[sessionId]).toBeDefined();
  let transmissions = 0;
  render(<ApplicationEntry auth={s.auth} createRuntime={() => ({ ...runtime, content:
    <RecoverySupport metadata={{ operationId: s.operation.operationId }} current={() => s.auth.getSnapshot().status === "authenticated" ? { operationId: s.operation.operationId } : null}
      resend={{ prepare: async () => { await s.prepare(); return null; }, confirm: async () => { transmissions++; } }} /> })} />);
  fireEvent.click(screen.getByRole("button", { name: "Gửi lại đúng thao tác" }));
  if (boundary === "eligibility401") {
    await screen.findByRole("region", { name: "Đăng nhập" });
    expect(screen.queryByRole("region", { name: "Thông tin hỗ trợ đối soát" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Gửi lại đúng thao tác" })).toBeNull();
    expect(screen.queryByText(s.operation.operationId, { exact: false })).toBeNull();
    expect(runtime.workspace.store.getState().sessions).toEqual({});
    expect(runtime.drafts.copySnapshot("sales", sessionId)).toBeNull();
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

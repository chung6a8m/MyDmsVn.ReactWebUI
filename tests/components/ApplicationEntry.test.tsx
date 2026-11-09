// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApplicationEntry } from "../../src/app/runtime/ApplicationEntry";
import * as web6CandidateConfig from "../../src/app/runtime/web6CandidateConfig";
import { createAuthSession } from "../../src/infrastructure/http/authSession";
import type { AuthSession, AuthSnapshot } from "../../src/infrastructure/http/authSession";
import { ThemeContext } from "../../src/app/theme";
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function authenticated(): AuthSession {
  const snapshot: AuthSnapshot = {
    status: "authenticated", deploymentEpoch: "11111111-2222-4333-8444-555555555555", actorKey: "42", actorGeneration: 1,
    capabilities: { read: true, write: true, post: true },
    features: { sales: { read: true, write: true, post: true }, "goods-receipt": { read: true, write: true, post: true }, "inventory-balances": { read: true }, "inventory-stock-card": { read: true } },
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    bootstrap: async () => {},
    loadFeatureCapabilities: async () => false,
  } as unknown as AuthSession;
}

it("default ApplicationEntry creates a resend-disabled runtime", () => {
  vi.stubEnv("VITE_MYDMSVN_WEB6_CANDIDATE_ID", "");
  const configured = web6CandidateConfig.createConfiguredProductionRuntime;
  const createRuntime = vi.spyOn(web6CandidateConfig, "createConfiguredProductionRuntime")
    .mockImplementation(auth => ({ ...configured(auth), content: null }));
  render(<ThemeContext.Provider value={{ mode: "light", setMode: () => {} }}><ApplicationEntry auth={authenticated()} /></ThemeContext.Provider>);
  expect(createRuntime).toHaveBeenCalledOnce();
  const runtime = createRuntime.mock.results[0].value;
  expect(runtime.operations.manualResendEnabled).toBe(false);
  runtime.workspace.dispose();
});
it("keeps protected content hidden until authoritative bootstrap and clears password on submit", async () => {
  const fetcher = vi.fn<typeof fetch>();
  fetcher.mockResolvedValueOnce(new Response("{}", { status: 401 }));
  const auth = createAuthSession({ fetch: fetcher, storage: localStorage, lock: async work => work(), notify: () => {} });
  const factory = vi.fn();
  render(<ApplicationEntry auth={auth} createRuntime={factory} />);
  await waitFor(() => expect(screen.getByLabelText("Mật khẩu")).toBeTruthy());
  expect(factory).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Tên đăng nhập"), { target: { value: "a" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "private-password" } });
  fetcher.mockResolvedValueOnce(new Response("{}", { status: 401 }));
  fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect((screen.getByLabelText("Mật khẩu") as HTMLInputElement).value).toBe("");
  expect(localStorage.length).toBe(0);
  expect(factory).not.toHaveBeenCalled();
});

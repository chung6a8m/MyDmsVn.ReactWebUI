// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApplicationEntry } from "../../src/app/runtime/ApplicationEntry";
import { createAuthSession } from "../../src/infrastructure/http/authSession";
afterEach(cleanup);
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

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MutationState, ReadRequestError, ReadState, readErrorStatus } from "../../../src/shared/feedback/ReadState";

afterEach(cleanup);

it("distinguishes initial, loading, empty, no-match, forbidden and ready", () => {
  for (const state of ["initial", "loading", "empty", "no-match", "forbidden"] as const) {
    const view = render(<ReadState status={state} />);
    expect(screen.getByRole(state === "forbidden" ? "alert" : "status")).toHaveAttribute("data-read-state", state);
    expect(screen.queryByRole("button")).toBeNull();
    view.unmount();
  }
  render(<ReadState status="ready" />);
  expect(screen.queryByRole("status")).toBeNull();
});
it("offers only a caller-owned read retry for errors", () => {
  const retry = vi.fn();
  render(<ReadState status="error" message="Mất kết nối" onRetryRead={retry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Mất kết nối");
  fireEvent.click(screen.getByRole("button", { name: "Thử đọc lại" }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(readErrorStatus(new ReadRequestError("forbidden", "403"))).toBe("forbidden");
  expect(readErrorStatus(new ReadRequestError("unauthorized", "401"))).toBe("forbidden");
  expect(readErrorStatus(new ReadRequestError("unavailable", "offline"))).toBe("error");
});
it("shows pending and unknown as durable information, without a write retry", () => {
  const view = render(<MutationState state="pending" />);
  expect(screen.getByRole("status")).toHaveAttribute("data-mutation-state", "pending");
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(<MutationState state="outcome-unknown" />);
  expect(screen.getByRole("status")).toHaveTextContent("không tự gửi lại");
  view.rerender(<MutationState state="idle" />);
  expect(screen.queryByRole("status")).toBeNull();
});

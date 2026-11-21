// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { DecimalInput } from "../../../src/shared/inputs/DecimalInput";

afterEach(cleanup);

it("W7-DEC-01/02: preserves exact comma, extra zero, incomplete and 65-character raw through blur/remount", () => {
  const writes = vi.fn();
  function Owner() {
    const [raw, setRaw] = useState("1.0000"), [mounted, setMounted] = useState(true);
    return <>
      <button onClick={() => setMounted(!mounted)}>Toggle editor</button>
      {mounted && <DecimalInput aria-label="Owned decimal" value={raw}
        onRawChange={(next, composing) => { writes(next, composing); setRaw(next); }} />}
    </>;
  }
  render(<Owner />);
  const input = screen.getByRole("textbox", { name: "Owned decimal" });
  expect(input).toHaveAttribute("type", "text");
  expect(input).toHaveAttribute("inputmode", "decimal");
  for (const raw of ["0001,25000", "1.", "-", "9".repeat(65)]) {
    fireEvent.change(input, { target: { value: raw } });
    expect(input).toHaveValue(raw);
    expect(writes).toHaveBeenLastCalledWith(raw, false);
  }
  fireEvent.blur(input);
  expect(input).toHaveValue("9".repeat(65));
  fireEvent.click(screen.getByRole("button", { name: "Toggle editor" }));
  fireEvent.click(screen.getByRole("button", { name: "Toggle editor" }));
  expect(screen.getByRole("textbox", { name: "Owned decimal" })).toHaveValue("9".repeat(65));
});

it("W7-DEC-02: composition is caller-owned, Escape ignores IME and reaches AG Grid capture", () => {
  const writes = vi.fn(), restore = vi.fn(), gridCapture = vi.fn();
  function Owner() {
    const [raw, setRaw] = useState("1.0000");
    const [composing, setComposing] = useState(false);
    return <DecimalInput aria-label="IME decimal" value={raw} composing={composing}
      onRawChange={(next, active) => { writes(next, active); setRaw(next); setComposing(active); }}
      onEscape={restore} onKeyDownCapture={event => gridCapture(event.key)} />;
  }
  render(<Owner />);
  const input = screen.getByRole("textbox", { name: "IME decimal" });
  fireEvent.compositionStart(input);
  expect(input).toHaveAttribute("data-composing", "true");
  fireEvent.change(input, { target: { value: "1,2500" } });
  expect(writes).toHaveBeenLastCalledWith("1,2500", true);
  fireEvent.keyDown(input, { key: "Escape" });
  expect(restore).not.toHaveBeenCalled();
  expect(gridCapture).toHaveBeenCalledWith("Escape");
  fireEvent.compositionEnd(input);
  expect(writes).toHaveBeenLastCalledWith("1,2500", false);
  expect(input).toHaveAttribute("data-composing", "false");
  fireEvent.keyDown(input, { key: "Escape", isComposing: true });
  expect(restore).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(restore).toHaveBeenCalledOnce();
  // Shared control emits a cancel signal; it does not modify the owner's raw.
  expect(input).toHaveValue("1,2500");
});

it("W7-DEC-02: preserves stable field attributes, disabled/read-only and accessibility", () => {
  const write = vi.fn();
  const view = render(<>
    <div id="decimal-help">Giữ raw để kiểm tra.</div>
    <DecimalInput id="decimal-id" aria-label="Số lượng dòng 1" aria-describedby="decimal-help"
      aria-invalid="true" data-line-id="stable-client-line" tabIndex={-1}
      disabled value="1." onRawChange={write} />
  </>);
  const input = screen.getByRole("textbox", { name: "Số lượng dòng 1" });
  expect(input).toHaveAttribute("data-line-id", "stable-client-line");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAccessibleDescription("Giữ raw để kiểm tra.");
  expect(input).toHaveAttribute("tabindex", "-1");
  expect(input).toBeDisabled();
  view.rerender(<DecimalInput id="decimal-id" aria-label="Số lượng dòng 1"
    value="1." onRawChange={write} readOnly />);
  expect(input).toHaveAttribute("readonly");
  expect(input).not.toBeDisabled();
  expect(write).not.toHaveBeenCalled();
});

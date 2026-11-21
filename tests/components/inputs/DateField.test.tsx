// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { DateField } from "../../../src/shared/inputs/DateField";
import { DocumentField } from "../../../src/shared/forms/DocumentField";

afterEach(cleanup);

it("W7-DAT-01/02: caller retains exact invalid or composing raw across blur and field remount", () => {
  const writes = vi.fn();
  function Owner() {
    const [raw, setRaw] = useState("2026-11-20");
    const [mounted, setMounted] = useState(true);
    return <>
      <button onClick={() => setMounted(!mounted)}>Toggle</button>
      {mounted && <DocumentField id="owned-date" label="Ngày thử" required errors={["Ngày không hợp lệ."]}>
        {attrs => <DateField {...attrs} calendarLabel="Ngày thử" value={raw}
          onRawChange={(next, composing) => { writes(next, composing); setRaw(next); }} />}
      </DocumentField>}
    </>;
  }
  render(<Owner />);
  const input = screen.getByRole("textbox", { name: "Ngày thử" });
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAccessibleDescription("Ngày không hợp lệ.");
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: "2026-" } });
  expect(writes).toHaveBeenCalledWith("2026-", true);
  fireEvent.compositionEnd(input);
  expect(writes).toHaveBeenLastCalledWith("2026-", false);
  fireEvent.blur(input);
  expect(input).toHaveValue("2026-");
  fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
  fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
  expect(screen.getByRole("textbox", { name: "Ngày thử" })).toHaveValue("2026-");
});

it("W7-DAT-04: disabled and read-only date fields cannot open or write through calendar", () => {
  const write = vi.fn();
  const v = render(<DateField aria-label="Disabled date" calendarLabel="Disabled date"
    value="0001-01-01" onRawChange={write} disabled />);
  expect(screen.getByRole("button", { name: "Mở lịch Disabled date" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "Disabled date" })).toBeDisabled();
  v.rerender(<DateField aria-label="Disabled date" calendarLabel="Disabled date"
    value="0001-01-01" onRawChange={write} readOnly />);
  expect(screen.getByRole("button", { name: "Mở lịch Disabled date" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "Disabled date" })).toHaveAttribute("readonly");
  expect(write).not.toHaveBeenCalled();
});

// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { ProductLookup } from "../../../src/shared/lookup/ProductLookup";
import { LookupOverlayHost } from "../../../src/shared/lookup/LookupOverlayHost";
import {
  emptyLookup,
  selectOption,
} from "../../../src/shared/lookup/lookupTypes";
const option = { id: "1", code: "CF", name: "Cà phê", isActive: true };
const scope = {
  sessionId: "A",
  generation: 1,
  actorKey: "demo",
  actorGeneration: 1,
  clientLineId: "line",
  catalogContext: "default",
};
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 400,
    height: 200,
    top: 0,
    bottom: 200,
    left: 0,
    right: 400,
    toJSON() {},
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("synthetic_composition_retains_id_and_blocks_enter_until_confirmed", async () => {
  const search = vi.fn(async () => ({
    kind: "success" as const,
    value: [option],
  }));
  const port = { search };
  function Harness() {
    const [value, setValue] = useState(selectOption(option));
    return (
      <LookupOverlayHost>
        <ProductLookup
          label="Sản phẩm"
          value={value}
          onChange={setValue}
          scope={scope}
          port={port}
        />
        <output>{JSON.stringify(value)}</output>
      </LookupOverlayHost>
    );
  }
  render(<Harness />);
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: "Cà" } });
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(
    JSON.parse(document.querySelector("output")!.textContent!).selectedId,
  ).toBe("1");
  expect(search).toHaveBeenCalledTimes(1);
  fireEvent.compositionEnd(input, { data: "à" });
  await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByText("Khôi phục lựa chọn"));
  expect((input as HTMLInputElement).value).toBe("Cà phê");
  fireEvent.click(screen.getByText("Xóa lựa chọn"));
  expect(JSON.parse(document.querySelector("output")!.textContent!)).toEqual(
    emptyLookup,
  );
});
it("does_not_portal_without_an_owner", () => {
  render(
    <ProductLookup
      label="No host"
      value={emptyLookup}
      onChange={() => {}}
      scope={scope}
      port={{ search: async () => ({ kind: "success", value: [] }) }}
    />,
  );
  fireEvent.focus(screen.getByRole("combobox"));
  expect(screen.queryByRole("listbox")).toBeNull();
});
it.each([false, true])("blank lookup required=%s controls validation", (required) => {
 render(<ProductLookup label="Filter" value={emptyLookup} onChange={() => {}} scope={scope} port={{ search: async () => ({ kind: "success", value: [] }) }} {...{ required }} />);
 expect(screen.getByRole("combobox").getAttribute("aria-invalid")).toBe(String(required));
 expect(!!screen.queryByRole("status")).toBe(required);
});

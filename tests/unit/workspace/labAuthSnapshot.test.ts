import { expect, it } from "vitest";
import { createLabWorkspaceRuntime } from "../../../src/lab/runtime/createLabWorkspaceRuntime";

it("Lab auth snapshots remain stable between scope/capability changes for React subscriptions", () => {
  const w = createLabWorkspaceRuntime();
  const before = w.auth.getSnapshot();
  expect(w.auth.getSnapshot()).toBe(before);
  w.scenarios.setMode("delay");
  expect(w.auth.getSnapshot()).toBe(before);
  w.scenarios.setCapabilities({ write: false });
  const changed = w.auth.getSnapshot();
  expect(changed).not.toBe(before);
  expect(changed.capabilities.write).toBe(false);
  expect(w.auth.getSnapshot()).toBe(changed);
  w.dispose();
});

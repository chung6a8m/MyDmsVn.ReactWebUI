import { expect, it } from "vitest";
import { createWorkspaceRuntime } from "../../../src/app/workspace/panelRegistry";
import { createSalesCommands } from "../../../src/features/sales/salesCommands";
import type { SaveOutcome } from "../../../src/features/sales/contracts";

it("harness_note_save_uses_latest_buffer_and_preserves_line_ids", async () => {
  const w = createWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  const lines = w.store.getState().sessions[id].draft!.lines;
  w.writeBuffer(id, "note", "ký tự cuối");
  const commands = createSalesCommands(
    w.store,
    async (_identity, document) => ({ kind: "saved", document }),
  );
  expect((await commands.requestSave(id)).kind).toBe("saved");
  expect(w.store.getState().sessions[id]).toMatchObject({
    dirty: false,
    mutation: "idle",
    draft: { note: "ký tự cuối", lines },
  });
});

it("invalid_raw_blocks_before_harness_executor", async () => {
  const w = createWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  const line = w.store.getState().sessions[id].draft!.lines[0].clientLineId;
  w.writeBuffer(id, `qty:${line}`, "-");
  let calls = 0;
  const commands = createSalesCommands(w.store, async () => {
    calls++;
    return { kind: "outcome-unknown" };
  });
  expect((await commands.requestSave(id)).kind).toBe("blocked");
  expect(calls).toBe(0);
  expect(w.store.getState().sessions[id].rawBuffers[`qty:${line}`].raw).toBe(
    "-",
  );
});

it("deduplicates_pending_save_and_preserves_unknown_lock", async () => {
  const w = createWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  w.writeBuffer(id, "note", "before");
  let resolve!: (result: SaveOutcome) => void;
  let started!: () => void;
  const didStart = new Promise<void>((r) => (started = r));
  let calls = 0;
  const commands = createSalesCommands(w.store, () => {
    calls++;
    started();
    return new Promise((done) => {
      resolve = done;
    });
  });
  const saving = commands.requestSave(id);
  expect(commands.requestSave(id)).toBe(saving);
  w.writeBuffer(id, "note", "ignored while pending");
  expect(w.store.getState().sessions[id].rawBuffers.note.raw).toBe("before");
  await didStart;
  resolve({ kind: "outcome-unknown" });
  await saving;
  expect(w.store.getState().sessions[id].mutation).toBe("outcome-unknown");
  expect((await commands.requestSave(id)).kind).toBe("outcome-unknown");
  expect(w.finaliseSession(id)).toBe(false);
  expect(calls).toBe(1);
});

it("executor_exception_is_unknown_not_safe_to_discard", async () => {
  const w = createWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  const commands = createSalesCommands(w.store, async () => {
    throw new Error("lost response");
  });
  expect((await commands.requestSave(id)).kind).toBe("outcome-unknown");
  expect(w.store.getState().sessions[id].mutation).toBe("outcome-unknown");
});

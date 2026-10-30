import { publishLookup, restoreLookup } from "../../../src/shared/lookup/sessionLookup";
import { it, expect } from "vitest";
import { createWorkspaceRuntime } from "../../../src/app/workspace/panelRegistry";
import { createEditorBarrier } from "../../../src/shared/grid/editorBarrier";
async function setup() {
  const w = createWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  return {
    w,
    id,
    line: w.store.getState().sessions[id].draft!.lines[0].clientLineId,
    barrier: createEditorBarrier(w.store),
  };
}
it("save_immediately_after_last_keystroke_uses_new_revision", async () => {
  const { w, id, line, barrier } = await setup();
  w.writeBuffer(id, `qty:${line}`, "1,0001");
  const rev = w.store.getState().sessions[id].editRevision;
  const result = await barrier.prepareSave(id);
  expect(result.kind).toBe("ready");
  if (result.kind !== "ready") return;
  expect(result.snapshot.lines[0].qty).toBe("1.0001");
  expect(result.editRevision).toBe(rev);
  expect(Object.isFrozen(result.snapshot.lines[0])).toBe(true);
});
it("unmounted_editor_valid_buffer_is_flushed", async () => {
  const { w, id, line, barrier } = await setup();
  const unmount = barrier.register(id, async () => {});
  w.writeBuffer(id, `unitPrice:${line}`, "999999999999999,9999");
  w.writeBuffer(id, `qty:${line}`, "0.0001");
  unmount();
  const result = await barrier.prepareSave(id);
  expect(result.kind).toBe("ready");
  if (result.kind === "ready")
    expect(result.snapshot.lines[0].unitPrice).toBe("999999999999999.9999");
});
it("invalid_buffer_blocks_without_losing_text", async () => {
  const { w, id, line, barrier } = await setup();
  w.writeBuffer(id, `qty:${line}`, "-");
  const before = w.store.getState().sessions[id].rawBuffers;
  expect((await barrier.prepareSave(id)).kind).toBe("blocked");
  expect(w.store.getState().sessions[id].rawBuffers).toBe(before);
  w.writeBuffer(id, `qty:${line}`, "2", true);
  expect((await barrier.prepareSave(id)).kind).toBe("blocked");
});
it("serializes_prepare_waits_for_ack_and_locks_edits", async () => {
  const { w, id, barrier } = await setup();
  let ack!: () => void;
  barrier.register(id, () => new Promise<void>((r) => (ack = r)));
  w.writeBuffer(id, "note", "snapshot");
  const p = barrier.prepareSave(id);
  expect(barrier.prepareSave(id)).toBe(p);
  w.writeBuffer(id, "note", "must not win");
  expect(w.store.getState().sessions[id].rawBuffers.note.raw).toBe("snapshot");
  ack();
  const result = await p;
  expect(result.kind).toBe("ready");
});
it("late_ack_cannot_publish_into_replaced_generation", async () => {
  const { w, id, barrier } = await setup();
  let ack!: () => void;
  barrier.register(id, () => new Promise<void>((r) => (ack = r)));
  const p = barrier.prepareSave(id);
  w.store.setState((s) => ({
    sessions: { ...s.sessions, [id]: { ...s.sessions[id], generation: 2 } },
  }));
  ack();
  expect((await p).kind).toBe("blocked");
});

it("escape_restores_preedit_session_buffer", async () => {
  const { w, id, line } = await setup();
  const { restoreRaw } =
    await import("../../../src/features/sales/sessionEditing");
  const original = w.store.getState().sessions[id];
  w.writeBuffer(id, `qty:${line}`, "-");
  const rev = w.store.getState().sessions[id].editRevision;
  restoreRaw(w.store, original, `qty:${line}`, undefined);
  expect(
    w.store.getState().sessions[id].rawBuffers[`qty:${line}`],
  ).toBeUndefined();
  expect(w.store.getState().sessions[id].editRevision).toBe(rev + 1);
  expect(w.store.getState().sessions[id].dirty).toBe(false);
});

it("new_document_canonical_edit_is_dirty_and_close_requires_admission", async () => {
  const w = createWorkspaceRuntime();
  const id = await w.openSalesDocument(null);
  const { editDraft } =
    await import("../../../src/features/sales/sessionEditing");
  editDraft(w.store, w.store.getState().sessions[id], (d) => ({
    ...d,
    lines: d.lines.map((l) => ({ ...l, isGift: true })),
  }));
  expect(w.store.getState().sessions[id].dirty).toBe(true);
  const closing = w.close.requestClose(id, "tab");
  expect(w.close.state.getState().decisions).toHaveLength(1);
  await w.close.respond(id, "cancel");
  expect(await closing).toBe("cancelled");
});


it.each(["customerId", "warehouseId", "employeeId"] as const)("unconfirmed %s equal to ID still requires close admission", async (field) => {
  const { w, id, barrier } = await setup();
  const session = w.store.getState().sessions[id];
  const value = { selectedId: session.draft![field], displayText: "Nhãn", query: session.draft![field], confirmed: false, composing: false };
  publishLookup(w.store, session, field, value);
  expect(w.store.getState().sessions[id].dirty).toBe(true);
  expect((await barrier.prepareSave(id)).kind).toBe("blocked");
  const closing = w.close.requestClose(id, "tab");
  expect(w.close.state.getState().decisions).toHaveLength(1);
  await w.close.respond(id, "cancel");
  expect(await closing).toBe("cancelled");
  publishLookup(w.store, session, field, { ...value, query: "Nhãn", confirmed: true });
  expect(w.store.getState().sessions[id].dirty).toBe(false);
  restoreLookup(w.store, session, field, undefined);
  expect(w.store.getState().sessions[id].dirty).toBe(false);
});

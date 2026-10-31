import { describe, expect, it } from "vitest";
import { createLabWorkspaceRuntime } from "../../../src/lab/runtime/createLabWorkspaceRuntime";
import { createWorkspaceController } from "../../../src/app/workspace/workspaceController";
import type { SaveOutcome } from "../../../src/features/sales/contracts";

async function setup(
  save: (id: string) => Promise<SaveOutcome> = async () => ({
    kind: "failed",
    error: { kind: "unavailable", code: "test", message: "Save thất bại" },
  }),
) {
  const workspace = createLabWorkspaceRuntime();
  const a = await workspace.openSalesDocument("1001");
  const b = await workspace.openSalesDocument("1002");
  let finalisations = 0;
  const controller = createWorkspaceController({
    store: workspace.store,
    save,
    finalise: (id) => {
      finalisations++;
      return workspace.finaliseSession(id);
    },
  });
  return { workspace, controller, a, b, finalisations: () => finalisations };
}

describe("close admission", () => {
  it("repeated_close_and_close_all_join_an_already_pending_close_save", async () => {
    const w = createLabWorkspaceRuntime();
    const a = await w.openSalesDocument("1001");
    const b = await w.openSalesDocument("1002");
    w.writeBuffer(a, "note", "snapshot");
    w.scenarios.setMode("delay");
    const closing = w.close.requestClose(a, "tab");
    const saving = w.close.respond(a, "save");
    await new Promise<void>((resolve) => {
      if (w.store.getState().sessions[a].mutation === "pending")
        return resolve();
      const stop = w.store.subscribe((s) => {
        if (s.sessions[a].mutation === "pending") {
          stop();
          resolve();
        }
      });
    });
    expect(w.store.getState().sessions[a].mutation).toBe("pending");
    expect(w.close.requestClose(a, "middle-click")).toBe(closing);
    const all = w.close.closeAll("close-all");
    w.scenarios.complete(w.scenarios.state.getState().pending[0].requestId, "success");
    await saving;
    expect(await closing).toBe("closed");
    expect(await all).toBe("closed");
    expect(w.store.getState().sessions[a]).toBeUndefined();
    expect(w.store.getState().sessions[b]).toBeUndefined();
  });
  it("unknown_save_outcome_locks_the_session_even_with_an_injected_executor", async () => {
    const {
      workspace: w,
      controller: c,
      a,
    } = await setup(async () => ({ kind: "outcome-unknown" }));
    w.writeBuffer(a, "note", "locked");
    const closing = c.requestClose(a, "tab");
    await c.respond(a, "save");
    expect(await closing).toBe("blocked");
    expect(w.store.getState().sessions[a].mutation).toBe("outcome-unknown");
    expect(await c.requestClose(a, "tab")).toBe("blocked");
    expect(c.state.getState().decisions).toHaveLength(0);
  });
  it("invalid_buffer_can_discard_but_cancel_preserves", async () => {
    const { workspace: w, controller: c, a } = await setup();
    w.writeBuffer(a, "qty:invalid-line", "-");
    const before = w.store.getState().sessions[a];
    const cancel = c.requestClose(a, "tab");
    await c.respond(a, "cancel");
    expect(await cancel).toBe("cancelled");
    expect(w.store.getState().sessions[a]).toBe(before);
    const discard = c.requestClose(a, "middle-click");
    await c.respond(a, "discard");
    expect(await discard).toBe("closed");
    expect(w.store.getState().sessions[a]).toBeUndefined();
  });

  it("save_failure_does_not_close", async () => {
    const { workspace: w, controller: c, a, finalisations } = await setup();
    w.writeBuffer(a, "note", "chưa lưu");
    const closing = c.requestClose(a, "tab");
    await c.respond(a, "save");
    expect(await closing).toBe("blocked");
    expect(w.store.getState().sessions[a].rawBuffers.note.raw).toBe("chưa lưu");
    expect(c.state.getState().feedback[a]).toContain("Save thất bại");
    expect(finalisations()).toBe(0);
  });

  it.each(["pending", "outcome-unknown"] as const)(
    "pending_or_unknown_blocks_discard: %s",
    async (mutation) => {
      const { workspace: w, controller: c, a } = await setup();
      w.store.setState((state) => ({
        sessions: {
          ...state.sessions,
          [a]: { ...state.sessions[a], mutation },
        },
      }));
      expect(await c.requestClose(a, "command")).toBe("blocked");
      expect(c.state.getState().decisions).toHaveLength(0);
      await c.respond(a, "discard");
      expect(w.store.getState().sessions[a]).toBeDefined();
    },
  );

  it("close_all_stops_at_first_cancel", async () => {
    const { workspace: w, controller: c, a, b } = await setup();
    const third = await w.openSalesDocument(null);
    w.writeBuffer(b, "note", "dirty");
    const closing = c.closeAll("close-all");
    await Promise.resolve();
    await c.respond(b, "cancel");
    expect(await closing).toBe("cancelled");
    expect(w.store.getState().sessions[a]).toBeUndefined();
    expect(w.store.getState().sessions[b]).toBeDefined();
    expect(w.store.getState().sessions[third]).toBeDefined();
  });

  it("close_intent_does_not_change_target_after_await", async () => {
    const { workspace: w, controller: c, a, b } = await setup();
    w.writeBuffer(a, "note", "dirty");
    const closing = c.requestClose(a, "tab");
    w.commands.activate(b);
    await c.respond(a, "discard");
    expect(await closing).toBe("closed");
    expect(w.store.getState().sessions[a]).toBeUndefined();
    expect(w.store.getState().sessions[b]).toBeDefined();
  });

  it("repeated_close_and_save_share_one_intent_and_finalise_once", async () => {
    let resolve!: (value: SaveOutcome) => void;
    let calls = 0;
    const {
      workspace: w,
      controller: c,
      a,
      finalisations,
    } = await setup(() => {
      calls++;
      return new Promise((done) => {
        resolve = done;
      });
    });
    w.writeBuffer(a, "note", "dirty");
    const closing = c.requestClose(a, "tab");
    expect(c.requestClose(a, "middle-click")).toBe(closing);
    const saving = c.respond(a, "save");
    await c.respond(a, "save");
    const session = w.store.getState().sessions[a];
    w.store.setState((state) => ({
      sessions: { ...state.sessions, [a]: { ...session, dirty: false } },
    }));
    resolve({ kind: "saved", document: session.baseline! });
    await saving;
    expect(await closing).toBe("closed");
    expect(calls).toBe(1);
    expect(finalisations()).toBe(1);
  });

  it("save_acknowledgement_cannot_close_a_newer_revision", async () => {
    let resolve!: (value: SaveOutcome) => void;
    const {
      workspace: w,
      controller: c,
      a,
    } = await setup(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    w.writeBuffer(a, "note", "before");
    const closing = c.requestClose(a, "command");
    const saving = c.respond(a, "save");
    w.writeBuffer(a, "note", "after");
    resolve({
      kind: "saved",
      document: w.store.getState().sessions[a].baseline!,
    });
    await saving;
    expect(await closing).toBe("blocked");
    expect(w.store.getState().sessions[a].rawBuffers.note.raw).toBe("after");
  });

  it("rechecks_mutation_when_a_decision_is_already_open", async () => {
    const { workspace: w, controller: c, a } = await setup();
    w.writeBuffer(a, "note", "-");
    const closing = c.requestClose(a, "tab");
    w.store.setState((state) => ({
      sessions: {
        ...state.sessions,
        [a]: { ...state.sessions[a], mutation: "outcome-unknown" },
      },
    }));
    await c.respond(a, "discard");
    expect(await closing).toBe("blocked");
    expect(w.store.getState().sessions[a]).toBeDefined();
  });
});

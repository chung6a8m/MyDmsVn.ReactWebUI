import { describe, expect, it } from "vitest";
import { createLabWorkspaceRuntime } from "../../../src/lab/runtime/createLabWorkspaceRuntime";
import { createWorkspaceDocument } from "../../../src/infrastructure/fake/workspaceFixtures";
import type {
  ReadResult,
  SalesDocument,
} from "../../../src/features/sales/contracts";

describe("document session ownership", () => {
  it("clears_dirty_when_raw_matches_baseline_but_composition_remains_dirty", async () => {
    const workspace = createLabWorkspaceRuntime();
    const id = await workspace.openSalesDocument("1001");
    workspace.writeBuffer(id, "note", "x");
    workspace.writeBuffer(id, "note", "");
    expect(workspace.store.getState().sessions[id].dirty).toBe(false);
    workspace.writeBuffer(id, "note", "", true);
    expect(workspace.store.getState().sessions[id].dirty).toBe(true);
  });
  it("reopen_record_activates_existing_session", async () => {
    let reads = 0;
    const workspace = createLabWorkspaceRuntime(async (id) => {
      reads++;
      return { kind: "success", value: createWorkspaceDocument(id) };
    });
    const first = await workspace.openSalesDocument("1001");
    const line =
      workspace.store.getState().sessions[first].draft!.lines[0].clientLineId;
    workspace.writeBuffer(first, `qty:${line}`, "-", false);
    const second = await workspace.openSalesDocument("1001");
    expect(second).toBe(first);
    expect(reads).toBe(1);
    expect(workspace.commands.capture()?.sessionId).toBe(first);
    expect(workspace.store.getState().sessions[first]).toMatchObject({
      dirty: true,
      rawBuffers: { [`qty:${line}`]: { raw: "-" } },
    });
    const newA = await workspace.openSalesDocument(null);
    const newB = await workspace.openSalesDocument(null);
    expect(newA).not.toBe(newB);
  });

  it("move_panel_does_not_close_session", async () => {
    const workspace = createLabWorkspaceRuntime();
    const id = await workspace.openSalesDocument("1001");
    const original = workspace.store.getState().sessions[id];
    workspace.writeBuffer(id, "note", "chưa lưu");
    workspace.panelRemoved(id);
    workspace.panelAdded(id);
    const session = workspace.store.getState().sessions[id];
    expect(session.generation).toBe(original.generation);
    expect(session.requestGeneration).toBe(original.requestGeneration);
    expect(session.draft!.lines.map((line) => line.clientLineId)).toEqual(
      original.draft!.lines.map((line) => line.clientLineId),
    );
    expect(session.rawBuffers.note.raw).toBe("chưa lưu");
    expect(workspace.finaliseSession(id)).toBe(true);
    expect(workspace.finaliseSession(id)).toBe(false);
  });

  it("two_groups_route_to_focused_document", async () => {
    const workspace = createLabWorkspaceRuntime();
    const a = await workspace.openSalesDocument("1001");
    const b = await workspace.openSalesDocument("1002");
    workspace.commands.activate(a);
    const captured = workspace.commands.capture()!;
    workspace.commands.activate(b);
    expect(workspace.commands.capture()?.sessionId).toBe(b);
    workspace.commands.mark(captured);
    expect(workspace.store.getState().sessions[a].commandCount).toBe(1);
    expect(workspace.store.getState().sessions[b].commandCount).toBe(0);
    workspace.finaliseSession(a);
    expect(workspace.commands.mark(captured)).toBe(false);
    workspace.commands.activate(null);
    expect(workspace.commands.capture()).toBeNull();
  });

  it("deduplicates_pending_open_and_rejects_late_response_after_finalise", async () => {
    let resolve!: (result: ReadResult<SalesDocument>) => void;
    let reads = 0;
    const workspace = createLabWorkspaceRuntime(() => {
      reads++;
      return new Promise((done) => {
        resolve = done;
      });
    });
    const first = workspace.openSalesDocument("1001");
    const second = workspace.openSalesDocument("1001");
    const id = Object.keys(workspace.store.getState().sessions)[0];
    workspace.finaliseSession(id);
    resolve({ kind: "success", value: createWorkspaceDocument("1001") });
    expect(await first).toBe(await second);
    expect(reads).toBe(1);
    expect(workspace.store.getState().sessions[id]).toBeUndefined();
  });

  it("assigns_session_local_line_ids_even_for_duplicate_products", async () => {
    const workspace = createLabWorkspaceRuntime();
    const id = await workspace.openSalesDocument("1001");
    const lines = workspace.store.getState().sessions[id].draft!.lines;
    expect(lines[0].productId).toBe(lines[1].productId);
    expect(new Set(lines.map((line) => line.clientLineId)).size).toBe(
      lines.length,
    );
    expect(lines[0].clientLineId).not.toBe(lines[0].productId);
  });
});

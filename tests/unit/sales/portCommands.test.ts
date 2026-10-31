import { expect, it, vi } from "vitest";
import { createLabWorkspaceRuntime } from "../../../src/lab/runtime/createLabWorkspaceRuntime";
import { createSalesPortCommands } from "../../../src/features/sales/salesCommands";
import { createWorkspaceDocument } from "../../../src/infrastructure/fake/workspaceFixtures";
import type { SalesPort } from "../../../src/ports/salesPort";
import type {
  SalesDocument,
  SalesSaveSnapshot,
  WriteResult,
} from "../../../src/features/sales/contracts";

async function setup() {
  const w = createLabWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  const server = structuredClone(w.store.getState().sessions[id].baseline!);
  const port: SalesPort = {
    get: vi.fn(async () => ({ kind: "success" as const, value: server })),
    list: vi.fn(async () => ({
      kind: "success" as const,
      value: { items: [], nextCursor: null, previousCursor: null },
    })),
    save: vi.fn(async (snapshot: SalesSaveSnapshot) => ({
      kind: "success" as const,
      value: {
        ...server,
        version: "v2",
        saved: { ...snapshot, expectedVersion: "v2" },
      },
    })),
    post: vi.fn(async () => ({
      kind: "success" as const,
      value: {
        ...server,
        status: "Posted" as const,
        version: "v3",
        saved: { ...server.saved, expectedVersion: "v3" },
      },
    })),
  };
  const commands = createSalesPortCommands(w.store, port, w.barrier);
  return { w, id, port, commands, server };
}
it("post requires persisted clean draft and never auto-saves", async () => {
  const { w, id, port, commands } = await setup();
  w.writeBuffer(id, "note", "unsaved");
  expect((await commands.requestPost(id)).kind).toBe("blocked");
  expect(port.save).not.toHaveBeenCalled();
  expect(port.post).not.toHaveBeenCalled();
});
it("post pending prevents duplicate save/post; independent Write and Post", async () => {
  const { w, id, port, commands, server } = await setup();
  w.store.setState((s) => ({
    sessions: {
      ...s.sessions,
      [id]: {
        ...s.sessions[id],
        capabilities: { read: true, write: false, post: true },
      },
    },
  }));
  let resolve!: (r: WriteResult<SalesDocument>) => void;
  port.post = vi.fn(
    () =>
      new Promise<WriteResult<SalesDocument>>((r) => {
        resolve = r;
      }),
  );
  const post = commands.requestPost(id);
  expect(commands.requestPost(id)).toBe(post);
  expect((await commands.requestSave(id)).kind).toBe("blocked");
  resolve({
    kind: "success" as const,
    value: { ...server, status: "Posted" as const },
  });
  await post;
  expect(port.post).toHaveBeenCalledTimes(1);
  expect(w.store.getState().sessions[id].baseline?.status).toBe("Posted");
});
it("unknown update requires changed version AND business match then explicit confirmation", async () => {
  const { w, id, port, commands, server } = await setup();
  port.save = vi.fn(async () => ({ kind: "outcome-unknown" as const }));
  w.writeBuffer(id, "note", "sent");
  await commands.requestSave(id);
  await commands.inspectRecovery(id);
  expect(commands.confirmRecovery(id)).toBe(false);
  server.version = "other";
  await commands.inspectRecovery(id);
  expect(commands.confirmRecovery(id)).toBe(false);
  server.saved.note = "sent";
  server.saved.expectedVersion = "other";
  await commands.inspectRecovery(id);
  expect(w.store.getState().sessions[id].mutation).toBe("outcome-unknown");
  expect(w.store.getState().sessions[id].mutationSnapshot?.note).toBe("sent");
  expect(commands.confirmRecovery(id)).toBe(true);
  expect(w.store.getState().sessions[id].dirty).toBe(false);
  expect(port.save).toHaveBeenCalledTimes(1);
});
it("recovery read deny/error clears prior candidate and keeps lock", async () => {
  const { w, id, port, commands, server } = await setup();
  port.save = vi.fn(async () => ({ kind: "outcome-unknown" as const }));
  await commands.requestSave(id);
  server.version = "new";
  await commands.inspectRecovery(id);
  port.get = vi.fn(async () => ({
    kind: "failed" as const,
    error: { kind: "forbidden" as const, code: "denied", message: "Denied" },
  }));
  await commands.inspectRecovery(id);
  expect(commands.confirmRecovery(id)).toBe(false);
  expect(w.store.getState().sessions[id].mutation).toBe("outcome-unknown");
});
it("create unknown never replays; manual candidate requires content match and confirmation", async () => {
  const { w, port, server } = await setup();
  const id = await w.openSalesDocument(null);
  const draft: SalesSaveSnapshot = {
    ...server.saved,
    saleId: null,
    expectedVersion: null,
    lines: server.saved.lines.map((l) => ({ ...l, saleLineId: null })),
  };
  w.store.setState((s) => ({
    sessions: {
      ...s.sessions,
      [id]: { ...s.sessions[id], draft, dirty: true },
    },
  }));
  port.save = vi.fn(async () => ({ kind: "outcome-unknown" as const }));
  const commands = createSalesPortCommands(w.store, port, w.barrier);
  await commands.requestSave(id);
  expect((await commands.requestSave(id)).kind).toBe("outcome-unknown");
  expect(commands.confirmRecovery(id)).toBe(false);
  await commands.inspectRecovery(id, "1001");
  expect(commands.confirmRecovery(id)).toBe(true);
  expect(w.store.getState().sessions[id].saleId).toBe("1001");
  expect(port.save).toHaveBeenCalledTimes(1);
});
it("line issues map using submitted snapshot identity and fieldless remains visible", async () => {
  const { w, id, port, commands } = await setup();
  const line = w.store.getState().sessions[id].draft!.lines[1];
  port.save = vi.fn(async () => ({
    kind: "failed" as const,
    error: {
      kind: "validation" as const,
      code: "bad",
      message: "Global failure",
      issues: [
        { code: "price", field: "lines[1].unitPrice", message: "bad price" },
        { code: "global", field: "", message: "fieldless" },
      ],
    },
  }));
  await commands.requestSave(id);
  expect(w.store.getState().sessions[id].issues?.[0]).toMatchObject({
    clientLineId: line.clientLineId,
    field: `unitPrice:${line.clientLineId}`,
  });
  expect(w.store.getState().sessions[id].feedback).toContain("Global failure");
});
it("create binds record to same session and preserves duplicate line identities", async () => {
  const w = createLabWorkspaceRuntime();
  const id = await w.openSalesDocument(null);
  const source = createWorkspaceDocument("1001").saved;
  const draft = {
    ...source,
    saleId: null,
    expectedVersion: null,
    lines: source.lines.slice(0, 2).map((l) => ({
      ...l,
      saleLineId: null,
      clientLineId: crypto.randomUUID(),
    })),
  };
  w.store.setState((s) => ({
    sessions: {
      ...s.sessions,
      [id]: { ...s.sessions[id], draft, dirty: true },
    },
  }));
  const r = await w.sales.requestSave(id);
  expect(r.kind).toBe("saved");
  const saved = w.store.getState().sessions[id];
  expect(await w.openSalesDocument(saved.saleId)).toBe(id);
  expect(saved.draft!.lines.map((l) => l.clientLineId)).toEqual(
    draft.lines.map((l) => l.clientLineId),
  );
  expect(new Set(saved.draft!.lines.map((l) => l.saleLineId)).size).toBe(2);
});
it("conflict reload is explicit, preserves raw until confirmed and reuses server line mapping", async () => {
  const w = createLabWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  const original = w.store
    .getState()
    .sessions[id].draft!.lines.map((l) => l.clientLineId);
  w.writeBuffer(id, "note", "my local note");
  w.scenarios.setMode("version-conflict");
  await w.sales.requestSave(id);
  await w.sales.inspectReload(id);
  expect(w.store.getState().sessions[id].rawBuffers.note.raw).toBe(
    "my local note",
  );
  expect(w.sales.confirmReload(id)).toBe(true);
  expect(w.store.getState().sessions[id].draft!.note).toBe("");
  expect(
    w.store.getState().sessions[id].draft!.lines.map((l) => l.clientLineId),
  ).toEqual(original);
});
it("late save cannot apply to a replacement actor generation", async () => {
  const w = createLabWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  w.scenarios.setMode("delay");
  w.writeBuffer(id, "note", "old actor");
  const saving = w.sales.requestSave(id);
  await Promise.resolve();
  await Promise.resolve();
  w.store.setState((s) => ({
    sessions: {
      ...s.sessions,
      [id]: {
        ...s.sessions[id],
        actorGeneration: 2,
        mutation: "idle",
        draft: { ...s.sessions[id].draft!, note: "new actor" },
      },
    },
  }));
  w.scenarios.complete(w.scenarios.state.getState().pending[0].requestId);
  await saving;
  expect(w.store.getState().sessions[id].draft!.note).toBe("new actor");
});
it("delayed commit can lose response while retaining authoritative evidence", async () => {
  const w = createLabWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  w.scenarios.setMode("delay");
  w.writeBuffer(id, "note", "commit then lose");
  const saving = w.sales.requestSave(id);
  await Promise.resolve();
  await Promise.resolve();
  w.scenarios.complete(
    w.scenarios.state.getState().pending[0].requestId,
    "commit-then-response-lost",
  );
  expect((await saving).kind).toBe("outcome-unknown");
  await w.sales.inspectRecovery(id);
  expect(w.store.getState().sessions[id].recovery?.eligible).toBe(true);
});
it("recovery ignores out-of-order reads and never confirms a read for another identity", async () => {
  const { w, id, port, commands, server } = await setup();
  port.save = async () => ({ kind: "outcome-unknown" });
  await commands.requestSave(id);
  let resolveFirst!: (r: { kind: "success"; value: SalesDocument }) => void;
  port.get = () =>
    new Promise((r) => {
      resolveFirst = r;
    });
  const first = commands.inspectRecovery(id);
  port.get = async () => ({
    kind: "failed",
    error: { kind: "forbidden", code: "denied", message: "Denied" },
  });
  await commands.inspectRecovery(id);
  resolveFirst({ kind: "success", value: { ...server, version: "new" } });
  await first;
  expect(commands.confirmRecovery(id)).toBe(false);
  port.get = async () => ({
    kind: "success",
    value: { ...server, saleId: "9999", version: "new" },
  });
  await commands.inspectRecovery(id);
  expect(commands.confirmRecovery(id)).toBe(false);
});
it("post lost response uses Posted evidence only after explicit confirmation", async () => {
  const w = createLabWorkspaceRuntime();
  const id = await w.openSalesDocument("1001");
  w.scenarios.setMode("commit-then-response-lost");
  expect((await w.sales.requestPost(id)).kind).toBe("outcome-unknown");
  w.scenarios.setReadMode("old-version");
  await w.sales.inspectRecovery(id);
  expect(w.sales.confirmRecovery(id)).toBe(false);
  w.scenarios.setReadMode("success");
  await w.sales.inspectRecovery(id);
  expect(w.store.getState().sessions[id].mutation).toBe("outcome-unknown");
  expect(w.sales.confirmRecovery(id)).toBe(true);
  expect(w.store.getState().sessions[id].baseline?.status).toBe("Posted");
});
it("eventual unknown create stays locked after empty lists until commit and manual matching Get", async () => {
  const w = createLabWorkspaceRuntime();
  const id = await w.openSalesDocument(null);
  const seed = createWorkspaceDocument("1001").saved;
  w.store.setState((s) => ({
    sessions: {
      ...s.sessions,
      [id]: {
        ...s.sessions[id],
        draft: {
          ...seed,
          saleId: null,
          expectedVersion: null,
          note: "unique-create",
          lines: seed.lines
            .slice(0, 1)
            .map((l) => ({ ...l, saleLineId: null })),
        },
        dirty: true,
      },
    },
  }));
  w.scenarios.setMode("eventual-commit");
  await w.sales.requestSave(id);
  const q = { search: "unique-create", pageSize: 10 };
  const empty = await w.port.list(q, w.portContext());
  expect(empty.kind === "success" && empty.value.items.length).toBe(0);
  expect((await w.sales.requestSave(id)).kind).toBe("outcome-unknown");
  expect(w.scenarios.state.getState().pending).toHaveLength(1);
  w.scenarios.complete(w.scenarios.state.getState().pending[0].requestId);
  const candidates = await w.port.list(q, w.portContext());
  if (candidates.kind !== "success") throw Error("list");
  await w.sales.inspectRecovery(id, candidates.value.items[0].saleId);
  expect(w.sales.confirmRecovery(id)).toBe(true);
});
it("editing during reload invalidates preview without leaving read action permanently loading", async () => {
  const { w, id, port, commands, server } = await setup();
  let resolve!: (r: { kind: "success"; value: SalesDocument }) => void;
  port.get = () =>
    new Promise((r) => {
      resolve = r;
    });
  const reading = commands.inspectReload(id);
  w.writeBuffer(id, "note", "new edit");
  resolve({ kind: "success", value: server });
  await reading;
  expect(w.store.getState().sessions[id].recovery?.loading).toBe(false);
  expect(commands.confirmReload(id)).toBe(false);
  expect(w.store.getState().sessions[id].rawBuffers.note.raw).toBe("new edit");
});
it("Post recovery reconciles changed authoritative lines by server identity, never index", async () => {
  const { w, id, port, commands, server } = await setup();
  const before = w.store.getState().sessions[id].draft!.lines;
  port.post = async () => ({ kind: "outcome-unknown" });
  await commands.requestPost(id);
  const reversed = [...server.saved.lines].reverse();
  const added = {
    ...reversed[0],
    saleLineId: "999000",
    clientLineId: "other-materialization",
  };
  const lines = [added, ...reversed];
  const posted = {
    ...server,
    status: "Posted" as const,
    version: "posted-new",
    saved: { ...server.saved, lines, expectedVersion: "posted-new" },
    lines: lines.map((l) => ({ ...server.lines[0], ...l })),
  };
  port.get = async () => ({ kind: "success", value: posted });
  await commands.inspectRecovery(id);
  expect(commands.confirmRecovery(id)).toBe(true);
  const actual = w.store.getState().sessions[id].draft!.lines;
  expect(actual[1].clientLineId).toBe(before.at(-1)!.clientLineId);
  expect(before.some((l) => l.clientLineId === actual[0].clientLineId)).toBe(
    false,
  );
  expect(new Set(actual.map((l) => l.clientLineId)).size).toBe(actual.length);
});

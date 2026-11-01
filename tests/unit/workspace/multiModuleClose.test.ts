import { describe, expect, it, vi } from "vitest";
import { createWorkspaceController } from "../../../src/app/workspace/workspaceController";
import type { ActorScope, DocumentCloseAdapter, DocumentIdentity, DocumentModule } from "../../../src/app/workspace/documentContracts";

function setup() {
  let scope: ActorScope = { actorKey: "actor-a", actorGeneration: 1 };
  const docs = new Map<string, ReturnType<typeof add>>();
  function add(id: string, module: DocumentModule, dirty = false) {
    let identity: DocumentIdentity = { ...scope, sessionId: id, module, generation: 1, editRevision: 0 };
    let blocked = false;
    let save: () => Promise<"saved-clean" | "blocked" | "failed" | "unknown"> = async () => { dirty = false; return "saved-clean"; };
    const same = (candidate: DocumentIdentity) => candidate.actorKey === identity.actorKey &&
      candidate.actorGeneration === identity.actorGeneration && candidate.sessionId === identity.sessionId &&
      candidate.module === identity.module && candidate.generation === identity.generation &&
      candidate.editRevision === identity.editRevision;
    const adapter: DocumentCloseAdapter = {
      captureIdentity: () => ({ ...identity }),
      title: () => `${module} ${id}`,
      isCloseBlocked: () => blocked,
      isDirtyIncludingRaw: () => dirty,
      prepareAndSave: vi.fn(() => save()),
      mayFinalise: (candidate) => docs.has(id) && !blocked && same(candidate),
      finaliseAfterAdmission: (candidate) => {
        if (!adapter.mayFinalise(candidate)) return false;
        docs.delete(id);
        return true;
      },
    };
    const entry = { adapter, mutate: () => { identity = { ...identity, editRevision: identity.editRevision + 1 }; dirty = true; }, block: () => { blocked = true; }, save: (handler: typeof save) => { save = handler; }, clean: () => { dirty = false; } };
    docs.set(id, entry);
    return entry;
  }
  const controller = createWorkspaceController({
    scope: () => ({ ...scope }),
    isCurrentScope: (candidate) => candidate.actorKey === scope.actorKey && candidate.actorGeneration === scope.actorGeneration,
    documents: (candidate) => [...docs.values()].map((value) => value.adapter).filter((adapter) => {
      const current = adapter.captureIdentity();
      return current.actorKey === candidate.actorKey && current.actorGeneration === candidate.actorGeneration;
    }),
    getAdapter: (id) => docs.get(id)?.adapter,
  });
  return { controller, docs, add, switchActor: () => { scope = { actorKey: "actor-b", actorGeneration: 2 }; } };
}

describe("module-neutral close admission", () => {
  it("captures all feature membership including detached documents and preserves sequential closes", async () => {
    const { controller: close, docs, add } = setup();
    add("sale", "sales");
    add("receipt", "goods-receipt", true);
    add("detached-sale", "sales");
    const closing = close.closeAll("close-all");
    expect(close.state.getState().busy).toBe(true);
    await Promise.resolve();
    expect(docs.has("sale")).toBe(false);
    expect(close.state.getState().decisions[0].module).toBe("goods-receipt");
    await close.respond("receipt", "cancel");
    expect(await closing).toBe("cancelled");
    expect([...docs.keys()]).toEqual(["receipt", "detached-sale"]);
    expect(close.state.getState().busy).toBe(false);
  });

  it("blocks a changed revision captured before the confirmation without invoking save", async () => {
    const { controller: close, add, docs } = setup();
    const receipt = add("receipt", "goods-receipt", true);
    const closing = close.requestClose("receipt", "tab");
    receipt.mutate();
    await close.respond("receipt", "save");
    expect(await closing).toBe("blocked");
    expect(receipt.adapter.prepareAndSave).not.toHaveBeenCalled();
    expect(docs.has("receipt")).toBe(true);
  });

  it("rejects discard after an actor switch while confirmation is open", async () => {
    const { controller: close, add, docs, switchActor } = setup();
    add("receipt", "goods-receipt", true);
    const closing = close.requestClose("receipt", "tab");
    switchActor();
    await close.respond("receipt", "discard");
    expect(await closing).toBe("blocked");
    expect(docs.has("receipt")).toBe(true);
  });

  it("rechecks actor after a delayed save and retains the old private session", async () => {
    const { controller: close, add, docs, switchActor } = setup();
    const receipt = add("receipt", "goods-receipt", true);
    let done!: (result: "saved-clean") => void;
    receipt.save(() => new Promise((resolve) => { done = resolve; }));
    const closing = close.requestClose("receipt", "tab");
    const saving = close.respond("receipt", "save");
    switchActor();
    receipt.clean();
    done("saved-clean");
    await saving;
    expect(await closing).toBe("blocked");
    expect(docs.has("receipt")).toBe(true);
  });

  it("does not report close-all success if a feature added a document during admission", async () => {
    const { controller: close, add, docs } = setup();
    add("sale", "sales", true);
    const closing = close.closeAll("close-all");
    add("late", "goods-receipt");
    await close.respond("sale", "discard");
    expect(await closing).toBe("blocked");
    expect([...docs.keys()]).toEqual(["late"]);
  });

  it("pending or unknown receipt blocks close-all after earlier admitted Sales closes", async () => {
    const { controller: close, add, docs } = setup();
    add("sale", "sales");
    add("receipt", "goods-receipt").block();
    expect(await close.closeAll("close-all")).toBe("blocked");
    expect([...docs.keys()]).toEqual(["receipt"]);
  });

  it("keeps the membership snapshot revision while an earlier document awaits a decision", async () => {
    const { controller: close, add, docs } = setup();
    add("sale", "sales", true);
    const receipt = add("receipt", "goods-receipt", true);
    const closing = close.closeAll("close-all");
    receipt.mutate();
    await close.respond("sale", "discard");
    expect(await closing).toBe("blocked");
    expect([...docs.keys()]).toEqual(["receipt"]);
    expect(close.state.getState().decisions).toHaveLength(0);
  });

  it("does not close when save reports clean but a new raw revision exists", async () => {
    const { controller: close, add, docs } = setup();
    const receipt = add("receipt", "goods-receipt", true);
    receipt.save(async () => { receipt.mutate(); receipt.clean(); return "saved-clean"; });
    const closing = close.requestClose("receipt", "command");
    await close.respond("receipt", "save");
    expect(await closing).toBe("blocked");
    expect(docs.has("receipt")).toBe(true);
  });
});

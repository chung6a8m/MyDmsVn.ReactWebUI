import type { GoodsReceiptDocument, GoodsReceiptSaveSnapshot } from "../../../src/features/goodsReceipt/contracts";
import { createGoodsReceiptSessionStore, type GoodsReceiptSession } from "../../../src/features/goodsReceipt/goodsReceiptSessionStore";
import type { GoodsReceiptPort } from "../../../src/ports/goodsReceiptPort";
export function document(snapshot?: GoodsReceiptSaveSnapshot, version = "v1"): GoodsReceiptDocument {
  const saved: GoodsReceiptSaveSnapshot = { receiptId: "1001", expectedVersion: version, receiptDate: "2026-11-01", warehouseId: "1", employeeId: "2", note: null,
    lines: [{ clientLineId: "local-row", receiptLineId: "2001", productId: "3", quantity: "1.0000", unitCost: "2.0000" }], ...snapshot };
  saved.receiptId = snapshot?.receiptId ?? "1001"; saved.expectedVersion = version;
  saved.lines = saved.lines.map((line, index) => ({ ...line, receiptLineId: String(2001 + index) }));
  return { receiptId: saved.receiptId, receiptNumber: "GR0000001001", version, status: "Draft", postedAtUtc: null, saved,
    references: { warehouse: { id: saved.warehouseId, displayName: null, isActive: true }, employee: { id: saved.employeeId, displayName: "Nhân viên", isActive: false } },
    lines: saved.lines.map((line, i) => ({ ...line, lineNumber: i + 1, product: { id: line.productId!, displayName: null, isActive: true } })) };
}
export function setup() {
  const store = createGoodsReceiptSessionStore(); const server = document();
  const session: GoodsReceiptSession = { sessionId: "session", actorKey: "actor", actorGeneration: 1, generation: 1, requestGeneration: 1,
    receiptId: server.receiptId, draft: structuredClone(server.saved), baseline: server, rawBuffers: {}, lookupBuffers: {}, editRevision: 0, dirty: false,
    status: "ready", mutation: "idle", capabilities: { read: true, write: true, post: true }, commandCount: 0, view: {} };
  store.setState({ sessions: { session }, activeSessionId: "session" });
  const port: GoodsReceiptPort = { get: async () => ({ kind: "success", value: server }), list: async () => ({ kind: "success", value: { items: [], pageNumber: 1, pageSize: 25, totalCount: "0" } }),
    save: async snapshot => ({ kind: "success", value: document(snapshot, "v2") }), post: async () => ({ kind: "success", value: { receiptId: "1001", status: "Posted", postedAtUtc: "2026-11-01T00:00:00Z" } }) };
  const patch = (change: Partial<GoodsReceiptSession>) => store.setState(state => ({ sessions: { ...state.sessions, session: { ...state.sessions.session, ...change } } }));
  return { store, server, session, port, patch, live: () => store.getState().sessions.session };
}
export function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

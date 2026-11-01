import { createStore } from "zustand/vanilla";
import { decodeDraftRecord, draftKey, DraftRepositoryError, type DraftKey, type DraftRecord } from "../../infrastructure/drafts/draftRecord";
import type { DraftListResult, DraftRepository } from "../../infrastructure/drafts/indexedDbDraftRepository";
import type { LocalDraftPersistence } from "../../infrastructure/drafts/localDraftPersistence";

export function createDurableDraftWorkspace(options: {
  repository: DraftRepository;
  persistence: LocalDraftPersistence;
  isCurrent(): boolean;
  ready(): boolean;
  allowed(feature: DraftKey["feature"]): boolean;
  isLive(key: DraftKey): boolean;
  restore(record: DraftRecord): string;
  validateRestore?(record: DraftRecord): Promise<boolean>;
  restored?(record: DraftRecord, id: string): void;
}) {
  const state = createStore<DraftListResult & { loading: boolean; message: string }>(() => ({ records: [], quarantined: [], conflicts: [], loading: false, message: "" }));
  let disposed = false, revision = 0;
  const active = () => !disposed && options.isCurrent() && options.ready();
  const admitted = (key: DraftKey) => active() && key.deploymentEpoch === options.persistence.namespace.deploymentEpoch &&
    key.actorKey === options.persistence.namespace.actorKey && options.allowed(key.feature) && !options.isLive(key);
  const equalKey = (a: DraftKey, b: DraftKey) => JSON.stringify(draftKey(a)) === JSON.stringify(draftKey(b));
  function report(error: unknown) {
    if (active()) state.setState({ message: error instanceof DraftRepositoryError && error.code === "conflict"
      ? "Bản nháp đã thay đổi ở phiên khác. Đọc lại danh sách để đối chiếu; dữ liệu đang mở được giữ nguyên."
      : "Chưa thể đọc hoặc xóa bản nháp trên thiết bị. Dữ liệu chưa được xóa; hãy thử lại lưu cục bộ." });
  }
  async function review() {
    const request = ++revision;
    if (!active()) { state.setState({ records: [], quarantined: [], conflicts: [], loading: false }); return; }
    state.setState(previous => ({ loading: true, message: "", records: previous.records.filter(record => options.allowed(record.feature)),
      conflicts: previous.conflicts.filter(conflict => options.allowed(conflict.feature)) }));
    try {
      const result = await options.repository.list(options.persistence.namespace);
      if (!active() || request !== revision) return;
      const records = result.records.map(record => decodeDraftRecord(record, { ...record, ...options.persistence.namespace })).filter(record => options.allowed(record.feature));
      state.setState({ ...result, records, loading: false });
    } catch (error) { if (request === revision && active()) { report(error); state.setState({ loading: false }); } }
  }
  async function selected(key: DraftKey, sequence: number) {
    if (!admitted(key) || !state.getState().records.some(record => equalKey(record, key) && record.localPersistSequence === sequence)) return;
    const result = await options.repository.read(key);
    if (!admitted(key)) return;
    if (result.kind !== "available" || result.record.localPersistSequence !== sequence) throw new DraftRepositoryError("conflict");
    return decodeDraftRecord(result.record, { ...key, ...options.persistence.namespace });
  }
  return { state, review,
    async retryReview() {
      if (!active()) return;
      try { options.repository.retryConnection?.(); await review(); } catch (error) { report(error); }
    },
    async restore(key: DraftKey, sequence: number): Promise<string> {
      try {
        const record = await selected(key, sequence);
        if (!record || !admitted(key)) return "";
        if (options.validateRestore && !await options.validateRestore(record)) throw new DraftRepositoryError("invalid-record");
        if (!admitted(key)) return "";
        options.persistence.adopt(record);
        const id = options.restore(record);
        if (!id) { options.persistence.release(record); throw new DraftRepositoryError("conflict"); }
        options.restored?.(record, id);
        state.setState(previous => ({ records: previous.records.filter(value => !equalKey(value, key)), message: "Đã mở bản nháp cục bộ. Phiên bản máy chủ có thể đã thay đổi; nội dung và phiên bản gốc được giữ nguyên." }));
        return id;
      } catch (error) { report(error); return ""; }
    },
    async discard(key: DraftKey, sequence: number): Promise<boolean> {
      try {
        const record = await selected(key, sequence);
        if (!record || record.unresolvedOperation || !admitted(key)) return false;
        await options.repository.delete(record, sequence);
        if (!active()) return false;
        state.setState(previous => ({ records: previous.records.filter(value => !equalKey(value, key)), message: "Đã xóa bản nháp cục bộ đã chọn." }));
        return true;
      } catch (error) { report(error); return false; }
    },
    dispose() { disposed = true; revision++; state.setState({ records: [], quarantined: [], conflicts: [], loading: false, message: "" }); },
  };
}
export type DurableDraftWorkspace = ReturnType<typeof createDurableDraftWorkspace>;

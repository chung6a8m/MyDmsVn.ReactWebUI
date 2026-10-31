import { useState } from "react";
import { useStore } from "zustand";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useWorkspace } from "../../app/workspace/WorkspaceContext";
import { identityMatches } from "./salesSessionStore";
import type { SalesPage } from "./contracts";
export function SalesFeedback({ sessionId }: { sessionId: string }) {
  const w = useWorkspace();
  const session = useStore(w.store, (s) => s.sessions[sessionId]);
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<SalesPage>();
  const [listMessage, setListMessage] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [listing, setListing] = useState(false);
  if (!session) return null;
  const recovery = session.recovery;
  const unknown = session.mutation === "outcome-unknown";
  async function findCandidates(cursor?: string) {
    if (listing || !session) return;
    setListing(true);
    setListMessage("");
    setCandidates(undefined);
    try {
      const result = await w.port.list(
        { search, pageSize: 10, cursor },
        w.portContext(),
      );
      if (!identityMatches(w.store.getState().sessions[sessionId], session))
        return;
      if (result.kind === "failed") setListMessage(result.error.message);
      else {
        setCandidates(result.value);
        setListMessage(
          result.value.items.length
            ? "Chọn ứng viên để đọc và đối chiếu; không tự liên kết."
            : "Không tìm thấy ứng viên; tiếp tục giữ khóa, không tạo lại.",
        );
      }
    } catch {
      setListMessage("Không đọc được danh sách; tiếp tục giữ khóa.");
    } finally {
      setListing(false);
    }
  }
  return (
    <div className="px-4">
      {session.feedback && (
        <p role="alert" tabIndex={-1}>
          {session.feedback}
        </p>
      )}
      {!!session.issues?.length && (
        <ul aria-label="Lỗi chứng từ">
          {session.issues.map((i, n) => (
            <li key={n} data-line-id={i.clientLineId}>
              {i.message}
            </li>
          ))}
        </ul>
      )}
      {session.baseline && (
        <p>
          {session.baseline.saleNumber} · {session.postAcknowledgement?.status ?? session.baseline.status} · version{" "}
          {session.postAcknowledgement?.version ?? session.baseline.version} · Tổng {session.baseline.totalAmount}
          {(session.postAcknowledgement?.postedAtUtc ?? session.baseline.postedAtUtc) && ` · Post lúc ${session.postAcknowledgement?.postedAtUtc ?? session.baseline.postedAtUtc}`}
          {session.baseline.status === "Posted"
            ? ` · Chi phí ${session.baseline.totalCost} · Lợi nhuận ${session.baseline.grossProfit}`
            : session.postAcknowledgement ? " · Chi tiết/chi phí chưa có; đọc lại để review."
            : ""}
        </p>
      )}
      {session.saleId && session.mutation === "idle" && (
        <details className="py-2">
          <summary>Đọc lại / review conflict</summary>
          <Button
            variant="outline"
            disabled={session.preparing || recovery?.loading}
            onClick={() => void w.sales.inspectReload(sessionId)}
          >
            Đọc lại để review
          </Button>
          {recovery && <p>{recovery.message}</p>}
          {recovery?.document && (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap">
              {JSON.stringify(recovery.document.saved, null, 2)}
            </pre>
          )}
          <Button
            variant="outline"
            disabled={
              !recovery?.eligible ||
              recovery.loading ||
              recovery.editRevision !== session.editRevision
            }
            onClick={() => w.sales.confirmReload(sessionId)}
          >
            Xác nhận bỏ bản sửa và dùng bản đọc
          </Button>
        </details>
      )}
      {unknown && (
        <section aria-label="Đối soát kết quả" className="space-y-2 py-2">
          <p>
            Giữ nguyên snapshot đã gửi. Không retry, không Discard khi kết quả
            chưa rõ.
          </p>
          <p>
            Snapshot đối soát chỉ nằm trong bộ nhớ. Tải lại hoặc đóng trang sẽ mất snapshot; không tự gửi lại thao tác ghi.
          </p>
          {!session.saleId && (
            <>
              <div className="flex flex-wrap gap-2">
                <Input
                  aria-label="Tìm ứng viên"
                  disabled={listing}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCandidates(undefined);
                  }}
                />
                <Button
                  disabled={listing}
                  onClick={() => void findCandidates()}
                >
                  Tìm ứng viên qua list
                </Button>
              </div>
              {listMessage && <p role="status">{listMessage}</p>}
              <div className="flex flex-wrap gap-2">
                {candidates?.items.map((c) => (
                  <Button
                    key={c.saleId}
                    variant="outline"
                    onClick={() => {
                      setCandidateId(c.saleId);
                      void w.sales.inspectRecovery(sessionId, c.saleId);
                    }}
                  >
                    Đối chiếu {c.saleId}
                  </Button>
                ))}
                {candidates?.nextCursor && (
                  <Button
                    variant="outline"
                    onClick={() => void findCandidates(candidates.nextCursor!)}
                  >
                    Ứng viên tiếp
                  </Button>
                )}
              </div>
              <label>
                ID ứng viên
                <Input
                  aria-label="ID ứng viên"
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                />
              </label>
            </>
          )}
          <Button
            variant="outline"
            disabled={recovery?.loading}
            onClick={() => void w.sales.inspectRecovery(sessionId, candidateId)}
          >
            Đọc lại để đối soát
          </Button>
          {recovery && <p role="status">{recovery.message}</p>}
          <div className="grid gap-2 md:grid-cols-2">
            <details>
              <summary>Snapshot gốc đã gửi</summary>
              <pre
                data-testid="mutation-snapshot"
                className="max-h-48 overflow-auto whitespace-pre-wrap"
              >
                {JSON.stringify(session.mutationSnapshot, null, 2)}
              </pre>
            </details>
            {recovery?.document && (
              <details open>
                <summary>
                  Bản đọc authoritative · {recovery.document.saleId} ·{" "}
                  {recovery.document.status}
                </summary>
                <pre
                  data-testid="recovery-document"
                  className="max-h-48 overflow-auto whitespace-pre-wrap"
                >
                  {JSON.stringify(recovery.document.saved, null, 2)}
                </pre>
              </details>
            )}
          </div>
          <Button
            disabled={
              !recovery?.eligible ||
              recovery.loading ||
              (!session.saleId && candidateId !== recovery.document?.saleId)
            }
            onClick={() => w.sales.confirmRecovery(sessionId)}
          >
            Xác nhận dùng bản authoritative
          </Button>
        </section>
      )}
    </div>
  );
}

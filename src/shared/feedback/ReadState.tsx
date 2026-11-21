import { Button } from "../../components/ui/button";
import type { UiFailure } from "../../ports/portContracts";

/** A failed read is not a failed write; only the caller may supply a read retry. */
export class ReadRequestError extends Error {
  constructor(readonly kind: UiFailure["kind"], message: string) {
    super(message);
    this.name = "ReadRequestError";
  }
}
export type ReadStatus = "initial" | "loading" | "empty" | "no-match" | "error" | "forbidden" | "ready";

export function readErrorStatus(error: unknown): "error" | "forbidden" {
  return error instanceof ReadRequestError &&
      (error.kind === "forbidden" || error.kind === "unauthorized")
    ? "forbidden"
    : "error";
}

const defaults: Record<Exclude<ReadStatus, "ready">, string> = {
  initial: "Chọn bộ lọc để bắt đầu đọc dữ liệu.",
  loading: "Đang tải dữ liệu…",
  empty: "Chưa có dữ liệu.",
  "no-match": "Không có dữ liệu khớp bộ lọc.",
  error: "Không thể đọc dữ liệu. Bộ lọc hiện tại được giữ nguyên.",
  forbidden: "Không có quyền đọc dữ liệu này.",
};

/** Presentation only: no query, retry, cache or mutation ownership. */
export function ReadState({
  status,
  message,
  onRetryRead,
}: {
  status: ReadStatus;
  message?: string;
  onRetryRead?: () => void;
}) {
  if (status === "ready") return null;
  return (
    <div
      data-read-state={status}
      role={status === "error" || status === "forbidden" ? "alert" : "status"}
      className="mx-4 my-2 flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
    >
      <span>{message || defaults[status]}</span>
      {status === "error" && onRetryRead && (
        <Button type="button" size="sm" variant="outline" onClick={onRetryRead}>
          Thử đọc lại
        </Button>
      )}
    </div>
  );
}

/** Never offers a write retry or suggests that an unknown mutation rolled back. */
export function MutationState({ state }: { state: "idle" | "pending" | "outcome-unknown" }) {
  if (state === "idle") return null;
  return (
    <p className="my-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm" role="status" data-mutation-state={state}>
      {state === "pending"
        ? "Đang thực hiện thao tác. Không đóng chứng từ cho đến khi có kết quả."
        : "Chưa xác định kết quả ghi. Giữ nguyên thao tác để đối soát; không tự gửi lại hoặc coi là đã rollback."}
    </p>
  );
}

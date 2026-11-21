import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { MutationState, ReadState, type ReadStatus } from "../shared/feedback/ReadState";

/** DEV-only simulation: the same read/mutation UI used in production, without real writes. */
export function ReadStateStates({ initialOpen = false }: { initialOpen?: boolean }) {
  const [expanded, setExpanded] = useState(initialOpen);
  const [filter, setFilter] = useState("Cà phê");
  const [applied, setApplied] = useState("");
  const [status, setStatus] = useState<ReadStatus>("initial");
  const [mutation, setMutation] = useState<"idle" | "pending" | "outcome-unknown">("idle");
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  function simulate(next: ReadStatus) {
    const request = ++generation.current;
    const captured = filter;
    setStatus("loading");
    // A second filter/input invalidates the first response, even if its timeout finishes last.
    window.setTimeout(() => {
      if (request !== generation.current) return;
      setApplied(captured);
      setStatus(next);
    }, 400);
  }

  return <details className="relative" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary className="cursor-pointer rounded-md border px-2 py-1 text-sm font-medium">ReadState · filters / latency / recovery</summary>
    <div className="absolute right-0 top-full z-50 mt-2 flex w-[min(90vw,28rem)] flex-col gap-2 rounded-lg border bg-background p-4 shadow-lg" data-testid="lab-read-states">
      <label className="text-sm">Bộ lọc mẫu
        <Input aria-label="Bộ lọc mẫu" value={filter} onChange={event => {
          generation.current++;
          setFilter(event.target.value);
          setStatus("initial");
          setApplied("");
        }} />
      </label>
      <div className="flex flex-wrap gap-1">
        {([["ready", "Có dữ liệu"], ["empty", "Rỗng"], ["no-match", "Không khớp"], ["error", "Lỗi"], ["forbidden", "403"]] as const)
          .map(([next, label]) => <Button key={next} type="button" size="xs" variant="outline"
            onClick={() => simulate(next)}>{label}</Button>)}
      </div>
      <ReadState status={status} message={status === "error" ? "Mô phỏng lỗi đọc; giữ bộ lọc." : undefined}
        onRetryRead={status === "error" ? () => simulate("ready") : undefined} />
      {status === "ready" && <p role="status">Kết quả của bộ lọc: {applied}</p>}
      <p className="text-xs text-muted-foreground">Chọn Lỗi rồi đổi bộ lọc trước 400ms: kết quả cũ không hiện. Không phát request ghi.</p>
      <div className="flex flex-wrap gap-1">
        {(["idle", "pending", "outcome-unknown"] as const).map(next =>
          <Button key={next} type="button" size="xs" variant="outline" onClick={() => setMutation(next)}>{next}</Button>)}
      </div>
      <MutationState state={mutation} />
    </div>
  </details>;
}

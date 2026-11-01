import { useStore } from "zustand";
import type { IDockviewPanelProps } from "dockview";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useLabWorkspace } from "./runtime/LabProvider";
export function ReceiptWorkspaceProbe({ params, api }: IDockviewPanelProps<{ sessionId: string }>) {
  const w = useLabWorkspace();
  const session = useStore(w.receipt.store, state => state.sessions[params.sessionId]);
  if (!session || !w.isCurrentScope(session)) return null;
  return <section className="space-y-3 p-4" aria-label={`Nhập kho stub ${session.serverId ?? "mới"}`} data-session-id={session.sessionId}
    onFocusCapture={() => { api.setActive(); w.commands.activate(session.sessionId); }}>
    <p>WEB3-02 · Receipt lifetime stub qua fake port; chưa có nghiệp vụ nhập kho.</p>
    <label>Raw Receipt<Input aria-label="Raw Receipt" value={session.raw} disabled={session.mutation !== "idle"} onChange={event => w.receipt.write(session.sessionId, event.target.value)} /></label>
    <p>Trạng thái stub: {session.mutation} · Lệnh: {session.commandCount}</p>
    <Button onClick={() => w.receipt.setMutation(session.sessionId, "pending")}>Stub pending</Button>
    <Button onClick={() => w.receipt.setMutation(session.sessionId, "outcome-unknown")}>Stub unknown</Button>
    <Button onClick={() => w.receipt.setMutation(session.sessionId, "idle")}>Stub đối soát</Button>
  </section>;
}
function ReadOnlyProbe({ api }: IDockviewPanelProps) {
  const w = useLabWorkspace();
  const panel = useStore(w.panelState, state => state.panels[api.id]);
  return <section className="p-4" aria-label={panel?.title ?? "Read-only stub"} onFocusCapture={() => { api.setActive(); w.commands.activate(api.id); }}>
    <p>WEB3-02 · Panel chỉ đọc thử vòng đời; chưa đọc tồn kho hoặc ledger.</p>
  </section>;
}
function ReceiptRecordsProbe() {
  const w = useLabWorkspace();
  return <div className="p-4"><p>Danh sách stub F02</p><Button onClick={() => void w.openDocument("goods-receipt", "1001")}>Mở Receipt stub 1001</Button></div>;
}
export function ReceiptProbeButtons() {
  const w = useLabWorkspace();
  const busy = useStore(w.close.state, state => state.busy);
  const layoutBusy = useStore(w.layouts.state, state => state.busy);
  return <>
    <Button variant="outline" disabled={busy || layoutBusy} onClick={() => void w.openDocument("goods-receipt", "1001")}>Mở Receipt stub 1001</Button>
    <Button variant="outline" disabled={busy || layoutBusy} onClick={() => void w.openPanel("goods-receipt")}>Danh sách nhập kho stub</Button>
    <Button variant="outline" disabled={busy || layoutBusy} onClick={() => void w.openPanel("inventory-stock-card")}>Thẻ kho stub</Button>
    <Button variant="outline" disabled={busy || layoutBusy} onClick={() => void w.openPanel("inventory-balances")}>Tồn kho stub</Button>
  </>;
}
export const receiptProbeComponents = { "goods-receipt": ReceiptWorkspaceProbe, "goods-receipt-records": ReceiptRecordsProbe, "inventory-stock-card": ReadOnlyProbe, "inventory-balances": ReadOnlyProbe };

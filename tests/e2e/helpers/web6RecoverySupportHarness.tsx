import { createRoot, type Root } from "react-dom/client";
import { RecoverySupport } from "../../../src/app/workspace/RecoverySupport";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../src/components/ui/dialog";

let root: Root | undefined;
const calls = { prepare: 0, confirm: 0, consentIds: [] as string[] };
const operationId = "11111111-2222-4333-8444-555555555555";

export function mount() {
  root?.unmount();
  document.getElementById("web6-recovery-support-harness")?.remove();
  const application = document.getElementById("root");
  if (application) application.hidden = true;
  const host = document.createElement("div");
  host.id = "web6-recovery-support-harness";
  document.body.append(host);
  calls.prepare = 0; calls.confirm = 0; calls.consentIds = [];
  root = createRoot(host);
  root.render(<Dialog open><DialogContent showCloseButton={false}><DialogHeader><DialogTitle>Đối soát thao tác</DialogTitle>
    <DialogDescription>Controlled browser harness.</DialogDescription></DialogHeader>
    <RecoverySupport metadata={{ operationId }} current={() => ({ operationId })} resend={{
      prepare: async () => { calls.prepare++; return { operationId, operationKind: "Sales.Create", documentLabel: "S-104", consumed: false }; },
      confirm: async consentId => { calls.confirm++; calls.consentIds.push(consentId); await new Promise(resolve => setTimeout(resolve, 50)); },
    }} />
  </DialogContent></Dialog>);
}

export function snapshot() { return structuredClone(calls); }

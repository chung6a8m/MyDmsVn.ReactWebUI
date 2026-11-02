import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { setup, opRecords, respond, epoch } from "./web4RecoveryWorkspaceSetup";
const vector = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/web5-resolution-v1/${name}.json`, import.meta.url), "utf8"));

// Controlled HTTP exercises native browser transactions/UI only. B04-B and the
// private actual-port bridge own independent SQL proof.
export async function setupResolution(page: Page, stem: string, options: Parameters<typeof setup>[3] = {}) {
  const f = await setup(page, stem, "lost", { originalGrantOnly: true, rawNote: true, ...options });
  const reads: string[] = [];
  let state = "not-executed";
  await page.route("**/api/v2/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    expect(request.method()).toBe("GET");
    expect(request.postData()).toBeNull();
    if (path === "/api/v2/operations/context") return respond(route, vector("context-response"));
    const op = (await opRecords(page)).find(value => path === `/api/v2/operations/${value.operationId}/resolution`);
    if (!op) throw new Error("The versioned status must name an existing exact local operation.");
    reads.push(path);
    expect(request.headers()["x-mydmsvn-deployment-epoch"]).toBe(epoch);
    expect(request.headers()["x-mydmsvn-operation-fingerprint"]).toBe(op.frozen.requestFingerprint);
    if (["403", "404", "503"].includes(state)) return respond(route, { error: { code: "Operation.NotObserved", message: "Controlled unavailable status", details: [] } }, Number(state));
    const response = vector(`${stem}-${state}`);
    // Restoring the empty raw note commits an empty string into the intent.
    // The controlled original result must preserve that exact sent value.
    // Keep canonical fixtures and Post acknowledgement shapes unchanged.
    if (state === "committed" && !op.frozen.request.operationKind.endsWith(".Post")) {
      const note = (op.frozen.request.body as { note?: string | null }).note;
      if (op.frozen.request.operationKind.startsWith("Receipt.")) response.data.outcome.data.note = note ?? null;
      else if (note == null) delete response.data.outcome.data.note;
      else response.data.outcome.data.note = note;
    }
    Object.assign(response.data, { actorUserId: Number(op.actorKey), operationId: op.operationId,
      deploymentEpoch: op.deploymentEpoch, requestFingerprint: op.frozen.requestFingerprint });
    return respond(route, response);
  });
  return { ...f, resolutionReads: reads, setResolutionState(value: string) { state = value; } };
}

import type { Socket } from "node:net";
import { cutoverActionCaps, type CutoverAction } from "./web6-cutover-deadline";
import type { verifyAuthenticCommittedCutoverSetup } from "./web6-cutover-helpers";
import { requestWeb6Control } from "./web6-control-transport";

export type { CutoverAction } from "./web6-cutover-deadline";
export type CommittedSetupEvidence = Awaited<ReturnType<typeof verifyAuthenticCommittedCutoverSetup>>;
const actions = Object.keys(cutoverActionCaps);
const operationActions = new Set<CutoverAction>([
  "sameEpochRestart", "revokeGrantOn", "restoreEpoch", "committedUnavailable", "verifyNoCutoverMutation",
]);

export function createCutoverControlFrame(
  id: number, token: string, action: CutoverAction, requestAllowanceMs: number,
  operationId?: string, committedSetup?: CommittedSetupEvidence,
): Buffer {
  const hasOperation = operationId !== undefined;
  if ((action !== "revokeGrantOff" && operationActions.has(action) !== hasOperation) ||
      (action === "committedUnavailable") !== (committedSetup !== undefined) ||
      (committedSetup !== undefined && committedSetup.operationId !== operationId)) {
    const error = Error("Invalid WEB6 cutover control frame.");
    error.stack = undefined;
    throw error;
  }
  const payload = Buffer.from(JSON.stringify({
    id, token, action, requestAllowanceMs,
    ...(hasOperation ? { operationId } : {}),
    ...(committedSetup === undefined ? {} : { committedSetup }),
  }), "utf8");
  const prefix = Buffer.alloc(4);
  prefix.writeInt32LE(payload.length);
  return Buffer.concat([prefix, payload]);
}

export async function requestCutoverControl(
  action: CutoverAction, path: string, id: number, request: Buffer, requestAllowanceMs: number,
  connect?: (path: string) => Promise<Socket>,
  now?: () => number,
  allowanceSampledAt?: number,
): Promise<{ deploymentEpoch?: string; marker?: string }> {
  const reply = await requestWeb6Control(path, id, request, {
    flow: "cutover", action, actions, actionCap: cutoverActionCaps[action], requestAllowanceMs, allowanceSampledAt,
  }, connect, now);
  return { deploymentEpoch: reply.deploymentEpoch as string | undefined, marker: reply.marker as string | undefined };
}

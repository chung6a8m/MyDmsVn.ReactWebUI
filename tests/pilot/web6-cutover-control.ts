import type { Socket } from "node:net";
import { requestWeb6Control } from "./web6-control-transport";

const actions = [
  "oldClientNewHostOn", "oldClientNewHostOff", "newClientOldHostOn", "newClientOldHostOff",
  "sameEpochRestart", "revokeGrantOn", "revokeGrantOff", "restoreEpoch", "committedUnavailable", "verifyNoCutoverMutation",
] as const;
export type CutoverAction = typeof actions[number];

export async function requestCutoverControl(
  action: CutoverAction, path: string, id: number, request: Buffer,
  connect?: (path: string) => Promise<Socket>,
  now?: () => number,
): Promise<{ deploymentEpoch?: string; marker?: string }> {
  const reply = await requestWeb6Control(path, id, request, {
    flow: "cutover", action, actions, timeoutMs: 15_000,
  }, connect, now);
  return { deploymentEpoch: reply.deploymentEpoch as string | undefined, marker: reply.marker as string | undefined };
}

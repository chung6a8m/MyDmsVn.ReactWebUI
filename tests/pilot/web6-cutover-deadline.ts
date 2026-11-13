export const CUTOVER_RESPONSE_RESERVE_MS = 5000;

export const cutoverActionCaps = {
  oldClientNewHostOn: 180_000,
  oldClientNewHostOff: 180_000,
  newClientOldHostOn: 180_000,
  newClientOldHostOff: 180_000,
  restoreEpoch: 180_000,
  resetCutover: 180_000,
  sameEpochRestart: 210_000,
  committedUnavailable: 60_000,
  revokeGrantOn: 45_000,
  revokeGrantOff: 45_000,
  verifyNoCutoverMutation: 45_000,
} as const;

export type CutoverAction = keyof typeof cutoverActionCaps;
type Send<T> = (requestAllowanceMs: number, allowanceSampledAt: number) => Promise<T>;

export function createCutoverScenarioDeadline(totalMs: number, resetReserveMs: number, now = () => performance.now()) {
  const started = now();
  const totalDeadline = started + totalMs;
  const bodyDeadline = totalDeadline - resetReserveMs;
  let controlState: "idle" | "pending" | "uncertain" = "idle";
  let resetStarted = false;

  function refusal(action: CutoverAction | "unrecognized", terminal: "timeout" | "protocol", category: string, sampledAt: number) {
    const error = new Error(`Owned WEB6 cutover control failed: ${JSON.stringify({
      action, terminal, phase: "request", elapsedMs: Math.max(0, Math.floor(sampledAt - started)), category,
    })}`);
    error.stack = undefined;
    return error;
  }

  async function run<T>(action: CutoverAction, deadline: number, cap: number, send: Send<T>) {
    const sampledAt = now();
    const allowance = Math.floor(Math.min(cap, deadline - sampledAt));
    if (allowance <= CUTOVER_RESPONSE_RESERVE_MS) throw refusal(action, "timeout", "scenario-exhausted", sampledAt);
    controlState = "pending";
    try {
      const reply = await send(allowance, sampledAt);
      controlState = "idle";
      return reply;
    } catch (error) {
      controlState = "uncertain";
      throw error;
    }
  }

  return {
    remainingTotalMs: () => Math.max(0, Math.floor(totalDeadline - now())),
    async body<T>(action: Exclude<CutoverAction, "resetCutover">, send: Send<T>) {
      if (!Object.hasOwn(cutoverActionCaps, action) || (action as CutoverAction) === "resetCutover")
        throw refusal("unrecognized", "protocol", "invalid-action", now());
      if (resetStarted || controlState !== "idle") throw refusal(action, "protocol", "drain-uncertain", now());
      return run(action, bodyDeadline, cutoverActionCaps[action], send);
    },
    async reset<T>(send: Send<T>) {
      if (resetStarted) return;
      resetStarted = true;
      if (controlState !== "idle") return;
      return run("resetCutover", totalDeadline, Math.min(cutoverActionCaps.resetCutover, resetReserveMs), send);
    },
  };
}

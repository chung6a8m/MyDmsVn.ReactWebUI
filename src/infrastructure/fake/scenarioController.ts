import { createStore } from "zustand/vanilla";
export type ScenarioMode =
  | "success"
  | "known-failure"
  | "forbidden"
  | "version-conflict"
  | "reference-conflict"
  | "delay"
  | "commit-then-response-lost"
  | "eventual-commit";
export type ReadMode =
  | "success"
  | "deny"
  | "error"
  | "old-version"
  | "mismatch"
  | "empty-list";
export interface FakeSalesCapabilities {
  read: boolean;
  write: boolean;
  post: boolean;
}
export function createScenarioController() {
  const state = createStore<{
    mode: ScenarioMode;
    readMode: ReadMode;
    capabilities: FakeSalesCapabilities;
    pending: readonly { requestId: string; operation: "save" | "post" }[];
  }>(() => ({
    mode: "success",
    readMode: "success",
    capabilities: { read: true, write: true, post: true },
    pending: [],
  }));
  const callbacks = new Map<
    string,
    (outcome: "success" | "known-failure" | "commit-then-response-lost") => void
  >();
  let sequence = 0;
  return {
    state,
    setMode: (mode: ScenarioMode) => state.setState({ mode }),
    setReadMode: (readMode: ReadMode) => state.setState({ readMode }),
    setCapabilities: (caps: Partial<FakeSalesCapabilities>) =>
      state.setState((s) => ({ capabilities: { ...s.capabilities, ...caps } })),
    complete(
      requestId: string,
      outcome:
        | "success"
        | "known-failure"
        | "commit-then-response-lost" = "success",
    ) {
      const callback = callbacks.get(requestId);
      callbacks.delete(requestId);
      state.setState((s) => ({
        pending: s.pending.filter((p) => p.requestId !== requestId),
      }));
      callback?.(outcome);
    },
    enqueue(
      operation: "save" | "post",
      callback: (
        outcome: "success" | "known-failure" | "commit-then-response-lost",
      ) => void,
    ) {
      const requestId = `request-${++sequence}`;
      callbacks.set(requestId, callback);
      state.setState((s) => ({
        pending: [...s.pending, { requestId, operation }],
      }));
      return requestId;
    },
  };
}
export type ScenarioController = ReturnType<typeof createScenarioController>;

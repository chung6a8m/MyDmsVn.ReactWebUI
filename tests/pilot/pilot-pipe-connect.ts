import { connect, type Socket } from "node:net";

function canceled(): NodeJS.ErrnoException {
  return Object.assign(new Error("Pilot pipe connect canceled"), { code: "ECANCELED" });
}

function retryPause(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(canceled());
    };
    const timer = setTimeout(done, 25);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}

// A connection failure before "connect" cannot have sent a control frame.
// Never retry after connection, and do not retry non-ENOENT failures.
export async function connectPilotPipe(
  path: string,
  create: (path: string) => Socket = connect,
  pause: (signal?: AbortSignal) => Promise<void> = retryPause,
  signal?: AbortSignal,
): Promise<Socket> {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (signal?.aborted) throw canceled();
    const result = await new Promise<{ socket: Socket } | { error: NodeJS.ErrnoException }>(resolve => {
      const socket = create(path);
      let connected = false;
      const timer = setTimeout(() => onError(Object.assign(new Error("Pilot pipe connect timed out"), { code: "ETIMEDOUT" })), 1000);
      const detachAbort = () => signal?.removeEventListener("abort", onAbort);
      const onConnect = () => {
        connected = true;
        clearTimeout(timer);
        detachAbort();
        // A socket can emit its terminal error before the caller resumes after await.
        socket.once("close", () => socket.off("error", onError));
        resolve({ socket });
      };
      const onError = (error: NodeJS.ErrnoException) => {
        if (connected) return;
        clearTimeout(timer);
        detachAbort();
        socket.off("connect", onConnect);
        socket.destroy();
        resolve({ error });
      };
      const onAbort = () => onError(canceled());
      socket.once("connect", onConnect);
      socket.once("error", onError);
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
    if ("socket" in result) return result.socket;
    if (result.error.code !== "ENOENT" || attempt === 39) throw result.error;
    await pause(signal);
  }
  throw new Error("Unreachable pilot pipe state");
}

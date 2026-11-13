import { connect, type Socket } from "node:net";

// A connection failure before "connect" cannot have sent a control frame.
// Never retry after connection, and do not retry non-ENOENT failures.
export async function connectPilotPipe(
  path: string,
  create: (path: string) => Socket = connect,
  pause: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 25)),
): Promise<Socket> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = await new Promise<{ socket: Socket } | { error: NodeJS.ErrnoException }>(resolve => {
      const socket = create(path);
      let connected = false;
      const timer = setTimeout(() => onError(Object.assign(new Error("Pilot pipe connect timed out"), { code: "ETIMEDOUT" })), 1000);
      const onConnect = () => {
        connected = true;
        clearTimeout(timer);
        // A socket can emit its terminal error before the caller resumes after await.
        socket.once("close", () => socket.off("error", onError));
        resolve({ socket });
      };
      const onError = (error: NodeJS.ErrnoException) => {
        if (connected) return;
        clearTimeout(timer);
        socket.off("connect", onConnect);
        socket.destroy();
        resolve({ error });
      };
      socket.once("connect", onConnect);
      socket.once("error", onError);
    });
    if ("socket" in result) return result.socket;
    if (result.error.code !== "ENOENT" || attempt === 39) throw result.error;
    await pause();
  }
  throw new Error("Unreachable pilot pipe state");
}

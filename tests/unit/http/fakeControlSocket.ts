import { EventEmitter } from "node:events";
import type { Socket } from "node:net";

export function frame(text: string) {
  const bytes = Buffer.from(text), prefix = Buffer.alloc(4);
  prefix.writeInt32LE(bytes.length);
  return Buffer.concat([prefix, bytes]);
}
export function fakeControlSocket() {
  const socket = new EventEmitter() as Socket;
  const writes: Buffer[] = [];
  let destroys = 0, ends = 0, connects = 0;
  let timer: ReturnType<typeof setTimeout> | undefined, durationMs = 0;
  const emit = socket.emit.bind(socket);
  const resetTimer = () => {
    if (timer) clearTimeout(timer);
    timer = durationMs ? setTimeout(() => socket.emit("timeout"), durationMs) : undefined;
  };
  socket.emit = ((event: string, ...args: unknown[]) => {
    if (event === "data") resetTimer();
    return emit(event, ...args);
  }) as Socket["emit"];
  socket.setTimeout = (duration, callback) => {
    durationMs = duration;
    if (callback) socket.once("timeout", callback);
    resetTimer();
    return socket;
  };
  socket.write = ((bytes: Buffer) => { writes.push(bytes); return true; }) as Socket["write"];
  socket.destroy = () => { destroys++; return socket; };
  socket.end = (() => { ends++; return socket; }) as Socket["end"];
  const connect = async () => { connects++; return socket; };
  return { socket, connect, writes, state: () => ({ destroys, ends, connects }) };
}

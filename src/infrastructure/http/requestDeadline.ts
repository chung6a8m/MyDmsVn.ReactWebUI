// Bound the complete response operation, including a body that never finishes.
// Aborting the browser request does not prove a dispatched write rolled back.
export async function withRequestDeadline<T>(work: (signal: AbortSignal) => Promise<T>, milliseconds: number, caller?: AbortSignal | null): Promise<T> {
  const controller = new AbortController();
  if (caller?.aborted) throw caller.reason ?? new DOMException("Request aborted", "AbortError");
  let interrupt!: (reason: unknown) => void;
  const interrupted = new Promise<never>((_resolve, reject) => { interrupt = reject; });
  const stop = (reason: unknown) => { controller.abort(reason); interrupt(reason); };
  const onAbort = () => stop(caller?.reason ?? new DOMException("Request aborted", "AbortError"));
  caller?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => stop(new DOMException("Request deadline exceeded", "TimeoutError")), milliseconds);
  try {
    return await Promise.race([work(controller.signal), interrupted]);
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener("abort", onAbort);
  }
}

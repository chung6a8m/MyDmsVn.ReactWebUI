import { createConnection } from "node:net";
import { z } from "zod";

const maximumFrameBytes = 1_048_576;
const exchangeTimeoutMs = 50_000;
const fixtureId = z.number().int().positive().max(2_147_483_647);
const bootstrapSchema = z.object({
  type: z.literal("bootstrap"), protocol: z.literal("web4-port-bridge-v1"), origin: z.literal("https://web2.mydmsvn.test"),
  actor: z.object({ username: z.string().min(1), password: z.string().min(1), userId: fixtureId }).strict(),
  catalog: z.object({ customerId: fixtureId, warehouseId: fixtureId, employeeId: fixtureId, productId: fixtureId, otherProductId: fixtureId }).strict(),
}).strict();
const replySchema = z.object({
  id: z.number().int().positive(), type: z.literal("http"), status: z.number().int().min(200).max(599),
  headers: z.array(z.tuple([z.string(), z.string()])), body: z.string(),
}).strict();
type Frame = Record<string, unknown>;
type MutationRequest = { method: string; path: string; body: string | null; epoch: string | null };

// Only the lowest fetch boundary is replaced. All auth, wire mapping, request
// fingerprints, status verification and write outcomes are production code.
export async function connectTestServer() {
  const pipePath = process.env.MYDMSVN_WEB4_PORT_PIPE;
  if (!pipePath?.startsWith("\\\\.\\pipe\\mydmsvn-web4-ports-")) throw new Error("A backend-owned WEB4 port fixture is required.");
  const socket = createConnection(pipePath);
  let buffer = Buffer.alloc(0);
  let terminal: Error | undefined;
  let closed = false;
  let nextId = 1;
  let exchanging = false;
  const queued: Frame[] = [];
  let waiting: { resolve(value: Frame): void; reject(error: Error): void } | undefined;
  const fail = (message: string) => {
    terminal ??= new Error(message);
    waiting?.reject(terminal);
    waiting = undefined;
    socket.destroy();
  };
  socket.on("error", () => fail("The backend port fixture pipe failed."));
  socket.on("close", () => { if (!closed) fail("The backend port fixture pipe closed unexpectedly."); });
  socket.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    try {
      while (buffer.length >= 4) {
        const length = buffer.readUInt32LE(0);
        if (length === 0 || length > maximumFrameBytes) throw new Error();
        if (buffer.length < length + 4) return;
        const decoded: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(4, length + 4)));
        buffer = buffer.subarray(length + 4);
        if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error();
        if (waiting) { const pending = waiting; waiting = undefined; pending.resolve(decoded as Frame); }
        else { if (queued.length !== 0) throw new Error(); queued.push(decoded as Frame); }
      }
    } catch { fail("The backend port fixture returned an invalid frame."); }
  });
  function takeFrame(): Promise<Frame> {
    if (terminal) return Promise.reject(terminal);
    const frame = queued.shift();
    if (frame) return Promise.resolve(frame);
    if (waiting) return Promise.reject(new Error("The port bridge permits one pending response."));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => fail("The backend port fixture response timed out."), exchangeTimeoutMs);
      waiting = {
        resolve(value) { clearTimeout(timeout); resolve(value); },
        reject(error) { clearTimeout(timeout); reject(error); },
      };
    });
  }
  async function exchange(payload: Frame): Promise<Frame> {
    if (exchanging || closed || terminal) throw new Error("The port bridge is unavailable or already handling a request.");
    exchanging = true;
    const id = nextId++;
    try {
      const bytes = Buffer.from(JSON.stringify({ id, ...payload }), "utf8");
      if (bytes.length === 0 || bytes.length > maximumFrameBytes) throw new Error("The port request exceeds the fixture frame limit.");
      const prefix = Buffer.alloc(4);
      prefix.writeUInt32LE(bytes.length);
      socket.write(Buffer.concat([prefix, bytes]));
      const response = await takeFrame();
      if (response.id !== id || response.type !== payload.type) throw new Error("The port bridge response identity is invalid.");
      return response;
    } finally { exchanging = false; }
  }
  const bootstrap = bootstrapSchema.safeParse(await takeFrame());
  if (!bootstrap.success) { closed = true; socket.destroy(); throw new Error("The backend port fixture bootstrap is invalid."); }
  const suppressed = new Set<string>();
  const dispatches = new Map<string, number>();
  const firstRequests = new Map<string, MutationRequest>();
  const firstResponses = new Map<string, string>();
  const statusRequests: { operationId: string; fingerprint: string | null; epoch: string | null }[] = [];
  const fetcher: typeof fetch = async (input, init = {}) => {
    if (typeof input !== "string" || !input.startsWith("/api/v1/") || (init.body !== undefined && init.body !== null && typeof init.body !== "string"))
      throw new Error("The port fixture accepts same-origin string requests with exact string bodies.");
    if (init.signal?.aborted) throw new DOMException("Request aborted before dispatch.", "AbortError");
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);
    const body = typeof init.body === "string" ? init.body : null;
    const key = headers.get("Idempotency-Key");
    const mutation = method !== "GET" && /^\/api\/v1\/(sales-receipts|goods-receipts)(\/|$)/.test(input);
    if (mutation) {
      if (!key) throw new Error("The production port omitted its operation key.");
      const request = { method, path: input, body, epoch: headers.get("X-MyDmsVn-Deployment-Epoch") };
      const previous = firstRequests.get(key);
      if (previous && JSON.stringify(previous) !== JSON.stringify(request)) throw new Error("Explicit replay changed the original request bytes or scope.");
      firstRequests.set(key, request);
      dispatches.set(key, (dispatches.get(key) ?? 0) + 1);
    }
    if (method === "GET" && /^\/api\/v1\/operations\/[0-9a-f-]{36}$/.test(input)) statusRequests.push({
      operationId: input.slice(input.lastIndexOf("/") + 1), fingerprint: headers.get("X-MyDmsVn-Operation-Fingerprint"), epoch: headers.get("X-MyDmsVn-Deployment-Epoch"),
    });
    const parsed = replySchema.safeParse(await exchange({ type: "http", method, path: input, headers: Array.from(headers.entries()), body }));
    if (!parsed.success) throw new Error("The backend port fixture HTTP reply is invalid.");
    const reply = parsed.data;
    if (mutation && key && !firstResponses.has(key)) firstResponses.set(key, reply.body);
    const response = new Response(reply.body, { status: reply.status, headers: reply.headers });
    // Injection occurs only AFTER the real TestServer response has arrived. No
    // response is fabricated and no automatic replay is implemented by this adapter.
    if (mutation && key && response.ok && suppressed.delete(key)) throw new TypeError("Acknowledgement suppressed after actual server completion.");
    if (init.signal?.aborted) throw new DOMException("Request aborted after dispatch.", "AbortError");
    return response;
  };
  return {
    bootstrap: bootstrap.data,
    fetch: fetcher,
    statusRequests,
    mutationDispatches: dispatches,
    suppressFirstAcknowledgement(operationId: string) {
      if (dispatches.has(operationId) || suppressed.has(operationId)) throw new Error("Acknowledgement suppression requires a new operation.");
      suppressed.add(operationId);
    },
    originalMutationData(operationId: string): unknown {
      const body = firstResponses.get(operationId);
      if (body === undefined) throw new Error("No actual mutation response was observed.");
      const value: unknown = JSON.parse(body);
      if (!value || typeof value !== "object" || Array.isArray(value) || !Object.hasOwn(value, "data")) throw new Error("The real mutation did not return a success envelope.");
      return (value as { data: unknown }).data;
    },
    restart: async () => { await exchange({ type: "restart" }); },
    complete: async () => { await exchange({ type: "complete", executedTests: 1 }); },
    close() { closed = true; waiting?.reject(new Error("Port fixture closed.")); waiting = undefined; socket.destroy(); },
  };
}

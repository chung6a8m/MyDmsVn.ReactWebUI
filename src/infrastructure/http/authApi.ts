import { z } from "zod";
export class HttpError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) { super(`HTTP ${status}`); }
}
export class ProtocolError extends Error { constructor() { super("Phản hồi máy chủ không đúng hợp đồng."); } }
export async function readData(response: Response): Promise<unknown> {
  let value: unknown;
  try { value = JSON.parse(await response.text()); } catch {
    if (!response.ok) throw new HttpError(response.status, null);
    throw new ProtocolError();
  }
  if (!response.ok) throw new HttpError(response.status, value);
  if (!value || typeof value !== "object" || !("data" in value) || "error" in value) throw new ProtocolError();
  return value.data;
}
export const userSchema = z.object({ userId: z.number().int().positive().max(2147483647), username: z.string(), displayName: z.string() });
export const capabilitiesSchema = z.object({ read: z.boolean(), write: z.boolean(), post: z.boolean() });
export const tokenSchema = z.object({ accessToken: z.string().min(1), expiresAtUtc: z.iso.datetime(), user: userSchema });
export function createAuthApi(fetcher: typeof fetch) {
  return {
    async change(action: "login" | "refresh" | "logout", body?: unknown) {
      return readData(await fetcher(`/api/v1/auth/${action}`, { method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", headers: { "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
    },
    async read(action: "me" | "capabilities?feature=sales", token: string) {
      return readData(await fetcher(`/api/v1/auth/${action}`, { credentials: "omit", cache: "no-store", redirect: "error", headers: { Authorization: `Bearer ${token}` } }));
    },
  };
}

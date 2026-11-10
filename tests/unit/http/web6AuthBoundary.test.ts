import { expect, it } from "vitest";
import { web6AuthHarness } from "./web6AuthHarness";

it.each(["candidateMismatchOn", "eligibility500"] as const)("%s rejects consent without expiring the authenticated session", async boundary => {
  const s = await web6AuthHarness(boundary), before = s.auth.getSnapshot();
  await expect(s.prepare()).rejects.toThrow();
  expect(s.auth.getSnapshot()).toBe(before);
  expect(s.requests.map(value => value.method)).toEqual(boundary === "candidateMismatchOn" ? ["GET"] : ["GET", "GET"]);
});
it("inactive-user 401 on context denies refresh, removes bearer and invalidates the owning generation", async () => {
  const s = await web6AuthHarness("eligibility401"), generation = s.auth.getSnapshot().actorGeneration;
  await expect(s.prepare()).rejects.toThrow();
  expect(s.auth.getSnapshot()).toMatchObject({ status: "reauth-required", actorKey: "", actorGeneration: generation + 1,
    capabilities: { read: false, write: false, post: false } });
  expect(s.storage.size).toBe(0);
  expect(s.requests).toEqual([{ path: "/api/v3/operations/resend-context", method: "GET" }, { path: "/api/v1/auth/refresh", method: "POST" }]);
});
it("401 with successful same-session refresh retries only the safe eligibility GET", async () => {
  const s = await web6AuthHarness("refresh-success"), before = s.auth.getSnapshot();
  expect(await s.prepare()).toMatchObject({ decision: "ALLOW" });
  expect(s.auth.getSnapshot()).toMatchObject({ status: "authenticated", actorGeneration: before.actorGeneration });
  expect(s.requests.filter(value => value.path.endsWith("/resend-eligibility"))).toHaveLength(2);
  expect(s.requests.filter(value => value.method !== "GET")).toEqual([{ path: "/api/v1/auth/refresh", method: "POST" }]);
});
it("a second eligibility 401 after refresh expires auth without any third GET or business mutation", async () => {
  const s = await web6AuthHarness("refresh-repeated-401");
  await expect(s.prepare()).rejects.toThrow();
  expect(s.auth.getSnapshot().status).toBe("reauth-required"); expect(s.storage.size).toBe(0);
  expect(s.requests.filter(value => value.path.endsWith("/resend-eligibility"))).toHaveLength(2);
  expect(s.requests.filter(value => value.method !== "GET")).toEqual([{ path: "/api/v1/auth/refresh", method: "POST" }]);
});

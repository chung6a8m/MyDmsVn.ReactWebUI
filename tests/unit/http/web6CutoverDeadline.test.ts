import { describe, expect, it } from "vitest";
import { createCutoverScenarioDeadline } from "../../pilot/web6-cutover-deadline";

const receiveAllowance = async (allowance: number) => allowance;

describe("WEB6 cumulative cutover scenario deadline", () => {
  it.each([
    [420_000, 180_000, 240_000],
    [420_000, 180_000, 240_000],
    [690_000, 60_000, 630_000],
  ])("separates %i ms total from its %i ms reset reserve", async (total, reserve, body) => {
    let elapsed = 0;
    const scenario = createCutoverScenarioDeadline(total, reserve, () => elapsed);
    elapsed = body - 5001;
    await expect(scenario.body("sameEpochRestart", receiveAllowance)).resolves.toBe(5001);
    elapsed = body - 5000;
    await expect(scenario.body("sameEpochRestart", receiveAllowance)).rejects.toThrow(/scenario-exhausted/);
    elapsed = body;
    expect(scenario.remainingTotalMs()).toBe(reserve);
    await expect(scenario.reset(receiveAllowance)).resolves.toBe(reserve);
  });

  it.each([
    ["oldClientNewHostOn", 180_000], ["oldClientNewHostOff", 180_000],
    ["newClientOldHostOn", 180_000], ["newClientOldHostOff", 180_000],
    ["restoreEpoch", 180_000], ["sameEpochRestart", 210_000], ["committedUnavailable", 60_000],
    ["revokeGrantOn", 45_000], ["revokeGrantOff", 45_000], ["verifyNoCutoverMutation", 45_000],
  ] as const)("clamps %s to its backend cap", async (action, cap) => {
    const scenario = createCutoverScenarioDeadline(690_000, 60_000, () => 0);
    await expect(scenario.body(action, receiveAllowance)).resolves.toBe(cap);
  });

  it("caps an early reset and admits it only once", async () => {
    const scenario = createCutoverScenarioDeadline(420_000, 180_000, () => 0);
    await expect(scenario.reset(receiveAllowance)).resolves.toBe(180_000);
    await expect(scenario.reset(receiveAllowance)).resolves.toBeUndefined();
    await expect(scenario.body("restoreEpoch", receiveAllowance)).rejects.toThrow(/drain-uncertain/);
  });

  it("caps third-scenario reset to 60 seconds even when started early", async () => {
    const scenario = createCutoverScenarioDeadline(690_000, 60_000, () => 0);
    await expect(scenario.reset(receiveAllowance)).resolves.toBe(60_000);
  });

  it("samples integer allowance when an action starts and charges elapsed connect and write time to the next action", async () => {
    let elapsed = 0;
    const scenario = createCutoverScenarioDeadline(420_000, 180_000, () => elapsed);
    elapsed = 75_000.3;
    await expect(scenario.body("oldClientNewHostOn", async allowance => {
      expect(allowance).toBe(164_999);
      elapsed += 3000; // Connect
      elapsed += 2000; // Write
      return allowance;
    })).resolves.toBe(164_999);
    await expect(scenario.body("oldClientNewHostOff", receiveAllowance)).resolves.toBe(159_999);
  });

  it("refuses an unrecognized action before invoking the sender", async () => {
    const scenario = createCutoverScenarioDeadline(420_000, 180_000, () => 0);
    await expect(scenario.body("private-action" as never, async () => {
      throw Error("unexpected send");
    })).rejects.toThrow(/"action":"unrecognized".*"category":"invalid-action"/);
  });

  it.each([[414_999, 5001], [415_000, 0], [420_000, 0]])(
    "applies the five-second boundary to reset at elapsed %i", async (elapsed, allowance) => {
      let now = 0;
      const scenario = createCutoverScenarioDeadline(420_000, 180_000, () => now);
      now = elapsed;
      if (allowance) await expect(scenario.reset(receiveAllowance)).resolves.toBe(allowance);
      else await expect(scenario.reset(async () => {
        throw Error("unexpected send");
      })).rejects.toThrow(/scenario-exhausted/);
    },
  );

  it("refuses reset while a body control remains in flight", async () => {
    const scenario = createCutoverScenarioDeadline(420_000, 180_000, () => 0);
    let finish!: (allowance: number) => void;
    const pending = new Promise<number>(resolve => { finish = resolve; });
    const action = scenario.body("oldClientNewHostOn", () => pending);
    await expect(scenario.reset(receiveAllowance)).resolves.toBeUndefined();
    finish(180_000);
    await expect(action).resolves.toBe(180_000);
    await expect(scenario.reset(receiveAllowance)).resolves.toBeUndefined();
  });

  it("refuses further body controls and reset after the sender fails", async () => {
    const scenario = createCutoverScenarioDeadline(420_000, 180_000, () => 0);
    const primary = Error("request failure");
    await expect(scenario.body("oldClientNewHostOn", async () => { throw primary; })).rejects.toBe(primary);
    await expect(scenario.body("oldClientNewHostOff", receiveAllowance)).rejects.toThrow(/drain-uncertain/);
    await expect(scenario.reset(receiveAllowance)).resolves.toBeUndefined();
  });
});

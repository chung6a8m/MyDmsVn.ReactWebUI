import { describe, expect, it } from "vitest";
import { pilotControlError } from "../../pilot/pilot-control-diagnostics";

describe("pilot control diagnostics", () => {
  it("preserves an allowed socket error classification", () => {
    expect(pilotControlError("releaseOriginal", "socket", "ENOENT").message)
      .toBe("Owned pilot control failed: action=releaseOriginal failure=socket code=ENOENT");
  });
  it("does not expose unrecognized error text or objects", () => {
    expect(pilotControlError("waitOriginal", "socket", "secret-token-pipe").message).not.toContain("secret-token-pipe");
    expect(pilotControlError("armOriginal", "bad-frame", { token: "secret-token" }).message).not.toContain("secret-token");
  });
});

import { expect, it } from "vitest";
import { operatorMetadata } from "../../../src/app/workspace/operatorMetadata";
const id = "11111111-2222-4333-8444-555555555555";
it("copies only bounded allowlisted identifiers and never arbitrary metadata", () => {
  const safe = operatorMetadata({ operationId: id, deploymentEpoch: id, correlationId: "recovery-case-1", localDocumentId: "secret note", snapshot: "secret" });
  expect(safe.summary).toBe(`Mã thao tác: ${id}\nCơ sở dữ liệu: ${id}\nMã tương quan: recovery-case-1`);
  expect(safe.summary).not.toMatch(/secret|snapshot/);
  expect(operatorMetadata({ operationId: "<secret>", deploymentEpoch: "bad", correlationId: "token=abc", localDocumentId: "secret" }).summary).toBe("");
  expect(operatorMetadata({ correlationId: "x".repeat(129) }).correlationId).toBeUndefined();
});
it("allows only UUID local IDs from quarantined primary keys", () => {
  expect(operatorMetadata({ deploymentEpoch: id, localDocumentId: id }).summary).toContain(`Mã bản nháp: ${id}`);
  expect(operatorMetadata({ localDocumentId: "sales-create" }).summary).toBe("");
});

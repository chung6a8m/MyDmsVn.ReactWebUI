import { expect, it } from "vitest";
import { previewLineAmount } from "../../../src/features/goodsReceipt/decimal";
it.each([
  ["1", "0", "0.0000"],
  ["0.0001", "0.5000", "0.0001"],
  ["0.0001", "0.4999", "0.0000"],
  ["1.2500", "2.3456", "2.9320"],
  ["99999999999999.9999", "999999999999999.9999", "99999999999999999890000000000.0000"],
])("exact Receipt preview %s × %s", (quantity, unitCost, expected) => {
  expect(previewLineAmount(quantity, unitCost)).toBe(expected);
});

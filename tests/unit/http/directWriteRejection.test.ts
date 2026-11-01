import { expect, it } from "vitest";
import { decodeDirectWriteRejection, validateDirectRejection } from "../../../src/infrastructure/http/directWriteRejection";
import { HttpError } from "../../../src/infrastructure/http/authApi";
import type { Web4OperationKind } from "../../../src/infrastructure/http/web4OperationCodec";
const kinds: Web4OperationKind[] = ["Sales.Create", "Sales.Update", "Sales.Post", "Receipt.Create", "Receipt.Update", "Receipt.Post"];
const error = (status: number, code: string) => new HttpError(status, { error: { code, message: "Rejected", details: [] } });
it.each(kinds)("accepts strict direct ValidationError for %s", kind => {
  expect(decodeDirectWriteRejection(error(400, "ValidationError"), kind)).toEqual({ operationKind: kind, httpStatus: 400, code: "ValidationError" });
});
for (const module of ["Sales", "Receipt"] as const) for (const action of ["Update", "Post"] as const) {
  const kind = `${module}.${action}` as Web4OperationKind;
  const prefix = module === "Sales" ? "SalesReceipt" : "GoodsReceipt";
  it.each([[404, "NotFound"], [409, "ConcurrencyConflict"], [409, "AlreadyPosted"]] as const)(`binds direct %s/%s to ${kind}`, (status, suffix) => {
    const code = `${prefix}.${suffix}`;
    expect(decodeDirectWriteRejection(error(status, code), kind)).toEqual({ operationKind: kind, httpStatus: status, code });
    expect(decodeDirectWriteRejection(error(status, code), `${module}.Create`)).toBeUndefined();
  });
}
it.each(["Auth.Forbidden", "Deployment.EpochMismatch", "Idempotency.KeyConflict", "Operation.NotObserved", "Operation.ResultUnavailable", "NotFound", "InternalError"])("never interprets %s as direct business noncommit proof", code => {
  for (const status of [400, 403, 404, 409, 500, 503]) expect(decodeDirectWriteRejection(error(status, code), "Sales.Update")).toBeUndefined();
});
it("rejects malformed envelopes, wrong HTTP/code/module bindings and extra persisted proof fields", () => {
  expect(decodeDirectWriteRejection(new HttpError(400, { error: { code: "ValidationError", message: "bad" } }), "Sales.Create")).toBeUndefined();
  expect(decodeDirectWriteRejection(error(409, "GoodsReceipt.AlreadyPosted"), "Sales.Post")).toBeUndefined();
  expect(decodeDirectWriteRejection(error(404, "SalesReceipt.ConcurrencyConflict"), "Sales.Update")).toBeUndefined();
  expect(() => validateDirectRejection({ operationKind: "Sales.Create", httpStatus: 400, code: "ValidationError", trusted: true }, "Sales.Create")).toThrow();
});

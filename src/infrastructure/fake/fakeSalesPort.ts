import type { SalesPort } from "../../ports/salesPort";
import type {
  SalesDocument,
  SalesSaveSnapshot,
  UiFailure,
  WriteResult,
  SalesListQuery,
} from "../../features/sales/contracts";
import { validateSales } from "../../features/sales/validation";
import { catalogFixtures } from "./fixtures";
import { createSalesFixtures, materializeSales } from "./salesFixtures";
import {
  createScenarioController,
  type ScenarioController,
} from "./scenarioController";
const clone = <T>(value: T): T => structuredClone(value);
const failed = (
  kind: UiFailure["kind"],
  code: string,
): { kind: "failed"; error: UiFailure } => ({
  kind: "failed",
  error: {
    kind,
    code,
    message:
      {
        "capability-denied": "Bạn không có quyền thực hiện thao tác này.",
        "read-denied": "Bạn không có quyền đọc chứng từ.",
        "read-error": "Không thể đọc chứng từ lúc này.",
        "known-failure": "Thao tác chưa được thực hiện. Vui lòng thử lại sau.",
        "version-conflict":
          "Chứng từ đã thay đổi hoặc không còn là bản nháp. Hãy tải lại để kiểm tra.",
        "reference-conflict":
          "Danh mục tham chiếu đã thay đổi hoặc ngừng hoạt động. Hãy kiểm tra lại.",
        "sale-not-found": "Không tìm thấy chứng từ.",
        "invalid-page-size": "Số chứng từ mỗi trang phải từ 1 đến 25.",
        "invalid-cursor":
          "Con trỏ danh sách không hợp lệ hoặc bộ lọc đã thay đổi.",
        "line-identity-conflict":
          "Danh tính dòng không thuộc chứng từ hoặc bị trùng.",
        "invalid-create-version":
          "Chứng từ mới không được có phiên bản đã lưu.",
      }[code] ?? "Không thể thực hiện thao tác này.",
  },
});
const compare = (a: SalesDocument, b: SalesDocument) =>
  BigInt(a.saleId) > BigInt(b.saleId)
    ? -1
    : BigInt(a.saleId) < BigInt(b.saleId)
      ? 1
      : 0;
function fingerprint(q: SalesListQuery) {
  return JSON.stringify([
    q.fromDate ?? null,
    q.toDate ?? null,
    q.customerId ?? null,
    q.warehouseId ?? null,
    q.employeeId ?? null,
    q.productId ?? null,
    q.status ?? null,
    q.search ?? null,
    q.pageSize,
  ]);
}
export function createFakeSalesPort(
  controller: ScenarioController = createScenarioController(),
): SalesPort {
  const docs = new Map(createSalesFixtures().map((d) => [d.saleId, d]));
  const old = new Map<string, SalesDocument>();
  let version = 0;
  let nextId = 9007199254741100n;
  const success = (value: SalesDocument) => ({
    kind: "success" as const,
    value: clone(value),
  });
  function mutate(
    operation: "save" | "post",
    commit: () => WriteResult<SalesDocument>,
  ): Promise<WriteResult<SalesDocument>> {
    const { mode, capabilities } = controller.state.getState();
    const commitAuthorized = () =>
      controller.state.getState().capabilities[
        operation === "save" ? "write" : "post"
      ]
        ? commit()
        : failed("forbidden", "capability-denied");
    if (
      !capabilities[operation === "save" ? "write" : "post"] ||
      mode === "forbidden"
    )
      return Promise.resolve(failed("forbidden", "capability-denied"));
    if (mode === "known-failure")
      return Promise.resolve(failed("unavailable", "known-failure"));
    if (mode === "version-conflict" || mode === "reference-conflict")
      return Promise.resolve(failed("conflict", mode));
    if (mode === "delay")
      return new Promise((resolve) =>
        controller.enqueue(operation, (outcome) => {
          if (outcome === "known-failure") {
            resolve(failed("unavailable", "known-failure"));
            return;
          }
          const result = commitAuthorized();
          resolve(
            outcome === "commit-then-response-lost" && result.kind === "success"
              ? { kind: "outcome-unknown" }
              : result,
          );
        }),
      );
    if (mode === "eventual-commit") {
      controller.enqueue(operation, (outcome) => {
        if (outcome === "success") commitAuthorized();
      });
      return Promise.resolve({ kind: "outcome-unknown" });
    }
    const result = commit();
    return Promise.resolve(
      mode === "commit-then-response-lost" && result.kind === "success"
        ? { kind: "outcome-unknown" }
        : result,
    );
  }
  function referencesEligible(snapshot: SalesSaveSnapshot) {
    for (const [kind, id] of [
      ["customer", snapshot.customerId],
      ["warehouse", snapshot.warehouseId],
      ["employee", snapshot.employeeId],
      ...snapshot.lines.map((l) => ["product", l.productId]),
    ] as const) {
      if (
        !catalogFixtures[kind as keyof typeof catalogFixtures].some(
          (x) => x.id === id && x.isActive,
        )
      )
        return false;
    }
    return true;
  }
  const port: SalesPort = {
    async list(query, context) {
      const state = controller.state.getState();
      if (!state.capabilities.read || state.readMode === "deny")
        return failed("forbidden", "read-denied");
      if (context.signal.aborted || state.readMode === "error")
        return failed("unavailable", "read-error");
      if (
        !Number.isInteger(query.pageSize) ||
        query.pageSize < 1 ||
        query.pageSize > 25
      )
        return failed("validation", "invalid-page-size");
      const key = fingerprint(query);
      let boundary: {
        key: string;
        id: string;
        direction: "next" | "previous";
      } | null = null;
      if (query.cursor) {
        try {
          boundary = JSON.parse(decodeURIComponent(query.cursor));
          if (
            !boundary ||
            boundary.key !== key ||
            !/^\d+$/.test(boundary.id) ||
            !["next", "previous"].includes(boundary.direction)
          )
            throw Error();
        } catch {
          return failed("validation", "invalid-cursor");
        }
      }
      const search = (query.search ?? "").trim().toLocaleLowerCase("vi");
      const all = [...docs.values()]
        .filter(
          (d) =>
            (!query.fromDate || d.saved.saleDate >= query.fromDate) &&
            (!query.toDate || d.saved.saleDate <= query.toDate) &&
            (!query.customerId || d.saved.customerId === query.customerId) &&
            (!query.warehouseId || d.saved.warehouseId === query.warehouseId) &&
            (!query.employeeId || d.saved.employeeId === query.employeeId) &&
            (!query.status || d.status === query.status) &&
            (!query.productId ||
              d.lines.some((l) => l.productId === query.productId)) &&
            `${d.saleNumber} ${d.saved.note} ${d.references.customer.name}`
              .toLocaleLowerCase("vi")
              .includes(search),
        )
        .sort(compare);
      const eligible = boundary
        ? all.filter((d) =>
            boundary.direction === "next"
              ? BigInt(d.saleId) < BigInt(boundary.id)
              : BigInt(d.saleId) > BigInt(boundary.id),
          )
        : all;
      const page =
        state.readMode === "empty-list"
          ? []
          : boundary?.direction === "previous"
            ? eligible.slice(-query.pageSize)
            : eligible.slice(0, query.pageSize);
      const cursor = (direction: "next" | "previous", id: string) =>
        encodeURIComponent(JSON.stringify({ key, id, direction }));
      const first = page[0],
        last = page.at(-1);
      return {
        kind: "success",
        value: {
          items: page.map((d) => ({
            saleId: d.saleId,
            saleNumber: d.saleNumber,
            saleDate: d.saved.saleDate,
            status: d.status,
            totalAmount: d.totalAmount,
          })),
          previousCursor:
            first && all.some((d) => BigInt(d.saleId) > BigInt(first.saleId))
              ? cursor("previous", first.saleId)
              : null,
          nextCursor:
            last && all.some((d) => BigInt(d.saleId) < BigInt(last.saleId))
              ? cursor("next", last.saleId)
              : null,
        },
      };
    },
    async get(id, context) {
      const state = controller.state.getState();
      if (!state.capabilities.read || state.readMode === "deny")
        return failed("forbidden", "read-denied");
      if (context.signal.aborted || state.readMode === "error")
        return failed("unavailable", "read-error");
      const d =
        state.readMode === "old-version"
          ? (old.get(id) ?? docs.get(id))
          : docs.get(id);
      if (!d) return failed("not-found", "sale-not-found");
      const result = clone(d);
      if (state.readMode === "mismatch")
        result.saved.note += " (external change)";
      return success(result);
    },
    async save(input) {
      const snapshot = clone(input);
      return mutate("save", () => {
        if (snapshot.saleId === null && snapshot.expectedVersion !== null)
          return failed("validation", "invalid-create-version");
        const issues = validateSales(snapshot);
        if (issues.length)
          return {
            kind: "failed",
            error: {
              kind: "validation",
              code: "invalid-sales",
              message: "Kiểm tra chứng từ.",
              issues,
            },
          };
        const previous = snapshot.saleId
          ? docs.get(snapshot.saleId)
          : undefined;
        if (snapshot.saleId && !previous)
          return failed("not-found", "sale-not-found");
        if (
          previous &&
          (previous.version !== snapshot.expectedVersion ||
            previous.status !== "Draft")
        )
          return failed("conflict", "version-conflict");
        if (!referencesEligible(snapshot))
          return failed("conflict", "reference-conflict");
        const lineIds = snapshot.lines
          .map((l) => l.saleLineId)
          .filter((id): id is string => id !== null);
        if (
          new Set(lineIds).size !== lineIds.length ||
          lineIds.some(
            (id) => !previous?.lines.some((l) => l.saleLineId === id),
          )
        )
          return failed("conflict", "line-identity-conflict");
        const id = previous?.saleId ?? String(nextId++);
        const document = materializeSales(
          snapshot,
          id,
          `fake-version-${++version}`,
        );
        if (previous) old.set(id, clone(previous));
        docs.set(id, document);
        return success(document);
      });
    },
    async post(input) {
      return mutate("post", () => {
        const previous = docs.get(input.saleId);
        if (!previous) return failed("not-found", "sale-not-found");
        if (
          previous.version !== input.expectedVersion ||
          previous.status !== "Draft"
        )
          return failed("conflict", "version-conflict");
        const issues = validateSales(previous.saved);
        if (issues.length)
          return {
            kind: "failed",
            error: {
              kind: "validation",
              code: "invalid-sales",
              message: "Kiểm tra chứng từ trước khi ghi sổ.",
              issues,
            },
          };
        if (!referencesEligible(previous.saved))
          return failed("conflict", "reference-conflict");
        const document = materializeSales(
          previous.saved,
          previous.saleId,
          `fake-version-${++version}`,
          "Posted",
        );
        old.set(document.saleId, clone(previous));
        docs.set(document.saleId, document);
        return success(document);
      });
    },
  };
  return port;
}

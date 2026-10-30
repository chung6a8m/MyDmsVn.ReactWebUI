import type { CatalogPort } from "../../ports/catalogPort";
import { catalogFixtures } from "./fixtures";

export type FoundationScenario = "default" | "empty-catalog";
export function parseScenario(value: unknown): FoundationScenario {
  return value === "empty-catalog" ? value : "default";
}

export function createFakeCatalogPort(
  scenario: FoundationScenario = "default",
): CatalogPort {
  return {
    async search(query, context) {
      // Deterministic asynchronous boundary, no random delay or hidden transport.
      await Promise.resolve();
      if (context.signal.aborted) {
        return {
          kind: "failed",
          error: {
            kind: "unavailable",
            code: "aborted",
            message: "Đã hủy đọc danh mục.",
          },
        };
      }
      if (
        !Number.isInteger(query.limit) ||
        query.limit < 1 ||
        query.limit > 25
      ) {
        return {
          kind: "failed",
          error: {
            kind: "validation",
            code: "invalid-limit",
            message: "Giới hạn phải từ 1 đến 25.",
          },
        };
      }
      const search = query.search
        .trim()
        .normalize("NFC")
        .toLocaleLowerCase("vi");
      const options =
        scenario === "empty-catalog" ? [] : catalogFixtures[query.kind];
      return {
        kind: "success",
        value: options
          .filter(
            (option) =>
              option.isActive &&
              `${option.code} ${option.name}`
                .normalize("NFC")
                .toLocaleLowerCase("vi")
                .includes(search),
          )
          .slice(0, query.limit)
          .map((option) => ({ ...option })),
      };
    },
  };
}

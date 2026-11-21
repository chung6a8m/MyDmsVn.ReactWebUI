# WEB7-07 — Filters, danh sách và read/mutation feedback

**Ngày:** 2026-11-21 · **PR:** [#52](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/52) · **Branch:** `codex/web7-07-filters-feedback` · **Base:** `main@838f4d2c0cb45748ae98c1e034ed3d750d1d967c` (WEB7-06 đã merge). **Trạng thái:** SOURCE IMPLEMENTED / FINAL CI + INDEPENDENT REVIEW PENDING; không coi PR là DONE/merged.

## Scope và acceptance

| ID | Triển khai và oracle |
|---|---|
| W7-FIL-01 | Sales dùng `ProductLookup` có `required={false}` cho Customer/Warehouse/Employee/Product; raw và highlight không thay applied ID; clear explicit; giữ query cursor cho đến khi chọn/clear; sử dụng catalog port hiện có |
| W7-FIL-02 | Sales cursor reset khi committed filter thay; Receipt/Inventory page-number reset 1 khi filter/page-size áp dụng, giữ `totalCount` dưới dạng string/BigInt và từng API query |
| W7-FIL-03 | Stock Balances cho phép filter optional; Stock Card vẫn yêu cầu hai ID đã chọn. UTC raw trên Stock Card giữ nguyên từ frontend đến wire; helper `stockCardIssue`/schema hiện có giữ đúng 1–7 chữ số phần giây và thứ tự |
| W7-FIL-04 | Query actor/epoch/generation và cache hiding; Receipt raw filters reset khi actor đổi; 403 ngăn hiện rows và giữ lỗi nguồn; test đơn vị Sales epoch và Chromium Inventory cũ |
| W7-STA-01 | `MutationState` hiện pending/unknown ở Sales/Receipt document feedback, chỉ hiển thị; giữ nguyên các quy trình recovery, thao tác ghi, không tự retry hoặc unlock |
| W7-STA-02 | `ReadState` cho initial/loading/empty/no-match/error/forbidden, có read-only retry chỉ khi caller cung cấp; dùng tại Sales/Receipt/Inventory; Lab mô phỏng latency/error/forbidden/stale request |

Source thực hiện qua `src/features/{sales,goodsReceipt,inventory}/*ListPanel`/`InventoryReadPanel`; `src/shared/feedback/ReadState.tsx`, `src/shared/layout/FilterBar.tsx`, `src/lab/ReadStateStates.tsx`, document feedback hiện có. Không thêm endpoint, dependency, package, database schema, UI runtime hoặc mutate command.

## Verification ledger

| Candidate / run | Gate | Kết quả thực tế |
|---|---|---|
| WIP `ecc0bd1a` — [CI #44859467218](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44859467218) | typecheck | FAIL: `tests/components/SalesListEpoch.test.tsx:51` thiếu `)`; đã sửa tại `2a35219e` |
| PR candidate `8e7c4908` — [CI #44859671554](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44859671554) | typecheck + build | PASS; unit/component FAIL 5 test mới do Vitest không có jest-dom matcher và paging click trước khi load. Các test đã được sửa trong commit mới hơn, không xem lượt run này là PASS |
| Final docs-inclusive HEAD | typecheck/build/unit/Chromium/artifact | **PENDING / NOT YET VERIFIED**; kiểm tra SHA và run cuối trước review/merge |
| Microsoft Edge, attended IME/Telex/VNI/Narrator, zoom thật, SQL/HTTP thật, full IIS | ngoài phạm vi CI UI hiện tại | **NOT RUN**; không suy PASS từ Chromium mock/Lab |

### Tests và kiểm tra theo boundary

- `tests/components/feedback/ReadState.test.tsx`: trạng thái, read retry callback, pending/unknown không phát write.
- `tests/components/SalesListEpoch.test.tsx`: giữ epoch fence, typed lookup/committed ID/cursor, date raw và 403 hidden rows.
- `tests/e2e/sales-list-layout.spec.ts`: layout responsive Light/Dark, optional Sales lookup và clear, keyboard status và cursor.
- `tests/e2e/web3-inventory.spec.ts`: offset pagination, optional Warehouse/Product, selected ID vs unconfirmed raw, UTC 1–7 chữ số, 403, no unintended writes.
- `tests/e2e/web3-receipt.spec.ts`: giữ pageNumber/totalCount và read-denied behavior.
- `tests/e2e/web7-read-states.spec.ts`: DEV Lab latency/empty/error/forbidden/stale generation/mutation unknown.
- `tests/production/runtimeIsolation.spec.ts`: product artifact không được import Lab/fixtures; ghi kết quả sau full CI.

**CI commands (workflow `.github/workflows/web.yml`):** `npm ci`, `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run test:e2e -- --project=chromium --workers=2 --forbid-only`, `npm run test:e2e -- --config playwright.production.config.ts --workers=1 --forbid-only`. Tests thực chạy trên GitHub Actions ubuntu-24.04, Node 22.14.0/npm 11.6.0, Playwright Chromium; không phải Edge/SQL pilot. Candidate sau commit test fix cần run riêng; không mượn số liệu từ PR #51 hoặc candidate lỗi.

## Review/handoff

PR để Draft cho tới khi exact-HEAD CI PASS và independent code review. Cần rà lại event/focus lookup, abort/403/epoch, phân trang khác nhau, evidence Lab không leak, feedback unknown giữ bất biến WEB6; ghi findings và đóng sau review, không tự merge theo request triển khai. Staging **NOT ACCEPTED**, production **NO-GO**, ordinary resend **OFF** thuộc WEB6, không thay đổi.

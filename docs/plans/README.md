# Active roadmap

**Ngày chọn:** 2026-10-31. **Repo:** `chung6a8m/MyDmsVn.ReactWebUI`. **Nhánh:** `main`.

## Roadmap nền đã đóng — chưa có roadmap mới active

[20261031-001 — Web Workspace and Editing Foundation](20261031-001-web-workspace-editing-foundation.md)

**Trạng thái:** COMPLETED / automated fake scope, 2026-10-31. WEB-01–WEB-08 DONE; tổng hợp cuối 135 unit/component và 78 Chromium tests PASS. Edge/IME/screen reader attended PENDING, không có HTTP/auth thật. Plan/evidence giữ tại đường dẫn lịch sử và đóng theo phạm vi; bộ spec hiện hành tiếp tục là nguồn ownership. Đọc [thiết kế nền](../design/WEB_UI_FOUNDATION.md), [evidence](../evidence/20261031-web-foundation.md), [Codex handoff](../development/CODEX_HANDOFF.md) và [HTTP handoff](../development/HTTP_INTEGRATION_HANDOFF.md). Không tự chọn task kế tiếp.

| Task | Deliverable | Phụ thuộc | Trạng thái |
|---|---|---|---|
| WEB-01 | Toolchain + default UI shell + Lab routes + fake port contracts | — | DONE |
| WEB-02 | Document sessions + Dockview integration | WEB-01 | DONE |
| WEB-03 | Command routing + close admission | WEB-02 | DONE |
| WEB-04 | Floating UI lookup và popup/grid harness | WEB-01, WEB-02 | DONE |
| WEB-05 | Decimal/line editing + save barrier | WEB-02, WEB-03, WEB-04 | DONE |
| WEB-06 | Sales pilot + fake Save/Post/recovery/keyset | WEB-03, WEB-05 | DONE |
| WEB-07 | Layout persistence + integration hardening | WEB-06 | DONE |
| WEB-08 | Final evidence + API integration handoff | WEB-07 | DONE (bounded) |

Thứ tự phụ thuộc trên là lịch sử triển khai. Mỗi task giữ interface của spec; thay interface ở roadmap sau phải cập nhật consumer docs và tests tương ứng.

## Sau roadmap này

HTTP/runtime/auth thật, popout/floating, durable drafts/offline, printing/export và module tiếp theo chưa active. WEB-08 đã ghi điều kiện chọn roadmap transport/auth + Sales vertical slice trong [HTTP handoff](../development/HTTP_INTEGRATION_HANDOFF.md), không tự kích hoạt chúng. Không mang backlog hoặc pending acceptance của repo WinForms sang đây.

## Quy tắc cập nhật

Cập nhật task và [evidence](../evidence/20261031-web-foundation.md) trong commit triển khai; ghi chính xác phần đã chạy. Khi roadmap kết thúc, giữ một bộ spec hiện hành, archive plan/evidence theo phạm vi; không đổi trạng thái lịch sử thành runtime PASS của candidate mới.

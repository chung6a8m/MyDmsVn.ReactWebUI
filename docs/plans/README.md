# Active roadmap

**Ngày chọn:** 2026-10-31. **Repo:** `chung6a8m/MyDmsVn.ReactWebUI`. **Nhánh:** `main`.

## Roadmap duy nhất đang active

[20261031-001 — Web Workspace and Editing Foundation](20261031-001-web-workspace-editing-foundation.md)

**Trạng thái:** ACTIVE / IN PROGRESS. WEB-01–WEB-06 đã triển khai và kiểm chứng; WEB-07–WEB-08 chưa triển khai. Task kế tiếp **WEB-07**. Đọc [thiết kế nền](../design/WEB_UI_FOUNDATION.md), [evidence](../evidence/20261031-web-foundation.md) và [handoff](../development/CODEX_HANDOFF.md) trước khi làm.

| Task | Deliverable | Phụ thuộc | Trạng thái |
|---|---|---|---|
| WEB-01 | Toolchain + default UI shell + Lab routes + fake port contracts | — | DONE |
| WEB-02 | Document sessions + Dockview integration | WEB-01 | DONE |
| WEB-03 | Command routing + close admission | WEB-02 | DONE |
| WEB-04 | Floating UI lookup và popup/grid harness | WEB-01, WEB-02 | DONE |
| WEB-05 | Decimal/line editing + save barrier | WEB-02, WEB-03, WEB-04 | DONE |
| WEB-06 | Sales pilot + fake Save/Post/recovery/keyset | WEB-03, WEB-05 | DONE |
| WEB-07 | Layout persistence + integration hardening | WEB-06 | PLANNED |
| WEB-08 | Final evidence + API integration handoff | WEB-07 | PLANNED |

WEB-03 và WEB-04 có thể làm song song sau WEB-02 nếu file ownership tách rõ. Mỗi task giữ interface của spec; thay interface phải cập nhật consumer docs và tests tương ứng.

## Sau roadmap này

HTTP/runtime/auth thật, popout/floating, durable drafts/offline, printing/export và module tiếp theo chưa active. WEB-08 ghi điều kiện để chọn roadmap mới, không tự kích hoạt chúng. Không mang backlog hoặc pending acceptance của repo WinForms sang đây.

## Quy tắc cập nhật

Cập nhật task và [evidence](../evidence/20261031-web-foundation.md) trong commit triển khai; ghi chính xác phần đã chạy. Khi roadmap kết thúc, giữ một bộ spec hiện hành, archive plan/evidence theo phạm vi; không đổi trạng thái lịch sử thành runtime PASS của candidate mới.

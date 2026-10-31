# Active roadmap

**Ngày chọn:** 2026-10-31. **Repo:** `chung6a8m/MyDmsVn.ReactWebUI`. **Nhánh gốc:** `main`. **Trạng thái:** Roadmap 02 ACTIVE / WEB2-01–09 DONE (bounded backend + frontend automated HTTP scope), WEB2-10 IN_PROGRESS (full IIS acceptance BLOCKED); roadmap 01 COMPLETED (fake scope).

## ACTIVE — Roadmap 02 HTTP/JWT + Sales end-to-end

**Owner chọn ngày 2026-10-31:** [20261031-002 — net48 HTTP, Bearer JWT + Sales end-to-end](20261031-002-http-jwt-sales-vertical-slice.md). Web frontend giữ Zustand document session, Nova/Base UI, AG Grid Community, Dockview; backend giữ net48 và thêm thin Web API 2 HTTP host. Access JWT thời gian sống ngắn lưu localStorage theo lựa chọn Owner (rủi ro XSS phải harden), refresh GUID ở HttpOnly Secure Strict host-only cookie, rotate/hash trong SQL. HTTP wire DTO riêng dùng string cho int64/decimal. **WEB2-01–09 DONE trong phạm vi backend + frontend automated HTTP; WEB2-10 IN_PROGRESS. Pilot IIS Express/SQL/browser đã PASS trong phạm vi automated theo evidence; full IIS acceptance BLOCKED do môi trường chưa cài IIS.** Đọc [thiết kế frontend](../design/WEB2_FRONTEND_INTEGRATION.md), [Codex handoff](../development/WEB2_CODEX_HANDOFF.md), [evidence](../evidence/20261031-web2-http-jwt-sales.md), [backend companion](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/plans/20261031-003-web2-http-jwt-sales-server.md).

WEB2-01 contract → WEB2-02/03 backend host/auth persistence + WEB2-06 frontend runtime injection (có thể song song) → WEB2-04 auth routes → WEB2-05 Sales/Catalog endpoints → WEB2-07 browser auth → WEB2-08 exact wire/read → WEB2-09 Save/Post/recovery → WEB2-10 acceptance. Chi tiết dependency/gates nằm trong plan; không tự nhận kết quả fake trước làm HTTP PASS. Backend có active roadmap WinForms riêng, không thay thế nó.

## Roadmap 01 đã đóng — lịch sử fake foundation

[20261031-001 — Web Workspace and Editing Foundation](20261031-001-web-workspace-editing-foundation.md)

**Trạng thái:** COMPLETED / automated fake scope, 2026-10-31. WEB-01–WEB-08 DONE; tổng hợp cuối 135 unit/component và 78 Chromium tests PASS. 24/24 bước Edge/Telex/VNI/Narrator attended được Owner xác nhận PASS; không có HTTP/auth thật. Plan/evidence giữ tại đường dẫn lịch sử và đóng theo phạm vi; bộ spec hiện hành tiếp tục là nguồn ownership. Đọc [thiết kế nền](../design/WEB_UI_FOUNDATION.md), [evidence](../evidence/20261031-web-foundation.md), [Codex handoff](../development/CODEX_HANDOFF.md) và [HTTP handoff](../development/HTTP_INTEGRATION_HANDOFF.md). Không tự chọn task kế tiếp.

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

## Phạm vi chưa chọn

Durable drafts/offline, popout/floating, printing/export và module tiếp theo chưa active. HTTP/auth/Sales đã được Owner chọn riêng ở Roadmap 02; không chuyển các backlog/pending acceptance WinForms sang Web.

## Quy tắc cập nhật

Cập nhật task WEB2 và [WEB2 evidence](../evidence/20261031-web2-http-jwt-sales.md) trong commit triển khai; giữ nguyên [WEB-01–08 evidence](../evidence/20261031-web-foundation.md); ghi chính xác phần đã chạy. Khi roadmap kết thúc, giữ một bộ spec hiện hành, archive plan/evidence theo phạm vi; không đổi trạng thái lịch sử thành runtime PASS của candidate mới.

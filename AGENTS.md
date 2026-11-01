# Hướng dẫn làm việc — MyDmsVn.ReactWebUI

**WEB3-04 Owner acceptance (2026-11-01):** F03/F04 **DONE (bounded)**; Owner authorized frontend PR #15 and backend PR #77 merge using recorded evidence. CI is not configured in either repository; no CI PASS is claimed. Existing acceptance limits and F05/F06 scope remain unchanged. The owning plan/evidence record this decision; earlier candidate wording describes the implementation checkpoint.

## Active Roadmap 03 — Owner selection 2026-11-01

**Roadmap 03 is SELECTED; WEB3-01 merged; WEB3-02 DONE (bounded), Owner accepted 2026-11-01 for merge through PR #14. WEB3-04 (F03/F04) is selected and implemented on its candidate branch; verification/review and remaining acceptance are recorded in [WEB3-04 evidence](docs/evidence/web3/20261101-web3-04-goods-receipt.md). WEB3-05 (F05 Inventory UI) is DONE (bounded): Owner accepted the verified scope/limits and PR #16 merged on 2026-11-01; the active plan and F05 evidence own the decision. F06 integrated acceptance remains NOT STARTED.** The [active WEB3 F01–F06 plan](docs/plans/20261101-001-web3-goods-receipt-inventory-web.md) owns task status and checkpoint review/acceptance. The B01 canonical corpus is consumed through the pinned WEB3 fixture provenance. Read [multi-module Workspace design](docs/design/WEB3_MULTI_MODULE_WORKSPACE.md), [Goods Receipt / Inventory Web design](docs/design/WEB3_GOODS_RECEIPT_INVENTORY_UI.md), [acceptance scenarios](docs/development/WEB3_ACCEPTANCE_MATRIX.md), [Codex handoff](docs/development/WEB3_CODEX_HANDOFF.md) and [WEB3 evidence index](docs/evidence/web3/README.md). Backend [WEB3 companion](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/plans/20261101-002-web3-goods-receipt-inventory-http.md) owns HTTP/auth/SQL/real pilot B01–B05, not frontend task status. Activation and F01 checkpoint documentation imply no WEB3 runtime acceptance.

**WEB3 focus:** reuse existing net48 host, JWT + SQL-backed refresh, strict int64/decimal string wire and Sales regressions; extract only minimal module-neutral Dockview registration/close/commands/layout v1→v2, keep Sales/Receipt store and business validation separate, add Goods Receipt Draft/Post with unique products and read-only Stock Balances/Stock Card. Receipt Post ack does not return version. No automatic retry after dispatched writes; no fake stock/identity; backend SQL ledger/valuation is authoritative. Existing CEX WinForms roadmap in backend stays parallel and unchanged.

**Archived Roadmap 02:** Owner closed WEB2 as COMPLETED WITH OWNER_ACCEPTED_EXCEPTION on 2026-11-01; IIS Express HTTPS/SQL/Chromium/Edge pilot verified, full IIS **NOT RUN** and accepted for closeout, **not** PASS/production release. Keep the [WEB2 archive](docs/archive/20261101-web2-http-jwt-sales/README.md), [evidence](docs/evidence/20261031-web2-http-jwt-sales.md) and [technical contract](docs/design/WEB2_FRONTEND_INTEGRATION.md) as references, not task queues. Preserve WEB1/WEB2 original evidence.

**Retained security:** short-lived Bearer JWT access in browser localStorage (known XSS risk); refresh GUID only in HttpOnly Secure SameSite=Strict cookie with SQL rotation/revocation. Client never reads refresh; no automatic Create/Update/Post retry. Keep same-origin HTTPS, Origin/CSRF and CSP, server-owned actor/permissions, Lab isolation and no broad SQL grants. Full IIS/production, audit retention, distributed limiter, idempotency and durable drafts are separate future authorizations.

## Đọc theo nhiệm vụ

Đọc [README](README.md), [active roadmap](docs/plans/README.md), task được chọn, [thiết kế nền](docs/design/WEB_UI_FOUNDATION.md), thiết kế boundary liên quan và [Test Policy](docs/TEST_POLICY.md). Trạng thái triển khai và kiểm chứng lấy từ roadmap/evidence; không báo có ứng dụng chạy hoặc API thật khi chưa triển khai và kiểm chứng.

## Quyết định sản phẩm

- React + TypeScript + Vite; Tailwind CSS v4; shadcn/ui **Nova + Base UI**.
- Giữ typography, spacing, radius và palette do preset sinh ra. Không mang Business Compact, font 14px bắt buộc, WinFormsKit hoặc control WinForms vào frontend.
- AG Grid **Community**; Dockview; Floating UI cho lookup tùy biến. Không dùng tính năng Enterprise dưới tên Community.
- Dùng component/editor sẵn có khi đáp ứng hợp đồng. Chỉ tạo adapter hoặc component nghiệp vụ có nhu cầu cụ thể; không bọc lại mọi Button/Input hoặc tạo framework UI tổng quát.
- Một popup có một chủ quản lý positioning/focus/dismiss. ProductLookup trực tiếp dùng Floating UI; không ghép thêm Positioner/Combobox controller của Base UI cho chính popup đó.

## Ranh giới phải bảo toàn

- Dockview quản lý layout. Ứng dụng quản lý `documentSessionId`, raw buffers, draft, dirty, quyền/capabilities theo authenticated actor, mutation và recovery.
- Di chuyển panel có thể phát sự kiện remove/add. Chỉ giải phóng phiên tài liệu qua quy trình đóng được ứng dụng chấp thuận.
- Dirty bao gồm text chưa hợp lệ/chưa commit. Save dùng barrier và snapshot mới nhất; Discard có thể bỏ buffer không hợp lệ; Cancel giữ nguyên. Pending/unknown mutation chưa được giải quyết thì không bỏ phiên.
- Mọi đường đóng panel, đóng nhóm/nhiều tab và reset/restore layout đều đi qua admission chung.
- ID dòng độc lập với Product ID; cùng sản phẩm có thể xuất hiện nhiều dòng. Không dùng index hoặc Product ID làm React/grid row identity.
- Giá trị số chính xác dùng decimal strings và phép tính thập phân; ngày chứng từ dùng `yyyy-MM-dd`; version là opaque. Không suy diễn protocol HTTP từ kiểu frontend.
- Chụp session/document identity và generation trước async; kết quả muộn không áp vào phiên hoặc actor mới. Hủy request ở client không chứng minh mutation đã rollback.
- Save/Post không tự retry. Fake capability không phải cơ chế bảo mật production. Fake recovery không tạo ra cam kết idempotency của backend.

## Cách triển khai

Chỉ làm task thuộc roadmap mới được Owner chọn; giữ commit vừa phạm vi. `src/`, `tests/` và Lab/HTTP adapters đã tồn tại; kiểm tra source và dependency pins thực tế trên HEAD trước khi thay đổi. Không tự chạy lại task từ roadmap đã archive.

Ưu tiên kiểm tra boundary thay đổi. Không tạo test chỉ để đếm file/config hoặc khóa nguyên chuỗi Tailwind. Khi sửa lỗi hành vi, tái hiện lỗi rồi thêm kiểm tra tập trung. Task frontend giả lập chỉ chạy kiểm tra frontend tương ứng; nghiệm thu HTTP/SQL thật phải theo test policy và runbook của cả hai repo, không suy PASS từ fake.

Đọc [nguồn khảo sát](docs/references/TECHNICAL_BASELINE.md) trước khi khẳng định API bên thứ ba. Kiểm tra mã/type của dependency đang pin thực tế; source khảo sát không thay dependency lock.

## Báo cáo

Khi có task mới được chọn, ghi commit, browser/runtime, kịch bản, lệnh, số test thực chạy, kết quả và giới hạn vào **evidence của task mới**, không thêm các chạy thử mới vào [WEB-01–08 evidence](docs/evidence/20261031-web-foundation.md) hoặc [WEB2 evidence](docs/evidence/20261031-web2-http-jwt-sales.md) đã đóng. Tách kiểm tra tài liệu, automated browser và thao tác IME có người dùng. Build xanh không thay browser acceptance; fake API không thay integration thật.

Không tạo vòng xin duyệt lặp lại cho lựa chọn triển khai đã được tài liệu quyết định. Với thay đổi vượt phạm vi như backend/runtime thật, Enterprise, giao diện tùy biến hoặc popout, trình bày thay đổi cụ thể trước khi mở rộng. Tuân thủ chỉ dẫn mới nhất của Owner nếu có xung đột.

## Files

UTF-8 không BOM, LF; giữ dấu tiếng Việt. Tránh nhân bản spec: thêm quy tắc vào tài liệu sở hữu, rồi liên kết từ roadmap/handoff. Không tạo bản tài liệu trong repo desktop hoặc repo docs cũ.

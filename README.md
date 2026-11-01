# MyDmsVn.ReactWebUI

Frontend Web cho MyDmsVn, ưu tiên hành vi nhập liệu và quản lý tài liệu. Nền được chọn: **React + TypeScript + Vite, Tailwind CSS v4, shadcn/ui Nova trên Base UI, AG Grid Community và Dockview**. Lookup sản phẩm dùng Floating UI theo hợp đồng tích hợp riêng.

**Roadmap 02 đã đóng theo quyết định Owner ngày 01/11/2026: COMPLETED WITH OWNER_ACCEPTED_EXCEPTION.** [Bản archive và giới hạn nghiệm thu](docs/archive/20261101-web2-http-jwt-sales/README.md) · [WEB2 evidence](docs/evidence/20261031-web2-http-jwt-sales.md#2026-11-01--owner-closeout-and-full-iis-exception) · [selector hiện hành](docs/plans/README.md). WEB2-01–09 DONE; WEB2-10 DONE trong phạm vi IIS Express HTTPS + SQL thật + Chromium/Edge. **Nghiệm thu full IIS vẫn NOT RUN, được Owner chấp nhận như ngoại lệ (không phải PASS hoặc phê duyệt production).** Phần backend giữ net48 Web API 2; JWT access ngắn trong localStorage và refresh GUID ở HttpOnly cookie với SQL rotation; rủi ro XSS của localStorage còn tồn tại. **Roadmap 03 đang ACTIVE; WEB3-01 đã merge. WEB3-02 đã triển khai Workspace đa module, capability và layout v2; [evidence F02](docs/evidence/web3/20261101-web3-02-multi-module-workspace.md) ghi kiểm chứng cùng regression Sales. Receipt/Inventory production runtime và nghiệm thu WEB3 tích hợp vẫn thuộc F03–F06.**

**Roadmap 03 — Goods Receipt & Inventory Web Integration (Owner 01/11/2026):** [active frontend plan](docs/plans/20261101-001-web3-goods-receipt-inventory-web.md) · [kiến trúc Workspace đa module](docs/design/WEB3_MULTI_MODULE_WORKSPACE.md) · [Goods Receipt/Inventory UI](docs/design/WEB3_GOODS_RECEIPT_INVENTORY_UI.md) · [ma trận nghiệm thu](docs/development/WEB3_ACCEPTANCE_MATRIX.md) · [Codex handoff](docs/development/WEB3_CODEX_HANDOFF.md). Backend có [companion plan WEB3-B01–B05](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/plans/20261101-002-web3-goods-receipt-inventory-http.md); công việc CEX WinForms trên repo backend vẫn active và độc lập. F02 có Receipt/Inventory lifetime stub trong Lab; chưa triển khai API/UI nghiệp vụ Receipt/Inventory thật. Không coi WEB2 full IIS exception là PASS và không cho phép production release từ việc chọn WEB3.

**Roadmap 01 — historical fake foundation (2026-10-31): WEB-01–WEB-08 DONE trong automated fake scope.** App/Sales Lab dùng chung danh sách keyset và tài liệu Sales: Create/Save/Post, quyền độc lập, conflict và recovery qua fake ports. Header, grid bảy cột, decimal chính xác, save barrier và close admission đã có kiểm chứng. Bố cục được lưu theo allowlist; reload đọc lại chứng từ, không khôi phục draft. WEB-08: 135 unit/component và 78 Chromium tests PASS; follow-up favicon: 78 Edge + 4 Chromium smoke PASS; 24/24 bước Edge/Telex/VNI/Narrator attended được Owner xác nhận PASS (phạm vi chi tiết trong evidence). Roadmap 01 chưa tích hợp API thật (WEB2 được nghiệm thu riêng). Xem [evidence](docs/evidence/20261031-web-foundation.md) và [HTTP handoff](docs/development/HTTP_INTEGRATION_HANDOFF.md).

## Chạy nền Web

Node **22.14.0** (dòng Maintenance LTS 22), npm **11.6.0**. Dùng `npm ci`, `npx playwright install chromium`, rồi `npm run dev`.

- `/`: đăng nhập và Sales workspace qua HTTP cùng origin; access JWT trong localStorage, refresh qua HttpOnly cookie. Chạy thật bằng cách đưa build vào HTTP host HTTPS theo [hướng dẫn](docs/design/WEB2_FRONTEND_INTEGRATION.md#8-chạy-frontend-http-và-giới-hạn-môi-trường). `npm run dev` không tự cung cấp backend. Không có fake fallback.
- `/lab/sales` (chỉ dev): dùng production `SalesWorkspace` với 36 chứng từ mẫu và fake dependencies explicit; scenario allowlist gồm `default`, `success`, `known-failure`, `forbidden`, `version-conflict`, `reference-conflict`, `delay`, `commit-then-response-lost`, `eventual-commit`. `/lab/components` giữ catalog/lookup harness (`default`, `empty-catalog`). Giá trị khác fallback về `default`.
- Kiểm tra: `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run test:e2e -- --project=chromium`. Sau build, kiểm tra artifact với `npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1`; production không có Lab hoặc fixture modules.
- Regression Edge khi máy đã cài Microsoft Edge: `npm.cmd run test:e2e -- --config playwright.edge.config.ts --workers=2`. Native zoom test tự mở bundled Chromium được loại khỏi suite Edge; kết quả automated không thay attended IME/Narrator.

Trong PowerShell, dùng `npm.cmd` thay `npm` khi truyền arguments sau `--` nếu wrapper `npm.ps1` nuốt flags. Có thể sửa header/lookup/decimal, thêm dòng (tối đa 200), bật Tặng, kiểm tra snapshot và Create/Save/Post vào dataset giả lập; mở lại phiên dirty, kéo tab, tách sang phải và resize giữ dữ liệu. Sales Lab có dữ liệu kiểm tra 200 dòng và điều khiển fake ngoài vùng sản phẩm: quyền, outcome, read mode, hoàn tất request trễ. Unknown khóa sửa/đóng/Discard; đọc lại, đối chiếu và xác nhận mới mở khóa. Create unknown cần chọn ứng viên qua list/Get; không tự tạo lại. Danh sách mặc định 25 mục, lọc đặt lại cursor; dùng Tải lại danh sách sau mutation để đọc dataset mới. Nút **Đánh dấu phiên** hoặc `Ctrl+Alt+M` kiểm tra đích lệnh trong edit harness, không Save/Post. Chuyển app/Lab giữ session trong bộ nhớ; tải lại trang mất draft. X/middle-click, toolbar đóng và Ctrl+Alt+W dùng admission WEB-03. Mở chứng từ → **Kiểm tra lookup** để thử lookup field/grid/modal WEB-04; Components Lab có hướng dẫn. Đóng tab danh sách/chỉ đọc và reset/restore đều qua policy chung F02; group menu/floating/popout chưa expose.

## Bắt đầu

1. Đọc [AGENTS.md](AGENTS.md).
2. Đọc [thiết kế nền Web](docs/design/WEB_UI_FOUNDATION.md).
3. Đọc [roadmap index](docs/plans/README.md): Roadmap 01 và 02 đã đóng trong phạm vi riêng; full IIS là Owner-accepted exception. Roadmap 03 đã được chọn; trạng thái từng task và gate B01 nằm trong active plan.
4. Dùng [Codex handoff](docs/development/CODEX_HANDOFF.md) để giao việc.

## Tài liệu chính

| Tài liệu | Nội dung |
|---|---|
| [Web UI Foundation](docs/design/WEB_UI_FOUNDATION.md) | Quyết định, phạm vi, kiến trúc và ranh giới trạng thái |
| [Workspace Behavior](docs/design/WORKSPACE_BEHAVIOR.md) | Dockview, phiên tài liệu, đóng tab, focus và lưu layout |
| [Lookup and Grid Editing](docs/design/LOOKUP_AND_GRID_EDITING.md) | Floating UI, lookup, raw buffer, editor và keyboard |
| [Sales Pilot](docs/design/SALES_PILOT.md) | Nghiệp vụ, kiểu dữ liệu, fake ports và tình huống pilot |
| [Test Policy](docs/TEST_POLICY.md) | Phạm vi kiểm tra, lệnh dự kiến và bằng chứng cần ghi |
| [Technical Baseline](docs/references/TECHNICAL_BASELINE.md) | Nguồn chính thức, mốc khảo sát và giới hạn suy luận |
| [Evidence](docs/evidence/20261031-web-foundation.md) | Trạng thái tài liệu và kết quả thực thi khi có |
| [HTTP Integration Handoff](docs/development/HTTP_INTEGRATION_HANDOFF.md) | Mapping C# source và quyết định cần có trước HTTP/auth thật |

## Phạm vi đã hoàn thành

Một ứng dụng và Web UI Lab dùng chung production components, với Sales pilot qua fake async ports: danh sách có cursor, mở nhiều chứng từ, nhập dòng, Save/Post giả lập, validation, conflict và khôi phục sau kết quả không chắc chắn. Dockview hỗ trợ tab, docking, split và resize trong cùng cửa sổ.

Typography, spacing, màu và radius dùng mặc định Nova; grid dùng Quartz và workspace dùng theme dựng sẵn. Một nguồn Light/Dark điều phối chế độ. Không áp dụng Business Compact hoặc override font 14px. CSS bố cục, overflow, portal và focus được phép khi cần cho hành vi.

WEB2-07–09 đã nối HTTP/auth và Save/Post/recovery. WEB2-10 kiểm chứng production Web build qua **IIS Express HTTPS/net48 + SQL Server non-production thật**, 8 Chromium + 8 Edge và SQL stock/COGS oracle theo [runbook](docs/development/WEB2_PILOT_RUNBOOK.md) và [evidence](docs/evidence/20261031-web2-http-jwt-sales.md). Full IIS được Owner chấp nhận là ngoại lệ **NOT RUN**, không phải PASS/production approval; popout, durable draft/offline, in/xuất vẫn deferred. Kết quả fake foundation và HTTP pilot được ghi độc lập.

## Quy ước

- Tài liệu tiếng Việt; định danh code và API bằng tiếng Anh.
- UTF-8 **không BOM**, LF cho repo React/Node này, bao gồm tài liệu mới.
- [Chỉ mục roadmap](docs/plans/README.md) là nguồn duy nhất chọn việc đang active.
- Quy tắc nghiệp vụ tham chiếu MyDmsVn được giữ; theme, WinFormsKit, native test policy và roadmap của repo desktop không được nhập vào repo này.

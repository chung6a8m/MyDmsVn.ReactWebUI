# MyDmsVn.ReactWebUI

Frontend Web cho MyDmsVn, ưu tiên hành vi nhập liệu và quản lý tài liệu. Nền được chọn: **React + TypeScript + Vite, Tailwind CSS v4, shadcn/ui Nova trên Base UI, AG Grid Community và Dockview**. Lookup sản phẩm dùng Floating UI theo hợp đồng tích hợp riêng.

**Roadmap HTTP được chọn ngày 2026-10-31 (WEB2-01–03 hoàn tất contract/host/SQL session; frontend HTTP runtime còn planned):** [Roadmap 02 — HTTP/JWT + Sales end-to-end](docs/plans/20261031-002-http-jwt-sales-vertical-slice.md). Giữ backend net48 + IIS thin HTTP host; access Bearer JWT ngắn lưu localStorage theo lựa chọn Owner, refresh GUID cookie HttpOnly Secure Strict với rotation/hashed SQL; real Sales/Catalog + auth qua API, không thay fake pilot/đánh đồng với HTTP đã chạy. Xem [WEB2 frontend design](docs/design/WEB2_FRONTEND_INTEGRATION.md) và [Codex handoff](docs/development/WEB2_CODEX_HANDOFF.md). Lưu ý localStorage bearer còn rủi ro XSS và yêu cầu CSP/security acceptance.

**Cập nhật: 2026-10-31. WEB-01–WEB-08 DONE; roadmap COMPLETED trong automated fake scope.** App/Sales Lab dùng chung danh sách keyset và tài liệu Sales: Create/Save/Post, quyền độc lập, conflict và recovery qua fake ports. Header, grid bảy cột, decimal chính xác, save barrier và close admission đã có kiểm chứng. Bố cục được lưu theo allowlist; reload đọc lại chứng từ, không khôi phục draft. WEB-08: 135 unit/component và 78 Chromium tests PASS; follow-up favicon: 78 Edge + 4 Chromium smoke PASS; 24/24 bước Edge/Telex/VNI/Narrator attended được Owner xác nhận PASS (phạm vi chi tiết trong evidence). Không có API thật. Xem [evidence](docs/evidence/20261031-web-foundation.md) và [HTTP handoff](docs/development/HTTP_INTEGRATION_HANDOFF.md).

## Chạy nền Web

Node **22.14.0** (dòng Maintenance LTS 22), npm **11.6.0**. Dùng `npm ci`, `npx playwright install chromium`, rồi `npm run dev`.

- `/`: Sales workspace với danh sách 36 chứng từ mẫu và toolbar mở chứng từ mẫu 1001/1002 hoặc chứng từ mới.
- `/lab/sales`: cùng `SalesWorkspace` với app; scenario allowlist gồm `default`, `success`, `known-failure`, `forbidden`, `version-conflict`, `reference-conflict`, `delay`, `commit-then-response-lost`, `eventual-commit`. `/lab/components` giữ catalog/lookup harness (`default`, `empty-catalog`). Giá trị khác fallback về `default`.
- Kiểm tra: `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run test:e2e -- --project=chromium`.
- Regression Edge khi máy đã cài Microsoft Edge: `npm.cmd run test:e2e -- --config playwright.edge.config.ts --workers=2`. Native zoom test tự mở bundled Chromium được loại khỏi suite Edge; kết quả automated không thay attended IME/Narrator.

Trong PowerShell, dùng `npm.cmd` thay `npm` khi truyền arguments sau `--` nếu wrapper `npm.ps1` nuốt flags. Có thể sửa header/lookup/decimal, thêm dòng (tối đa 200), bật Tặng, kiểm tra snapshot và Create/Save/Post vào dataset giả lập; mở lại phiên dirty, kéo tab, tách sang phải và resize giữ dữ liệu. Sales Lab có dữ liệu kiểm tra 200 dòng và điều khiển fake ngoài vùng sản phẩm: quyền, outcome, read mode, hoàn tất request trễ. Unknown khóa sửa/đóng/Discard; đọc lại, đối chiếu và xác nhận mới mở khóa. Create unknown cần chọn ứng viên qua list/Get; không tự tạo lại. Danh sách mặc định 25 mục, lọc đặt lại cursor; dùng Tải lại danh sách sau mutation để đọc dataset mới. Nút **Đánh dấu phiên** hoặc `Ctrl+Alt+M` kiểm tra đích lệnh trong edit harness, không Save/Post. Chuyển app/Lab giữ session trong bộ nhớ; tải lại trang mất draft. X/middle-click, toolbar đóng và Ctrl+Alt+W dùng admission WEB-03. Mở chứng từ → **Kiểm tra lookup** để thử lookup field/grid/modal WEB-04; Components Lab có hướng dẫn. Menu/group close/reset/floating/popout chưa expose.

## Bắt đầu

1. Đọc [AGENTS.md](AGENTS.md).
2. Đọc [thiết kế nền Web](docs/design/WEB_UI_FOUNDATION.md).
3. Đọc [roadmap index](docs/plans/README.md): roadmap 02 active, WEB2-01–03 DONE trong phạm vi contract/host/SQL session, WEB2-04–10 PLANNED; full IIS/browser/Sales pilot chưa nghiệm thu; roadmap nền đã đóng.
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

Tích hợp HTTP thật, login/token thật, thay đổi backend `net48`, popout/floating, lưu bản nháp bền vững, offline và in ấn là phạm vi tiếp theo. Hoàn thành roadmap này không chứng nhận các phần đó hoặc kết quả nghiệp vụ trên SQL Server.

## Quy ước

- Tài liệu tiếng Việt; định danh code và API bằng tiếng Anh.
- UTF-8 **không BOM**, LF cho repo React/Node này, bao gồm tài liệu mới.
- [Chỉ mục roadmap](docs/plans/README.md) là nguồn duy nhất chọn việc đang active.
- Quy tắc nghiệp vụ tham chiếu MyDmsVn được giữ; theme, WinFormsKit, native test policy và roadmap của repo desktop không được nhập vào repo này.

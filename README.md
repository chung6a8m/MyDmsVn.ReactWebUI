# MyDmsVn.ReactWebUI

Frontend Web cho MyDmsVn, ưu tiên hành vi nhập liệu và quản lý tài liệu. Nền được chọn: **React + TypeScript + Vite, Tailwind CSS v4, shadcn/ui Nova trên Base UI, AG Grid Community và Dockview**. Lookup sản phẩm dùng Floating UI theo hợp đồng tích hợp riêng.

**Cập nhật: 2026-10-31. Trạng thái: WEB-01–WEB-02 IMPLEMENTED.** Shell/Lab, contracts, fake catalog và document sessions với Dockview edit harness đã có kiểm chứng. Sales editing đầy đủ, close admission và Save/Post chưa triển khai; không có API thật. Xem [evidence](docs/evidence/20261031-web-foundation.md).

## Chạy nền Web

Node **22.14.0** (dòng Maintenance LTS 22), npm **11.6.0**. Dùng `npm ci`, `npx playwright install chromium`, rồi `npm run dev`.

- `/`: shell với panel danh mục mẫu và toolbar mở chứng từ mẫu 1001/1002 hoặc chứng từ mới.
- `/lab/sales`, `/lab/components`: cùng `FoundationWorkspace`; query `scenario=default` hoặc `scenario=empty-catalog`. Giá trị khác fallback về `default`.
- Kiểm tra: `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run test:e2e -- --project=chromium`.

Trong PowerShell, dùng `npm.cmd` thay `npm` khi truyền arguments sau `--` nếu wrapper `npm.ps1` nuốt flags. WEB-02 cho phép nhập ghi chú/raw số lượng, mở lại phiên dirty, kéo tab, tách sang phải và resize. Nút **Đánh dấu phiên** hoặc `Ctrl+Alt+M` kiểm tra đích lệnh trong edit harness, không Save/Post. Chuyển app/Lab giữ session trong bộ nhớ; tải lại trang mất draft. Close/menu/floating/popout chưa cung cấp; WEB-03 bổ sung admission trước khi mở đường đóng.

## Bắt đầu

1. Đọc [AGENTS.md](AGENTS.md).
2. Đọc [thiết kế nền Web](docs/design/WEB_UI_FOUNDATION.md).
3. Đi theo [active roadmap](docs/plans/README.md), task kế tiếp **WEB-03**.
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

## Phạm vi active

Một ứng dụng và Web UI Lab dùng chung production components, với Sales pilot qua fake async ports: danh sách có cursor, mở nhiều chứng từ, nhập dòng, Save/Post giả lập, validation, conflict và khôi phục sau kết quả không chắc chắn. Dockview hỗ trợ tab, docking, split và resize trong cùng cửa sổ.

Typography, spacing, màu và radius dùng mặc định Nova; grid dùng Quartz và workspace dùng theme dựng sẵn. Một nguồn Light/Dark điều phối chế độ. Không áp dụng Business Compact hoặc override font 14px. CSS bố cục, overflow, portal và focus được phép khi cần cho hành vi.

Tích hợp HTTP thật, login/token thật, thay đổi backend `net48`, popout/floating, lưu bản nháp bền vững, offline và in ấn là phạm vi tiếp theo. Hoàn thành roadmap này không chứng nhận các phần đó hoặc kết quả nghiệp vụ trên SQL Server.

## Quy ước

- Tài liệu tiếng Việt; định danh code và API bằng tiếng Anh.
- UTF-8 **không BOM**, LF cho repo React/Node này, bao gồm tài liệu mới.
- [Chỉ mục roadmap](docs/plans/README.md) là nguồn duy nhất chọn việc đang active.
- Quy tắc nghiệp vụ tham chiếu MyDmsVn được giữ; theme, WinFormsKit, native test policy và roadmap của repo desktop không được nhập vào repo này.

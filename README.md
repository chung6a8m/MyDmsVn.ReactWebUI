# MyDmsVn.ReactWebUI

Frontend Web cho MyDmsVn, ưu tiên hành vi nhập liệu và quản lý tài liệu. Nền được chọn: **React + TypeScript + Vite, Tailwind CSS v4, shadcn/ui Nova trên Base UI, AG Grid Community và Dockview**. Lookup sản phẩm dùng Floating UI theo hợp đồng tích hợp riêng.

**Cập nhật: 2026-10-31. Trạng thái: DOCUMENTATION FOUNDATION; chưa có mã ứng dụng, package lock, build hoặc browser acceptance.** Các tên file/API trong thiết kế là đề xuất cho triển khai, trừ những API thư viện được dẫn nguồn rõ ràng.

## Bắt đầu

1. Đọc [AGENTS.md](AGENTS.md).
2. Đọc [thiết kế nền Web](docs/design/WEB_UI_FOUNDATION.md).
3. Đi theo [active roadmap](docs/plans/README.md), bắt đầu **WEB-01**.
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

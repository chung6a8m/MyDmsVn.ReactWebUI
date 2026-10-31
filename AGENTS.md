# Hướng dẫn làm việc — MyDmsVn.ReactWebUI

## Đọc theo nhiệm vụ

Đọc [README](README.md), [active roadmap](docs/plans/README.md), task được chọn, [thiết kế nền](docs/design/WEB_UI_FOUNDATION.md), thiết kế boundary liên quan và [Test Policy](docs/TEST_POLICY.md). Trạng thái triển khai và kiểm chứng lấy từ roadmap/evidence; không báo có ứng dụng chạy hoặc API thật khi chưa triển khai và kiểm chứng.

## Quyết định sản phẩm

- React + TypeScript + Vite; Tailwind CSS v4; shadcn/ui **Nova + Base UI**.
- Giữ typography, spacing, radius và palette do preset sinh ra. Không mang Business Compact, font 14px bắt buộc, WinFormsKit hoặc control WinForms vào frontend.
- AG Grid **Community**; Dockview; Floating UI cho lookup tùy biến. Không dùng tính năng Enterprise dưới tên Community.
- Dùng component/editor sẵn có khi đáp ứng hợp đồng. Chỉ tạo adapter hoặc component nghiệp vụ có nhu cầu cụ thể; không bọc lại mọi Button/Input hoặc tạo framework UI tổng quát.
- Một popup có một chủ quản lý positioning/focus/dismiss. ProductLookup trực tiếp dùng Floating UI; không ghép thêm Positioner/Combobox controller của Base UI cho chính popup đó.

## Ranh giới phải bảo toàn

- Dockview quản lý layout. Ứng dụng quản lý `documentSessionId`, raw buffers, draft, dirty, quyền giả lập, mutation và recovery.
- Di chuyển panel có thể phát sự kiện remove/add. Chỉ giải phóng phiên tài liệu qua quy trình đóng được ứng dụng chấp thuận.
- Dirty bao gồm text chưa hợp lệ/chưa commit. Save dùng barrier và snapshot mới nhất; Discard có thể bỏ buffer không hợp lệ; Cancel giữ nguyên. Pending/unknown mutation chưa được giải quyết thì không bỏ phiên.
- Mọi đường đóng panel, đóng nhóm/nhiều tab và reset/restore layout đều đi qua admission chung.
- ID dòng độc lập với Product ID; cùng sản phẩm có thể xuất hiện nhiều dòng. Không dùng index hoặc Product ID làm React/grid row identity.
- Giá trị số chính xác dùng decimal strings và phép tính thập phân; ngày chứng từ dùng `yyyy-MM-dd`; version là opaque. Không suy diễn protocol HTTP từ kiểu frontend.
- Chụp session/document identity và generation trước async; kết quả muộn không áp vào phiên hoặc actor mới. Hủy request ở client không chứng minh mutation đã rollback.
- Save/Post không tự retry. Fake capability không phải cơ chế bảo mật production. Fake recovery không tạo ra cam kết idempotency của backend.

## Cách triển khai

Làm từng task có phụ thuộc rõ trong roadmap; giữ commit vừa phạm vi. Các đường dẫn `src/` và `tests/` trong tài liệu là cấu trúc đích, chưa phải file có sẵn. WEB-01 xác minh và pin bộ phiên bản tương thích, ghi package manager/runtime/lockfile; không dùng API chỉ đọc được từ `main` mới hơn bản đã cài.

Ưu tiên kiểm tra boundary thay đổi. Không tạo test chỉ để đếm file/config hoặc khóa nguyên chuỗi Tailwind. Khi sửa lỗi hành vi, tái hiện lỗi rồi thêm kiểm tra tập trung. Không chạy SQL/.NET/WinForms test cho task frontend giả lập.

Đọc [nguồn khảo sát](docs/references/TECHNICAL_BASELINE.md) trước khi khẳng định API bên thứ ba. Kiểm tra mã/type của phiên bản cài thực tế ở WEB-01; mốc source khảo sát không phải dependency lock.

## Báo cáo

Ghi task, commit, browser/runtime, kịch bản, lệnh, số test thực chạy, kết quả và giới hạn vào [evidence](docs/evidence/20261031-web-foundation.md). Tách kiểm tra tài liệu, automated browser và thao tác IME có người dùng. Build xanh không thay browser acceptance; fake API không thay integration thật.

Không tạo vòng xin duyệt lặp lại cho lựa chọn triển khai đã được tài liệu quyết định. Với thay đổi vượt phạm vi như backend/runtime thật, Enterprise, giao diện tùy biến hoặc popout, trình bày thay đổi cụ thể trước khi mở rộng. Tuân thủ chỉ dẫn mới nhất của Owner nếu có xung đột.

## Files

UTF-8 không BOM, LF; giữ dấu tiếng Việt. Tránh nhân bản spec: thêm quy tắc vào tài liệu sở hữu, rồi liên kết từ roadmap/handoff. Không tạo bản tài liệu trong repo desktop hoặc repo docs cũ.

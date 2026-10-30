# Evidence — Web Workspace and Editing Foundation

**Ngày:** 2026-10-31. **Candidate hiện tại:** bộ tài liệu khởi tạo repo. **Runtime:** chưa có ứng dụng hoặc dependency lock.

## 1. Kết quả của lần tạo tài liệu

- Khảo sát repo ban đầu: rỗng, default branch main.
- Owner choices và các chi tiết triển khai đã được ghi ở Foundation; active index chọn WEB-01–WEB-08, tất cả PLANNED.
- Nguồn chính thức và mốc đọc: [Technical Baseline](../references/TECHNICAL_BASELINE.md).
- Kiểm tra tài liệu: **PASS** cho 12 file Markdown, UTF-8 không BOM, LF/final newline, code fences và whitespace.
- Link nội bộ: **78/78** đích tồn tại; 5 reference definitions hợp lệ. Các nguồn bên ngoài được ghi tại Technical Baseline; không coi kiểm tra local link là kiểm chứng lại mọi trang web.
- Inventory: **34 scenario IDs** (WKS 12, LKP 6, EDT 4, SAL 12); **8 task** có trạng thái PLANNED nhất quán. Các declaration và consumer được rà soát ở mức thiết kế, chưa phải TypeScript build.
- Review độc lập đã đọc toàn bộ 12 file. Đã sửa ba vấn đề: nguồn nhãn reference khi mở lại, bằng chứng để giải quyết unknown mutation, và dependency WEB-03 của WEB-05. Lượt review lại không còn blocker tài liệu; mapping line identity và baseline version cũng đã được làm rõ.
- `git diff --cached --check`: **PASS** trên toàn bộ bộ tài liệu đã stage.
- Build/typecheck/unit/browser/attended/SQL: **NOT RUN / NOT APPLICABLE cho commit chỉ tài liệu**.

Không có screenshot hoặc runtime PASS được suy từ source docs. Không có xác nhận API thật, security, COGS hay release.

## 2. Task evidence

| Task | Source commit | Automated | Attended | Trạng thái |
|---|---|---|---|---|
| WEB-01 | — | NOT RUN | NOT RUN | PLANNED |
| WEB-02 | — | NOT RUN | NOT RUN | PLANNED |
| WEB-03 | — | NOT RUN | NOT RUN | PLANNED |
| WEB-04 | — | NOT RUN | NOT RUN | PLANNED |
| WEB-05 | — | NOT RUN | NOT RUN | PLANNED |
| WEB-06 | — | NOT RUN | NOT RUN | PLANNED |
| WEB-07 | — | NOT RUN | NOT RUN | PLANNED |
| WEB-08 | — | NOT RUN | NOT RUN | PLANNED |

## 3. Mẫu ghi cho lần triển khai

Mỗi record gồm: task/scenario ID; source commit và dependency versions; Node/OS/browser; viewport/zoom/theme; fixture/scenario; hành động; expected/observed; command + test count + result; ảnh/trace/log khi cần; failures/skips/limitations; người kiểm tra attended và ngày nếu có.

Các ma trận chi tiết ở [Workspace](../design/WORKSPACE_BEHAVIOR.md), [Lookup/Editing](../design/LOOKUP_AND_GRID_EDITING.md), [Sales](../design/SALES_PILOT.md). Gắn test/record thật vào từng ID khi chạy, không tự đổi bảng sang PASS hàng loạt.

## 4. Ranh giới acceptance

Automated Chromium không chứng minh IME/Telex/VNI thực trên Windows. Lab fake không chứng minh SQL/backend. Layout restoration không khôi phục draft chưa lưu. Hoàn thành docs không đồng nghĩa WEB-01 đã bắt đầu.

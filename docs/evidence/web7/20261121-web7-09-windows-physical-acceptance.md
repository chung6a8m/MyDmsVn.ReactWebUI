# WEB7-09-WIN — Nghiệm thu UI vật lý trên Windows

**Candidate** `786e85cf0e534de4c778c10767b2f9f51916b59d` · **Ngày** 2026-11-21 (UTC+07:00) · **Kết luận** PARTIALLY ACCEPTED.

[PR #54](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/54) đã merge lúc 16:16:56 (UTC+07:00). Local `main` sạch được fast-forward từ `c06b1e9`, đồng nhất với `origin/main` tại thời điểm chọn candidate. [CI sau merge #44888833158](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44888833158) SUCCESS trên đúng SHA. Windows được kiểm chứng riêng. [Ma trận](../../development/WEB7_ACCEPTANCE_MATRIX.md) · [handoff](../../development/WEB7_UI_ACCEPTANCE_HANDOFF.md) · [evidence lịch sử PR #54](20261121-web7-09-integrated-ui-acceptance.md).

## Environment manifest

| Hạng mục | Giá trị quan sát |
|---|---|
| Timestamp và runner | 2026-11-21 16:32 (UTC+07:00), PowerShell trên laptop Windows của Owner |
| Windows | Windows 11 Home Single Language 26H2 x64, build 26300.9974 |
| CPU / RAM | Intel Core i7-12700H, 14 cores / 20 logical processors, 16.87 GB (15.71 GiB) |
| Monitor / OS Display Scale | Một monitor đang sử dụng, primary 1920×1080; GetDpiForMonitor 96×96 DPI, GetScaleFactorForMonitor 100%. Giữ scale của máy trong toàn bộ lượt chạy. |
| Node / npm / Git | Node 22.14.0 và npm 11.6.0 chạy từ thư mục tạm theo process PATH; Git 2.55.0.windows.5. PATH mặc định của máy có Node 26.13.1/npm 12.2.3. |
| Lock / Playwright | Lockfile object `c25dec9cc1854479a6a84609924a64e21d1d376a`; Playwright 1.64.1. |
| Edge | Microsoft Edge 158.0.4370.33, `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`; Playwright launch log xác nhận đường dẫn và `channel: msedge`. |
| IME | UniKey 4.6 RC2 build 230919 (file 4.6.2.0) có process chạy. Windows input list trả `en-US` / `0409:00000409`. Chế độ UniKey và kết quả gõ lấy từ thao tác attended. |
| Narrator | Có `Narrator.exe` file version 10.0.26100.8972; xác nhận cài đặt qua file metadata. |

## Automated regression và production artifact

| Lệnh | Kết quả |
|---|---|
| `npm.cmd ci` | Exit 0, 419 packages từ lockfile. npm báo 4 moderate audit findings; không thay dependencies. Thử bootstrap Node trên npm hệ thống bị chặn preinstall; sau khi dùng binary Node 22.14.0 và launcher npm 11.6.0 cục bộ đã chạy lại lock install thành công. |
| `npm.cmd run typecheck` | PASS, exit 0. |
| `npm.cmd run build` | PASS, exit 0. Built marker `{"version":1,"candidateId":null}`. Vite báo cảnh báo kích thước chunk. |
| `npm.cmd run test:e2e -- --config playwright.edge.config.ts --workers=2 --forbid-only` | 318 PASS, 0 FAIL, 1 SKIP, 0 retry, exit 0; 319 được chọn, 14.9 phút. Project `msedge`, headless, viewport mặc định 1280×720; từng spec có thể đặt kích thước riêng. Playwright device descriptor cung cấp UA cố định; version cài thực lấy từ executable/browser. |
| `npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1 --forbid-only` | PASS 3/3, 0 fail/skip/retry, exit 0. Browser bundled Chromium 156.0.8078.4, viewport 1280×720 theo config. |

`workspace-zoom.spec.ts` nằm ngoài selector Edge; test zoom nội bộ của `web7-integrated-ui.spec.ts` dành cho bundled Chromium và được báo riêng theo trạng thái skip. Artifact build kiểm tra graph Lab/fake, routes, diagnostics và close admission. Fixture UNKNOWN xác nhận resend disabled, 0 đọc v3 và chỉ 1 business write được yêu cầu rõ ràng trong fixture. Các lượt kiểm tra chỉ dùng local Vite, fake Lab hoặc mock HTTP.

## Visual/layout và native Edge zoom

Lượt visual bổ sung dùng Edge `msedge` trên Windows, Product composition thật tại `127.0.0.1:5187` và HTTP fixture `tests/e2e/helpers/durableDraftWorkspaceHttp.ts`. PASS 8/8 tổ hợp `1440×900`, `1280×720`, `768×720`, `390×780` × Light/Dark cho shell Sales, cùng session `7f935119-41d5-4b20-be33-ec0080a7c246`, note `QA ghi chú`, date raw `2026-11-`, Calendar trong viewport/hit test, Escape trả focus về date input và không tràn ngang trang. 0 lỗi console/runtime, 0 request bất ngờ và 0 business writes. Lượt cross-module PASS 8/8 tổ hợp viewport/theme, mở Sales + Receipt riêng, Inventory balances/card, split hai Dockview groups, thu gọn/mở sidebar, drawer Escape trả focus, Đóng tất cả → Tiếp tục sửa, giữ cả hai raw note và ngày sai; 0 business writes/request bất ngờ/lỗi console. Shell hiển thị vùng tài khoản và nút Đăng xuất theo thiết kế hiện tại.

Native Edge zoom đọc từ menu 100% và trình báo zoom của Edge ở 125%/200%. Shortcut `Ctrl+=` đi qua cửa sổ browser đang hiển thị. Lượt typing giữ session Sales `247f522f-581a-40dc-9c23-07225dbe3f5d`; DPR chỉ là số đo đối chiếu. Focus trên Ghi chú và caret kiểm tra qua DOM, gõ tiếp qua phím browser runner. OS scale đo riêng ở 100% (96 DPI).

| Edge UI zoom | Viewport CSS lượt gõ / DPR | Raw trước → sau | Lượt popup/menu/grid |
|---|---|---|---|
| 100% | 1912×948 / 1 | `QA native zoom` → `QA native zoom!` | PASS tại 1912×948 |
| 125% | 1530×758 / 1.25 | `QA native zoom!` → `QA native zoom!!` | PASS tại 737×736 |
| 200% | 956×474 / 2 | `QA native zoom!!` → `QA native zoom!!!` | PASS tại 460×460 |

Lượt thứ hai kiểm tra Calendar/Escape về date input, lookup khách hàng và sản phẩm mở được và hit test thành công, menu Workspace/Escape về trigger và cuộn AG Grid sau khi tăng số dòng; bộ đếm dòng trong viewport trước khi cuộn. Cửa sổ lượt popup được khôi phục từ maximize khi thử ở 125% và 200%, nên viewport ghi riêng. Cả hai lượt có 0 business writes, 0 request ngoài fixture và 0 lỗi console/runtime. Focus/raw qua zoom được xác nhận bằng runner; input tiếng Việt vật lý ghi riêng bên dưới.

## Ma trận tích hợp

| ID | Trạng thái có bằng chứng | Giới hạn |
|---|---|---|
| W7-INT-01 | PASS cho phạm vi Edge visual/viewport, focus DOM, portal và native zoom đã chạy | Lượt Telex của Owner ghi nhận mất vị trí caret ở E01. VNI và Narrator chưa chạy. |
| W7-INT-02 | PASS cho fixture Edge: hai raw/session riêng, ID dòng, close/reset/restore, local drafts, quyền Read/Write/Post, actor/epoch fencing, async trễ và pending/UNKNOWN không tự replay | Fixture độc lập. Owner xác nhận E08 Telex PASS; E02 chưa đủ bằng chứng về composition. |
| W7-INT-03 | PASS 3/3 artifact mặc định | Preview cục bộ và fixture HTTP; candidate resend-enabled nằm ngoài lượt này. |
| W7-INT-04 | Evidence và handoff cho đúng SHA | Còn mục attended phải bổ sung khi có người thực hiện. |
| W7-INT-05 | PASS, đối chiếu phạm vi diff | WEB6 giữ ordinary resend OFF, staging NOT ACCEPTED và production NO-GO. |

## Attended Telex và VNI

**Lượt Telex ngày 2026-11-21 do Owner trực tiếp thực hiện và báo kết quả.** Owner cung cấp chuỗi quan sát ở E01–E02 và đánh giá PASS E03–E08. Báo cáo lượt này không kèm chuỗi phím, ID dòng hoặc số request riêng. VNI chưa chạy. Thao tác tại [UI Lab](../../development/WEB7_UI_ACCEPTANCE_HANDOFF.md#1-mở-product-và-ui-lab-đúng-runtime) hoặc trong Product được gắn mock HTTP.

| ID | Thao tác bàn phím cần xác nhận | Telex | VNI |
|---|---|---|---|
| E01 | Gõ `Kiểm tra tiếng Việt, giữ nguyên dữ liệu chứng từ` vào Ghi chú; chèn dấu giữa chuỗi, Tab rồi chuyển đi/quay lại tab chứng từ. | Nội dung giữ được, vị trí caret không giữ được sau khi chuyển tab và quay lại. Trước: `Kiểm tra tiếng Việt, giữ nguyên dữ liệu chứng từ`. Sau: `Kiểm tra tiếng Việt, thử giữ nguyên dữ liệu chứng từ`. | NOT RUN |
| E02 | Gõ dở một từ có dấu rồi Tab ngay, đổi tab hoặc mở dialog trong các lần riêng; quay lại và ghi raw hiển thị. | Chưa đủ bằng chứng về composition. Owner thấy `Viet` trước và `Viet` sau. | NOT RUN |
| E03 | Gõ truy vấn có dấu theo tên fixture hiện có trong lookup Sản phẩm; ArrowDown/Up, Enter/Tab; ghi lựa chọn, ID và focus. | PASS (Owner) | NOT RUN |
| E04 | F2 hoặc double-click ô grid, gõ từ tiếng Việt trong editor sản phẩm; thử Escape và Enter/Tab ở lượt riêng, chuyển dòng rồi mở lại; ghi dòng và giá trị. | PASS (Owner) | NOT RUN |
| E05 | Thử `2026-11-`, `2026-02-30`, `2024-02-29`; Enter/Escape/blur trong các lượt riêng, thử Calendar; ghi raw và số ghi. | PASS (Owner) | NOT RUN |
| E06 | Nhập `1,2345`, `1.2345` và `1.23456`; đặt caret giữa chuỗi, thử Escape và Save barrier trên fixture; kiểm giá trị trước/sau, không làm tròn. | PASS (Owner) | NOT RUN |
| E07 | Mở Sales + Receipt, gõ hai ghi chú khác nhau và đổi tab; kiểm tra cả hai session. | PASS (Owner) | NOT RUN |
| E08 | Giữ ngày dở/decimal invalid, thử Ctrl+Alt+W và Đóng tất cả rồi chọn Tiếp tục sửa; kiểm tra raw/session. | PASS (Owner) | NOT RUN |

## Attended Narrator

**NOT RUN.** Chưa có lượt nghe trực tiếp hoặc xác nhận announcements của Owner. Owner có thể dùng Win+Ctrl+Enter trên máy khi sẵn sàng. Dùng Tab/Shift+Tab, mũi tên, Enter/Escape để ghi nguyên văn hoặc tóm tắt sát lời đọc và thứ tự focus cho các nhóm sau.

1. Sidebar dạng icon, breadcrumb và active tab; kiểm tra tên, trạng thái active, thứ tự Tab và focus ring.
2. Labels/helper/errors, read-only/disabled, ValidationSummary về đúng field và dòng; kiểm tra thông báo khi đổi giá trị.
3. Calendar, lookup listbox/options và AG Grid editor; ghi ngày, lựa chọn, highlight và đường quay lại focus.
4. Workspace menu, dialog và drawer ở 390px; thử containment, Escape, focus return và trạng thái sau unmount.

## Findings, provenance và phần còn lại

- Kiểm thử bổ sung ban đầu dùng locator popup không khớp và đợi Calendar trả về nút mở. Contract và `date-field.spec.ts` quy định focus quay lại ô ngày. Runner tạm đã được hiệu chỉnh theo contract. Lượt kiểm AG Grid ban đầu dùng sai selector, sau đó xác nhận cuộn bằng `.ag-grid-viewport` như suite Workspace; không đổi test đã commit.
- Lượt Edge tự động và visual trước đó không ghi nhận lỗi Product. E01 Telex bổ sung quan sát về caret: nội dung còn nguyên, nhưng vị trí chèn bị mất khi quay lại tab chứng từ. Cần tái hiện để xác định hành vi focus/caret; chưa xác định nguyên nhân.
- Evidence hình kiểm tra layout dùng dữ liệu giả. [Sales Light 1440×900](20261121-web7-09-win/sales-light-1440x900.png) · [Calendar Dark 390×780](20261121-web7-09-win/calendar-dark-390x780.png). Nội dung browser chrome ở các mức zoom được đọc trực tiếp qua ảnh cửa sổ Edge và đối chiếu accessibility tree của browser trong phiên Codex. Playwright page screenshots tách khỏi quan sát browser chrome.
- Logs `install.log`, `typecheck.log`, `build.log`, `edge.log`, `production.log`, `visual-final.log` và `cross-module.log` lưu trong `%TEMP%/web7-09-win-786e85c` trên laptop. Test output mặc định nằm ở `test-results/edge` và `test-results/production`; trace được giữ nếu thất bại và không công bố nguyên bản. Ảnh đính kèm lấy từ `screenshots/1440x900-Light.png` và `screenshots/calendar-390x780-Dark.png` ở lượt visual.
- NOT RUN: VNI E01–E08, Narrator và các mức Windows Display Scale khác. SQL/IIS, deployment, cutover/workload và recovery operational ngoài phạm vi Windows frontend. Bộ kết quả hiện tại chỉ đủ để đề xuất nghiệm thu phần đã chứng minh khi không còn blocker thuộc phần đó.

Tiếp tục với E01–E08 bằng VNI và Narrator trên cùng candidate. Đối chiếu lại E01/E02 bằng cách ghi vị trí caret và chuỗi phím thực tế trước khi xét UI PHYSICAL ACCEPTED.

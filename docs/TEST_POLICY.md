# Chính sách kiểm tra — Web UI

**Ngày:** 2026-10-31. Chính sách của repo ReactWebUI; không nhập gate SQL/native WinForms từ MyDmsVn. Các scripts đã có từ WEB-01; kết quả và giới hạn thực chạy nằm trong [evidence](evidence/20261031-web-foundation.md).

## 1. Chọn kiểm tra theo thay đổi

| Thay đổi | Kiểm tra cần thiết |
|---|---|
| Tài liệu/handoff | Link nội bộ, path/ID/type nhất quán, encoding/LF, trạng thái và diff |
| Store/parser/command | Unit tests với input/sequence có nguy cơ; strict typecheck |
| Form/lookup/editor | Component tests phù hợp; Playwright qua boundary thật khi cần DOM/focus/layout |
| Dockview/AG Grid/portal | Browser tests qua component thật; không thay chúng bằng mock để kết luận integration |
| Theme/default UI | Browser kiểm tra đọc được, không che nút/focus, không mất draft; không snapshot từng class CSS |
| Real backend về sau | Policy/roadmap mới theo endpoint/runtime đã chọn; fake tests không thay integration |

Không tạo test chỉ xác nhận scaffold hay sao chép implementation. Khi behavior bug xuất hiện, tái hiện và thêm regression tập trung. Không chạy full suite ở mọi bước; chỉ mở rộng khi boundary thay đổi hoặc mốc cuối cần tổng hợp.

## 2. Toolchain và script contract

WEB-01 tạo package.json/lockfile, ghi Node/package versions và các scripts sau. Dùng npm; `npm ci` chỉ có nghĩa sau khi lockfile tồn tại.

| Lệnh dự kiến | Trách nhiệm |
|---|---|
| `npm ci` | Cài dependency từ lockfile |
| `npm run typecheck` | TypeScript strict, không emit |
| `npm run build` | Production build |
| `npm run test:unit -- <path>` | Vitest run, unit/component phù hợp môi trường |
| `npm run test:e2e -- <file> --project=chromium` | Playwright, dev server tự quản lý, dataset giả lập |
| `npm run dev` | Chạy app/Lab để kiểm tra attended |

Thiết lập Playwright Chromium là baseline tự động. Edge trên Windows và IME/Telex/VNI thực tế là kiểm tra attended riêng khi có môi trường; không nhận synthetic composition hoặc `fill()` làm chứng cứ đã test gõ tiếng Việt thực.

Regression Edge bổ sung dùng `npm.cmd run test:e2e -- --config playwright.edge.config.ts --workers=2` trên máy có Microsoft Edge cài sẵn. Config chọn channel `msedge`, output trong `test-results/edge`; không chạy `workspace-zoom.spec.ts` vì test đó tự launch bundled Chromium với extension. Tách rõ automated Edge với attended Edge/IME/Narrator, không tính native zoom Chromium thành bằng chứng zoom Edge.

## 3. Scenario ownership

| Scenario | Task sở hữu đầu tiên |
|---|---|
| WKS-01/02/03/04 | WEB-02 |
| WKS-05/06/07/08/09 | WEB-03 (kết nối mutation/recovery ở WEB-06) |
| WKS-10/11/12 | WEB-07 |
| LKP-01/02/03/04/05/06 | WEB-04 |
| EDT-01/02/03/04 | WEB-05 (EDT-03 tích hợp lại ở WEB-06) |
| SAL-01/04/05/06/07/08/09/10/12 | WEB-06 |
| SAL-02/03/11 | WEB-05, xác minh tích hợp ở WEB-06 |

Chi tiết assertion ở [Workspace](design/WORKSPACE_BEHAVIOR.md), [Lookup/Editing](design/LOOKUP_AND_GRID_EDITING.md), [Sales](design/SALES_PILOT.md). Không nhân bản ba ma trận này thành bộ gate khác.

## 4. Cách chạy có ý nghĩa

- Test async dùng deferred promises/scenario controls; chủ động cho response về đảo thứ tự, sau close hoặc sau đổi generation. Không kéo dài timeout để che race.
- Keyboard regression dùng từng phím, vị trí caret và composition khi liên quan; `fill()` chỉ dùng chuẩn bị dữ liệu không phải chứng minh behavior nhập.
- Chạy Dockview + AG Grid thật cho close/move/focus và Floating UI thật cho portal/positioning. Kiểm tra trạng thái ứng dụng và số command đã gửi, không chỉ screenshot.
- Hai group cùng visible, editor đang mở, modal chứa lookup, invalid raw buffer và commit-then-response-lost là các điều kiện bắt buộc của test boundary tương ứng.
- Kiểm tra ở viewport 1280×720 và 1440×900, Light/Dark; resize panel nhỏ trong giới hạn dùng được. Zoom 125%/200% ghi bằng thao tác browser phù hợp; viewport hẹp không tự được gọi là bằng chứng browser zoom hoặc OS DPI.
- Dòng 200, tên dài/tiếng Việt, ID lớn và decimal biên dùng dataset có chủ đích. Không load-test tùy ý hoặc đặt SLA chưa đo.
- Dọn event subscriptions, observers, pending query và fake scenario giữa các test. Parallel tests có dataset/context riêng; không dùng cùng localStorage scope.

## 5. Hoàn thành và bằng chứng

Một task DONE khi deliverable tồn tại, các kiểm tra của task thực chạy với số test > 0, regression liên quan PASS và [evidence](evidence/20261031-web-foundation.md) nêu đúng giới hạn. Nếu thiếu môi trường cho một gate bắt buộc, ghi BLOCKED/PENDING cụ thể thay vì biến thành PASS. Đừng thêm gate Owner cho từng lựa chọn kỹ thuật nhỏ đã được spec giao cho implementer.

WEB-08 tổng hợp browser suite đã có, typecheck/build, checks docs, dependency/license inventory và các quan sát attended. Đánh giá manual IME có thể giữ PENDING riêng; khi đó không báo toàn bộ input acceptance đã hoàn tất. Người dùng quyết định rollout thật ở phạm vi sau; không có deployment trong roadmap này.

## 6. Không nhầm phạm vi

Build PASS không chứng minh keyboard/focus. Unit tests PASS không chứng minh Dockview move hoặc portal trong modal. Fake Save/Post PASS không chứng minh quyền, concurrency, ledger hoặc SQL thật. Source documentation đúng không chứng minh phiên bản npm đã cài hỗ trợ API đó; WEB-01 ghi compatibility inventory.

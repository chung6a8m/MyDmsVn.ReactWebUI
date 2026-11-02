# Chính sách kiểm tra — Web UI

## WEB5 supplement — Owner selected 2026-11-02 (F01–F05 PLANNED/NOT RUN)

[WEB5 owning plan](plans/20261102-001-web5-operational-safety-web.md) and [WEB5 acceptance matrix](development/WEB5_WEB_ACCEPTANCE.md) add new scoped gates under this unchanged policy. F01 consumes backend **real OS process-crash/Commit** evidence (controlled HTTP/React cannot prove it); F02 only consumes a pinned versioned negative disposition after a durable SQL tombstone, never from status404/timeout, and same-key resend remains disabled without independent Owner gate; F03 keeps native Chromium/Edge IndexedDB and secret-free CI separated from actual SQL tests; F04 requires full IIS staging and separate attended Telex/VNI/Narrator, not IIS Express or synthetic composition; F05 needs explicit Owner production decision. Documentation-only selection requires links/status/encoding/diff checks, no runtime/SQL/browser/IIS PASS.

## WEB4-specific supplement (WEB4-04 bounded acceptance; WEB4-05 accepted; WEB4-06 accepted/archived 2026-11-02)

The archived [WEB4 owning plan](plans/20261101-002-web4-reliability-web.md) adds a separate reliability acceptance boundary without replacing this test policy. IndexedDB must be tested in actual Chromium/Edge browser contexts plus injected SQL-free unit adapters; a jsdom mock alone cannot claim reload/crash durability. Recovery fake HTTP test does not establish server journal atomicity; actual SQL/HTTPS belongs to the backend-owned fresh nonproduction fixture and independent oracle. A lost response must never trigger an automatic mutation retry. Keep browser test cases separate from .NET wrapper rows, and do not claim full IIS or attended Telex/VNI/Narrator from automated results. [F02 evidence](evidence/web4/20261102-f02-durable-drafts.md) and [F03 acceptance evidence](evidence/web4/20261102-f03-operation-recovery.md) record executed checks and WEB4-04 closeout; WEB4-05/F04 and the B05 test fixture are DONE (bounded). [F04 evidence](evidence/web4/20261102-f04-failure-pilot.md) owns current results; paired Chromium/Edge HTTPS/SQL verification, independent oracle and cleanup passed on separate fresh databases; Owner accepted; PR #21 and backend PR #84 merged 2026-11-02. Execute selector `web4-recovery` only through the backend-owned fixture under the [WEB4 pilot runbook](development/WEB4_PILOT_RUNBOOK.md). WEB4-06/F05+B06 is accepted and archived; no implementation task is selected. Apply the documentation row below; do not rerun or claim runtime acceptance from docs-only changes.


**Ngày:** 2026-10-31. Chính sách của repo ReactWebUI; không nhập gate SQL/native WinForms từ MyDmsVn. Các scripts đã có từ WEB-01; kết quả và giới hạn thực chạy nằm trong [evidence](evidence/20261031-web-foundation.md).

**WEB4 review supplement (2026-11-01):** F02/F03 must exercise real-browser IndexedDB (including failure, changed DB epoch and actor isolation) and command-specific recovered outcome versions. User-confirmed **same-ID** resend after persisted-before-dispatch unknown must be tested before that UI is enabled and only after the backend safety gates are proven. WEB4-04 closes with this UI disabled and UNKNOWN locked; backend/test-only replay does not certify the deferred product resend/crash gate. A simulated 404 is not proof of SQL rollback. Record backend B05-A/Frontend F04-A preparation separately from paired B05-B/F04-B final verification. No automatic POST retry and no invented Write-without-Read detail.
Round-2 acceptance: old actor-only Workspace layout v1/v2 containing server IDs MUST NOT auto-import after introducing DB epoch; v3 layout restore/actor scope require epoch and no stale async application. F03 must recompute B01 canonical fingerprint from frozen payload, compare to stored hash and protected server-owned status operation identity/epoch before SETTLED; wrong/missing epoch or fingerprint headers fail closed, same-origin same-userId different DB cannot accept old tab writes/status. These are new task gates, not current test results.


## 1. Chọn kiểm tra theo thay đổi

| Thay đổi | Kiểm tra cần thiết |
|---|---|
| Tài liệu/handoff | Link nội bộ, path/ID/type nhất quán, encoding/LF, trạng thái và diff |
| Store/parser/command | Unit tests với input/sequence có nguy cơ; strict typecheck |
| Form/lookup/editor | Component tests phù hợp; Playwright qua boundary thật khi cần DOM/focus/layout |
| Dockview/AG Grid/portal | Browser tests qua component thật; không thay chúng bằng mock để kết luận integration |
| Theme/default UI | Browser kiểm tra đọc được, không che nút/focus, không mất draft; không snapshot từng class CSS |
| HTTP/SQL pilot WEB4-05 | [WEB4 pilot runbook](development/WEB4_PILOT_RUNBOOK.md), fresh separate Chromium/Edge databases, exact published assets, independent backend physical oracle and cleanup; injected failures remain distinct from real SQL evidence |
| HTTP/SQL pilot WEB2-10 | [Pilot runbook](development/WEB2_PILOT_RUNBOOK.md), backend-owned disposable SQL/IIS Express fixture và Playwright production build; fake tests không thay integration, IIS Express không thay full IIS |

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
| `npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1` | Sau build: kiểm tra artifact `/` và Lab routes bị loại, không có fake workspace |

Thiết lập Playwright Chromium là baseline tự động. Edge trên Windows và IME/Telex/VNI thực tế là kiểm tra attended riêng khi có môi trường; không nhận synthetic composition hoặc `fill()` làm chứng cứ đã test gõ tiếng Việt thực.

Regression Edge bổ sung dùng `npm.cmd run test:e2e -- --config playwright.edge.config.ts --workers=2` trên máy có Microsoft Edge cài sẵn. Config chọn channel `msedge`, output trong `test-results/edge`; không chạy `workspace-zoom.spec.ts` vì test đó tự launch bundled Chromium với extension. Tách rõ automated Edge với attended Edge/IME/Narrator, không tính native zoom Chromium thành bằng chứng zoom Edge.

Pilot thật dùng `playwright.pilot.config.ts` qua fixture backend theo [runbook](development/WEB2_PILOT_RUNBOOK.md); config không tự khởi động dev server, không giả HTTP success, không bỏ qua TLS. Không chạy trực tiếp trên database/application đang dùng. Tắt trace/video/HAR để tránh lưu credentials/tokens; ghi riêng số browser tests và số .NET rows, cùng SQL oracle/cleanup. Chỉ host fixture sở hữu mới tạo/xóa tài nguyên của lượt chạy.

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
- Khi chạy suite qua Vite dev server, giữ toàn bộ repo ổn định, kể cả tài liệu/normalization: Tailwind theo dõi Markdown và có thể gửi full-reload giữa thao tác browser. Không ghi evidence trong repo khi suite đang chạy; viết sau khi server/test đã kết thúc.

## 5. Hoàn thành và bằng chứng

Một task DONE khi deliverable tồn tại, các kiểm tra của task thực chạy với số test > 0, regression liên quan PASS và [evidence](evidence/20261031-web-foundation.md) nêu đúng giới hạn. Nếu thiếu môi trường cho một gate bắt buộc, ghi BLOCKED/PENDING cụ thể thay vì biến thành PASS. Đừng thêm gate Owner cho từng lựa chọn kỹ thuật nhỏ đã được spec giao cho implementer.

WEB-08 tổng hợp browser suite đã có, typecheck/build, checks docs, dependency/license inventory và các quan sát attended. Đánh giá manual IME có thể giữ PENDING riêng; khi đó không báo toàn bộ input acceptance đã hoàn tất. Người dùng quyết định rollout thật ở phạm vi sau; không có deployment trong roadmap này.

## 6. Không nhầm phạm vi

Build PASS không chứng minh keyboard/focus. Unit tests PASS không chứng minh Dockview move hoặc portal trong modal. Fake Save/Post PASS không chứng minh quyền, concurrency, ledger hoặc SQL thật. Source documentation đúng không chứng minh phiên bản npm đã cài hỗ trợ API đó; WEB-01 ghi compatibility inventory.

# Evidence — Web Workspace and Editing Foundation

**Ngày:** 2026-10-31. **Candidate hiện tại:** WEB-02 trên `codex/web-02-sessions`. **Runtime:** shell/Lab, fake catalog, document sessions và Dockview edit harness; chưa có Sales Save/Post hoặc API thật.

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
| WEB-01 | Commit `chore: establish default React web UI foundation` chứa record này | typecheck/build PASS; unit 3/3; Chromium 3/3 | PENDING (Edge/IME) | DONE |
| WEB-02 | Commit `feat: add document sessions and docked workspace` chứa record này; base `d68ca2a` | typecheck/build PASS; unit workspace 6/6; browser workspace 4/4; regression WEB-01 PASS | PENDING (Edge/IME) | DONE |
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

Automated Chromium không chứng minh IME/Telex/VNI thực trên Windows. Lab fake không chứng minh SQL/backend. Layout restoration không khôi phục draft chưa lưu. Record tài liệu ở mục 1 là lịch sử, không phải browser acceptance.

## 5. WEB-01 — runtime evidence

- Task: toolchain, shared shell/Lab, canonical contracts và fake catalog. Base `06a2cc6`; commit triển khai được định danh bằng subject trong bảng trên (record nằm trong chính commit đó).
- Environment: Windows, Node 22.14.0, npm 11.6.0; Chromium **156.0.8078.4**, Playwright **1.64.1**. Exact dependencies/generator/API inventory: [Technical Baseline](../references/TECHNICAL_BASELINE.md#4-inventory-web-01--đã-cài-và-kiểm-chứng).
- Browser plugin không có trong session (`Browser plugin not available`); dùng Playwright theo test policy. URL `http://127.0.0.1:5173`; 1280×720 và 1440×900 CSS pixels, mặc định zoom 100%, Light/Dark. Không đo OS DPI hoặc browser zoom 125%/200%.
- `default_libraries_render_and_switch_theme` chạy **2 cases**, mỗi case vào `/`, `/lab/sales`, `/lab/components`, xác nhận title/heading, grid visible với chiều cao >200/chiều rộng >300, nội dung tiếng Việt; click Dark rồi Light, `aria-pressed` và grid mode đúng, node panel vẫn connected, dữ liệu còn, không horizontal overflow/framework overlay. Console warning/error và page errors: **0**.
- `unknown_scenario_falls_back_to_default` chạy **1 case**: scenario không allowlist → default có fixture; `empty-catalog` → empty grid. Không dispatch tên scenario tùy ý từ URL.
- Unit fake catalog **3 cases**: lọc kind/Unicode/active rồi limit; empty scenario và invalid limit; abort ngay sau gọi trước async resolve. Unit RED 3/3 trước implementation → GREEN 3/3. Smoke RED 3/3 vì thiếu shell/scenario → GREEN 3/3.
- Ảnh Light/Dark đã chụp và đọc trực tiếp ở 1280×720: header/nav/buttons, tab và grid không bị che; palette Nova/Quartz/Dockview đổi theo mode. Ảnh lưu ngoài repo trong Codex visualizations (`web-01-light.png`, `web-01-dark.png`); không dùng screenshot làm assertion pixel cứng.

| Lệnh | Kết quả thực chạy |
|---|---|
| `npm ci` | PASS, cài lại 419 packages từ lockfile; sau đó chạy lại toàn bộ checks WEB-01 |
| `npm run typecheck` | PASS, strict TypeScript, không emit |
| `npm run build` | PASS; có warning chunk >500 kB (JS khoảng 1.93 MB / gzip 534 kB) |
| `npm run test:unit` | PASS 3/3, 0 skipped |
| `npm.cmd run test:e2e -- tests/e2e/foundation.spec.ts --project=chromium` | PASS 3/3, 0 skipped, 0 retries |
| `npm ls --depth=0` | Dependencies resolve, không invalid peer |
| `npm ls ag-grid-enterprise` | Empty; không cài Enterprise |
| `npm audit --omit=dev` | 0 vulnerabilities |

Khác biệt môi trường: `npm.ps1` trên máy này nuốt flags sau `--`; dùng `npm.cmd` để giữ nguyên Playwright/Vite arguments. Lần browser đầu chạy khi tải Chromium chưa xong lỗi executable missing; sau cài browser đã chạy RED hành vi rồi GREEN như trên. Host emit warning NO_COLOR/FORCE_COLOR; đây không phải console ứng dụng. `npm audit` đầy đủ báo 3 low trong chuỗi shadcn → registry/deepmerge; chỉ tooling, không ép downgrade generator hoặc sửa lock bằng `audit fix --force`.

Giới hạn: panel catalog chỉ đọc, chưa có sales line/document sessions, mutation, close admission, lookup popup, layout persistence hoặc fake SalesPort implementation. Không gán WKS/LKP/EDT/SAL acceptance cho smoke này. DnD/floating/context menu/close của foundation panel chưa expose. Chưa chạy Edge attended, Telex/VNI hay integration backend. Task tiếp theo WEB-02.

Review độc lập (read-only) đã đối chiếu contracts/spec, installed Dockview/Quartz source, theme lifecycle, query actor/generation, cancellation và dependency inventory: **không có actionable finding trong WEB-01**. Reviewer không chạy lại browser; lượt typecheck của reviewer trùng thời điểm npm ci thay node_modules nên lỗi missing libs. Lượt validation của implementer sau khi npm ci kết thúc mới là kết quả trong bảng trên. Các behavior document/session/close/editing/recovery/layout/HTTP được giữ ở task sở hữu tiếp theo; không nâng acceptance từ review source.

Kiểm tra tài liệu/file: 43 files UTF-8 không BOM, LF và final newline; 85 internal link targets tồn tại (không chứng nhận mọi external URL hoặc heading anchor); `git diff --check` PASS. Giữ nguyên cấu hình ignore/editor có sẵn, chỉ thêm scratch ignore. Chỉ commit local trên nhánh `codex/web-01-foundation`; không deployment hoặc thay đổi backend.

## 6. WEB-02 — document sessions và Dockview

**Environment:** Windows, Node 22.14.0/npm 11.6.0; Chromium 156.0.8078.4 / Playwright 1.64.1; dependency versions giữ nguyên lock WEB-01. Browser plugin không có (`Browser plugin not available`), dùng Playwright tại `http://127.0.0.1:5173`. Workspace tests chạy 1440×900, move test đổi về 1280×720; foundation regression chạy cả hai viewport, Light/Dark. Zoom mặc định 100%; không tuyên bố DPI/zoom hoặc IME attended.

**Thay đổi:** Zustand store giữ draft/baseline/raw buffers, revision, identity/generation, read state và grid view state. Registry record→session→panel deduplicate cả read đang pending, `openSalesDocument(null)` luôn tạo phiên mới. Session-local line IDs độc lập Product ID; fixture có 40 dòng cùng sản phẩm để exercise virtualization/scroll. `WorkspaceProvider` nằm trên route; hide, move, host detach/remount không finalise. Command router capture identity trước thực thi; harness có nút Đánh dấu phiên và Ctrl+Alt+M. Chỉ có fake Get cho 1001/1002 qua signature `SalesPort['get']`; không giả vờ có full SalesPort.

| Scenario / kiểm tra | Hành động và kết quả |
|---|---|
| WKS-01 / `reopen_record_activates_existing_session` | Gõ note, mở record khác, mở lại: một tab/session, raw note và dirty còn; chuyển Components Lab rồi mở lại vẫn cùng session. Unit xác nhận một lần read và hai chứng từ mới có ID khác. |
| WKS-02 / `two_groups_route_to_focused_document` | Hai group visible; focus note A rồi click toolbar chỉ tăng counter A; focus B + Ctrl+Alt+M chỉ tăng B. Unit đổi active sau capture vẫn tác động A, token của phiên đã finalise bị từ chối. |
| WKS-03 / `move_panel_does_not_close_session` | Raw qty `-`, hide/show, split, kéo tab bằng chuột sang center group khác; assert group DOM thực sự đổi. Session/line ID, raw, session generation=1 và request generation=1 giữ nguyên; đổi Dark và viewport vẫn giữ raw. |
| WKS-03 / `column_and_scroll_state_survive_hide_resize_and_route_remount` | Resize cột bằng chuột, kéo đổi thứ tự cột, wheel cuộn 600px; hide/show, split, kéo sash resize panel, chuyển route/remount: width/order/scroll giữ nguyên. Không fit-to-size theo resize hoặc persist state từ view hidden/zero-size. |
| WKS-04 / unit + browser move | Remove/add chỉ là layout event, không đổi generation/raw/draft; explicit finalise chạy một lần, lần thứ hai false; deferred response sau finalise không phục sinh phiên. Browser middle-click vẫn giữ panel vì close chưa expose. Cleanup host chỉ dispose subscriptions, không xóa session. |
| Dirty/raw | Unit sửa note rồi hoàn nguyên về baseline trở lại clean; composition vẫn dirty dù raw trùng baseline. Harness không normalize raw qty hoặc ghi nhầm raw invalid vào Decimal4. |

**Lệnh cuối và số test:**

- `npm run typecheck`: PASS.
- `npm run test:unit`: PASS **9/9** (workspace **6**, catalog regression **3**), 0 skipped.
- `npm.cmd run test:e2e -- tests/e2e/workspace.spec.ts tests/e2e/foundation.spec.ts --project=chromium`: PASS **7/7** (workspace **4**, foundation **3**), 0 skipped/retries. Console warning/error và pageerror của workspace: **0**.
- `npm run build`: PASS; warning chunk >500 kB vẫn còn (JS khoảng 1.94 MB, gzip 540 kB), không che bằng đổi warning threshold.
- Ảnh ngoài repo `web-02-split-light.png`, `web-02-split-dark.png` trong Codex visualizations: hai panel cùng thấy được, note/raw khác nhau và counter đúng phiên; ảnh Dark đã được đọc trực tiếp. Không dùng ảnh thay assertion runtime.

**Lỗi đã phát hiện và sửa:** smoke ban đầu RED vì chưa có nút mở/harness. Unit đầu báo thiếu module trước implementation, không tính đó là behavioral test PASS. Browser tiếp tục RED do cleanup host ở StrictMode tháo registry trong khi Dockview giữ instance; chuyển attach/detach vào effect theo host API → GREEN. Test dirty RED → GREEN sau khi so raw/composition với baseline. Scroll-remount RED (600→0): installed AG Grid cache scroll ở `bodyScrollEnd`; capture `bodyScroll` ngay và giữ scroll mới khi state event khác vẫn chứa cache cũ → GREEN. Test kéo ban đầu chỉ `dragTo(tab)` không đổi group; chuyển chuỗi mouse drag vào vùng center và assertion group đích, không coi thao tác không đổi layout là acceptance.

**Review:** reviewer độc lập read-only không có actionable finding trong WEB-02; đã đọc registry, store, focus router, fake read, installed API và tests. Reviewer không chạy lại test; kết quả ở trên do implementer chạy. Không có thay đổi dependency hoặc backend.

**Tài liệu/file:** 53 files UTF-8 không BOM, LF/final newline; 86 internal link targets tồn tại; `git diff --check` PASS. Roadmap/handoff chuyển WEB-02 sang DONE; nguồn rules nằm trong spec sở hữu, không nhân bản sang repo khác.

**Giới hạn/handoff:** WKS-01–04 chỉ được chứng minh với edit harness hiện tại; WEB-05/07 phải chạy lại với editor/barrier đầy đủ. Chưa có Save/Post, decimal validator, lookup, close admission, durable drafts hay layout persistence. `finaliseSession` là hook cho controller sau admission ở WEB-03, không được gọi từ Dockview remove/add. X/middle-click/menu/group close/reset/floating/popout chưa expose. Không có polling/background computation trong document harness; subscriptions/observers của view được thư viện cleanup, reads không refetch khi hide/show. Grid state dùng public AG Grid State API; full editing focus/caret/IME acceptance còn ở WEB-04/05/07. Edge/Telex/VNI attended: PENDING. Task kế tiếp WEB-03; WEB-04 đủ dependency nhưng chưa triển khai.

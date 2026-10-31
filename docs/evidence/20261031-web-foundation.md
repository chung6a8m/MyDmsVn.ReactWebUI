# Evidence — Web Workspace and Editing Foundation

**Ngày:** 2026-10-31. **Candidate hiện tại:** WEB-06 trên `codex/web-06-sales-pilot`, base `7a082a8`. **Runtime:** app/Sales Lab dùng chung list/keyset và document editor, fake Create/Save/Post, capabilities/conflict, public-read recovery và close admission. Không có HTTP/backend thật. Các record bên dưới giữ kết quả lịch sử của từng candidate.

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
| WEB-03 | Commit `feat: guard document close and route workspace commands` chứa record này; base `b3e3fd0` | typecheck/build PASS; 24 unit, 11 Chromium tests PASS | PENDING (Edge/IME) | DONE |
| WEB-04 | Commit `feat: add Floating UI product lookup and grid adapter` chứa record này; base `237d4d1` | typecheck/build PASS; 35 unit/component, 18 Chromium tests PASS | PENDING (Edge/IME/screen reader) | DONE |
| WEB-05 | Commit `feat: add precise sales editing and save barrier` chứa record này; base `bd1a06d` | typecheck/build PASS; 57 unit/component, 23 Chromium tests PASS | PENDING (Edge/IME) | DONE |
| WEB-06 | Commit `feat: complete async Sales pilot and recovery scenarios` chứa record này; base `7a082a8` | typecheck/build PASS; 91 unit/component; 54 Chromium tests PASS | PENDING (Edge/IME/screen reader) | DONE |
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

## 7. WEB-03 — close admission và command routing

**Task/commit:** `feat: guard document close and route workspace commands` chứa record này, base `b3e3fd0`, nhánh `codex/web-03-close-admission`. Windows, Node 22.14.0/npm 11.6.0, Chromium 156.0.8078.4 / Playwright 1.64.1; dependencies giữ nguyên. Browser plugin không có trong session, dùng Playwright tại `http://127.0.0.1:5173` theo test policy. Workspace 1440×900, move test thêm 1280×720; foundation regression cả hai kích thước/Light/Dark, zoom mặc định 100%.

**Behavior:** một close intent/session, identity và revision chụp trước await; Save/Discard/Cancel, close-all tuần tự dừng tại cancelled/blocked. Finalise chỉ sau admission; remove/add do move không giải phóng phiên. Save stub có success/failure/deferred/unknown điều khiển rõ trong Sales Lab, không random delay/retry. Pending/unknown khóa chỉnh sửa và giữ snapshot; tài liệu khác vẫn dùng được. Save lỗi giữ raw, validation focus về ô tương ứng kể cả khi lệnh đến từ toolbar.

| ID / scenario | Kiểm chứng thực chạy |
|---|---|
| WKS-05 | Browser X, middle-click, toolbar Đóng tài liệu, Ctrl+Alt+W và Đóng tất cả qua controller. X của tab không active giữ đúng đích. Cancel qua nút hoặc Escape giữ raw. |
| WKS-06 | Raw qty `-`: Save stub trả blocked và focus ô lỗi, Discard đóng, Cancel giữ nguyên; mở lại lấy fixture gốc. Clean middle-click đóng không dialog. |
| WKS-07 (phần admission) | Deferred Save khóa A; mở/split/sửa B vẫn được. X khi pending, middle-click và close-all khi unknown không bỏ phiên/snapshot. Recovery/đối soát kết quả chưa triển khai, thuộc WEB-06. |
| WKS-08 (stub) | Unit Save lặp cùng promise/executor một lần; close lặp cùng intent, finalise một lần; thay active không retarget, revision mới không bị đóng. Unit dùng deferred harness thật kiểm tra close-all tham gia close-save đang pending rồi tiếp tục B sau thành công. Full port/actor recovery còn WEB-06. |
| WKS-09 | Browser close-all Discard A rồi Cancel B dừng đúng; unit còn phiên thứ ba chưa xử lý. Close-all khi unknown dừng mà không mở dialog Discard. |
| Regression WEB-01/02 | Catalog/scenario/theme, reopen record, focus routing hai group, move/hide raw, column order/width/scroll qua route remount vẫn PASS. |

**Inventory:** document X/middle-click → `DocumentTab` → admission; toolbar/shortcut/close-all → cùng controller. Catalog ẩn X và close override no-op. Tab context menu và group-chip menu trả `[]`, không expose group-close. Không expose reset/restore (WEB-07), floating bị tắt, không popout. Route detach giữ phiên; reload/browser exit không phải async document-close và vẫn mất draft theo nhãn harness. `finaliseSession` là hook nội bộ sau admission, không nối vào remove/add event.

**Lệnh cuối:**

- `npm run typecheck`: PASS.
- `npm run test:unit`: PASS **24/24**, 4 files, 0 skipped (close admission 11, sales commands 4, workspace regression 6, catalog 3).
- `npm.cmd run test:e2e -- tests/e2e/workspace.spec.ts tests/e2e/foundation.spec.ts --project=chromium`: PASS **11/11** (workspace 8 + foundation 3), 0 skipped/retries; workspace console warning/error và pageerror **0**.
- `npm run build`: PASS; warning chunk >500 kB còn hiện (JS khoảng 2.00 MB / gzip 560 kB), không đổi threshold để che warning.
- Ảnh dialog Light/Dark ở 1280×720 lưu ngoài repo trong Codex visualizations: `web-03-dialog-light.png`, `web-03-dialog-dark.png`; đã đọc ảnh Dark trực tiếp, title/mô tả/ba nút không bị cắt, dùng preset Nova. Ảnh không thay browser assertions.

**RED → GREEN / review:** close unit và sales command tests được chạy trước implementation. Browser kiểm tra focus từ toolbar ban đầu RED, thêm focus theo field/line ID qua grid public API rồi GREEN. Test unknown outcome với injected executor RED vì session chưa khóa, đã sửa. Reviewer read-only phát hiện busy check đặt trước existing close intent làm close-all dừng sớm khi save đang pending; regression dùng real deferred harness RED rồi GREEN sau khi ưu tiên intent hiện có. Không còn finding chưa xử lý trong review. Reviewer không chạy test.

Browser lượt đầu sau thêm Dialog gặp Vite `504 Outdated Optimize Dep`; chạy lại sau optimize ổn định, không lọc console error. Foundation empty-grid test bắt được hai text giống nhau (aria live-region và visible overlay); scope locator vào overlay hiển thị, không dùng `.first()` để che ambiguity. Host warning NO_COLOR/FORCE_COLOR không phải app console.

**Giới hạn:** Save chỉ nhận note của chứng từ mẫu đã đọc, lấy ký tự cuối từ raw store. Raw qty đã đổi, composition đang diễn ra và chứng từ mới đều blocked; chưa có decimal normalization/full barrier WEB-05. Stub trả document/version cho test close nhưng không persist vào fake dataset; không phải full SalesPort hoặc backend, chưa Post/recovery/idempotency. WKS-07/08 phải chạy lại với WEB-06. Edge attended, Telex/VNI, zoom/DPI và integration thật: PENDING. Task kế tiếp **WEB-04**.

**Tài liệu/file:** 62 text files UTF-8 không BOM, LF/final newline; 87 internal link targets tồn tại; `git diff --check` PASS. Commit local, không push/deploy hoặc thay đổi backend.

## 8. WEB-04 — Floating UI product lookup và grid adapter

**Task/commit:** `feat: add Floating UI product lookup and grid adapter` chứa record này; base `237d4d1`, nhánh `codex/web-04-product-lookup`. Windows, Node 22.14.0/npm 11.6.0; Chromium 156.0.8078.4 / Playwright 1.64.1. `Browser plugin not available`; dùng Playwright theo Test Policy. URL `http://127.0.0.1:5173`, viewport 1280×720 và 1440×900, zoom mặc định 100%. Không thay runtime/dependency/lockfile.

**Thay đổi:** ProductLookup controlled tách selected ID, display, raw query, confirmed và composition. Search giữ key session/generation/actor/line/catalogContext/query, abort request cũ và loại response muộn bằng generation. Không tự chọn kết quả đầu. Clear và restore là intent riêng; missing required/unconfirmed chặn Save stub. `lookupBuffers` + raw/revision thuộc Sales session, không thuộc grid/editor. Cancel cell phục hồi intent/raw đầu edit và tăng revision; unmount không xóa buffer. Field và inline grid adapter dùng cùng component. Harness mở từ chứng từ bằng nút **Kiểm tra lookup**, Components Lab chỉ dẫn đường vào; field/modal/2 dòng grid dùng clientLineId thật nhưng chưa ghi selection vào Sales draft.

**Host/focus:** một Floating UI controller; overlay host của panel hoặc bên trong modal. Khi thiếu host, hidden hoặc host zero-size không mount popup; không fallback body. autoUpdate/ResizeObserver cleanup theo unmount; popup size theo anchor/host/viewport. Non-modal lookup giữ DOM focus ở input, Base UI modal giữ trap. Không ghép Combobox controller hoặc Enterprise editor.

| ID | Evidence thực chạy |
|---|---|
| LKP-01 | Unit tách ID/query/display; gõ/xóa text không đổi ID, clear tường minh, restore và required validation. Session unit xác nhận query chưa chọn và clear required đều blocked khi gọi Save, rollback đầu edit sạch lại. Browser field chọn bằng Enter, query khác bị báo lỗi. |
| LKP-02 | 6 deferred unit sequences: response cũ về sau khi đổi query, catalogContext, session, generation, line hoặc actorGeneration không ghi đè. Abort signal cũ đã bật; fake vẫn resolve để chứng minh không chỉ dựa abort. Invalidate/unmount loại response muộn; thrown request thành error. Unit publication từ identity cũ không tăng revision. Browser empty/error giữ ID cũ. |
| LKP-03 | Component synthetic composition không phát search/chọn trong composition, end dùng text cuối. Browser synthetic composition + Enter/Escape không kết thúc editor; Unicode raw giữ nguyên. Đây không phải Telex/VNI attended. |
| LKP-04 | Browser ArrowDown/Enter chọn mà editor còn mở; Escape đầu đóng popup, lần hai cancel và phục hồi raw đầu edit; Tab không chọn và giữ raw khi mở lại editor. Home/End/ArrowLeft giữ caret; pointer chọn field/grid/modal, focus input còn đúng. Chromium CDP touch gesture cuộn list thực, không chọn nhầm. |
| LKP-05 | Popup nằm trong modal host, không có inert ancestor; Escape hai tầng, mouse chọn vẫn trong dialog; 5 lần Tab đi qua controls và quay lại trong modal. ARIA combobox/listbox/option, controls/active descendant được component cung cấp; chưa kiểm chứng screen reader attended. |
| LKP-06 | Browser wheel cuộn list không dismiss; viewport resize giữ width theo anchor; host width/height 0 tháo popup, phục hồi host mở lại; hide sang tài liệu khác không còn popup, raw còn; split hai group rồi mouse drag chuyển panel thật, assert group đổi và popup vẫn thuộc host. Theme Dark không mất raw. Unit invalidate và component thiếu host kiểm tra cleanup/không portal body. |
| Remount / regression | Browser chọn grid rồi Tab, đóng/mở harness: non-edit cell giữ đúng nhãn từ session; editor không là chủ state. WEB-01/02/03 regression đầy đủ PASS. |

**Lệnh cuối:**

- `npm run typecheck`: PASS.
- `npm run test:unit`: PASS **35/35**, 6 files, 0 skipped; gồm **9 lookup unit**, **2 lookup component** (jsdom), **24 regression**.
- `npm.cmd run test:e2e -- --project=chromium`: PASS **18/18**, 0 skipped/retries; lookup **7**, workspace **8**, foundation **3**. Lookup/workspace console warning/error và pageerror **0**.
- `npm run build`: PASS, vẫn có chunk warning >500 kB (JS khoảng 2.06 MB / gzip 580 kB), không đổi threshold.
- Ảnh modal popup Light/Dark chụp tại 1280×720, lưu ngoài repo `web-04-modal-light.png`, `web-04-modal-dark.png`; ảnh Dark đã đọc trực tiếp: label/input/options tiếng Việt đọc được, popup không bị modal clipping. Ảnh không thay assertions.

**RED → GREEN và review:** 8 lookup model/search tests RED trước implementation → GREEN. Browser đầu RED thiếu harness. Grid Enter ban đầu đóng editor do native grid listener; sửa suppressKeyboardEvent, Escape capture rollback. ResizeObserver feedback loop trong size update được sửa bằng frame-coalesced autoUpdate, hủy frame khi cleanup; không lọc lỗi console. Pointer modal ban đầu mất focus vì installed virtual navigation vẫn focus option trên click; trả focus input chỉ khi chọn. Review độc lập read-only tìm một P2: row data tạm reset nhãn sau remount; test tái hiện RED rồi GREEN khi cell đọc session lookupBuffers. Kiểm tra thêm clear required phát hiện Save stub nhận clear như không có edit; phân biệt clear intent với rollback về buffer chưa tồn tại, unit RED → GREEN. Không có finding chưa xử lý. Reviewer không chạy test.

Tab assertion ban đầu đọc đúng lúc focus ở Base UI sentinel ngoài DialogContent; diagnostic xác nhận frame kế tiếp input nhận focus. Dùng polling assertion cho trạng thái ổn định, không sửa trap hoặc dùng sleep đoán thời gian. Các lỗi locator ban đầu do role option của select và giả định số option được sửa bằng scope listbox/tên option. Host warning NO_COLOR/FORCE_COLOR không phải app console.

**Handoff/giới hạn:** lookup search hiện chạy ngay sau thay đổi query/composition end, chưa debounce; không phát request trong composition. catalogContext là khóa scope của fake harness (default/empty/error), không suy ra HTTP warehouse/price protocol. Confirmed lookup intent vẫn bị Save stub chặn có thông báo cho tới khi WEB-05 nối selection vào Sales draft/barrier; không tuyên bố đã Save/Post sản phẩm. Harness thêm dữ liệu nhiều option để scroll, không là catalog thật. Full decimal/200 dòng/save barrier: WEB-05. Edge, Windows Telex/VNI, screen reader attended và browser zoom/OS DPI: PENDING. Task kế tiếp **WEB-05**.

**Tài liệu/file:** 73 text files UTF-8 không BOM, LF/final newline; 88 internal link targets tồn tại; `git diff --check` PASS. Commit local, không push/deploy hoặc thay đổi backend.

## 9. WEB-05 — precise Sales editing và save barrier

**Task/commit:** `feat: add precise sales editing and save barrier` chứa record này; base `bd1a06d`, nhánh `codex/web-05-sales-editing`. Windows, Node 22.14.0/npm 11.6.0, Chromium 156.0.8078.4 / Playwright 1.64.1. `Browser plugin not available`; dùng Playwright tại `http://127.0.0.1:5173`. Không đổi dependency/lockfile, backend hoặc HTTP protocol.

**Thay đổi:** header ngày/khách hàng/kho/nhân viên/ghi chú; grid đúng bảy cột, sản phẩm lặp có clientLineId riêng, thêm dòng tối đa 200. Decimal input giữ raw/composition trong session và Escape phục hồi buffer đầu focus. Parse invariant bằng BigInt scale 10.000, nhận một dấu `,`/`.`, normalize zero dư, không làm tròn input sai; tính line/total overflow decimal(28,4), gift giữ giá. Ngày kiểm tra calendar trực tiếp, không UTC. `initialDraft` làm mốc dirty cho chứng từ mới chưa có baseline.

**Barrier:** khóa `preparing` trước chuẩn bị; cùng session dùng chung promise. Normalize raw/lookup và validate trước kết thúc editor, đợi acknowledgement, kiểm tra identity/revision rồi publish normalized draft và trả snapshot frozen. Editor đã unmount vẫn được parse từ session. Raw sai/composition chưa xong/query chưa chọn trả blocked và giữ nguyên text. Raw hợp lệ tiếp tục được giữ trong phiên trong pending/unknown; Save thành công mới clear buffers. `requestSave` và Save của close controller dùng cùng barrier, giữ khóa tới mutation và snapshot gửi. Known failure không xóa draft; không tự retry.

| Scenario | Kiểm chứng thực chạy |
|---|---|
| SAL-02 / EDT-04 | Browser kiểm tra thứ tự STT, Sản phẩm, Đơn vị tính, Số lượng, Đơn giá bán, Tặng, Thành tiền. Click bật/tắt Tặng giữ unitPrice; snapshot `1.0001 × 0.5000 = 0.5001`. Provided checkbox renderer click/Space công bố ngay, không expose editor cục bộ. |
| SAL-03 | 12 decimal unit cases: chuỗi chính xác, comma/dot, zero trailing, nonzero excess scale, zero/negative Qty, exponent/grouping/mixed separators, max Qty/Price và input/line/total overflow. 3 validation cases kiểm tra ngày thật/leap year, header/notes, line identity, product duplicate, 0/200/201 lines. |
| EDT-01 | Unit `save_immediately_after_last_keystroke_uses_new_revision`; browser gõ chữ số cuối bằng phím rồi click Kiểm tra snapshot, qty/price canonical đúng. Snapshot, mảng lines và mỗi line frozen; revision khớp. |
| EDT-02 | Unit unmounted valid buffer vẫn flush; invalid/composition giữ nguyên buffer. Browser sửa raw + chọn product, unmount grid bằng lookup harness rồi prepare: snapshot chứa qty/product mới, line IDs độc lập. Workspace regression giữ raw qua hide/move/route remount, column/scroll state không mất. |
| EDT-03 | Workspace regression X/middle/toolbar/hotkey/close-all vẫn dùng admission; invalid decimal Save blocked/focus lại qty, Discard được, Cancel giữ dữ liệu. Save failure/success/deferred/unknown chạy lại qua barrier với stub; full fake recovery còn WEB-06. |
| SAL-11 | Browser nạp 200 dòng cùng product nhưng 200 clientLineIds, nút Thêm dòng thứ 201 báo chặn; sửa dòng đầu rồi cuộn đến dòng 200 nhập sai, prepare blocked không mất dòng đầu; sửa dòng cuối hợp lệ trả snapshot đủ 200 dòng với giá trị cả đầu/cuối. Unit từ chối snapshot 201 dòng dù bypass UI. |
| Keyboard/composition | Browser Escape decimal phục hồi raw đầu focus; synthetic date composition + onChange vẫn blocked đến compositionend. F2 tại Tặng không mở editor giữ local state; Space toggle rồi prepare nhận gift mới. Lookup regression có composition, native caret, pointer, Tab/Escape/modal/touch/host cleanup. |
| Async/identity | Unit prepare đồng thời cùng promise; deferred editor acknowledgement giữ khóa, input mới bị từ chối; generation đổi khi chờ không publish. Session new canonical edit làm dirty và close hiện admission thay vì finalise. |

**Lệnh cuối:**

- `npm run typecheck`: PASS.
- `npm run test:unit`: PASS **57/57**, 9 files, 0 skipped. Mới: decimal **12**, validation **3**, barrier/session **7**; regression **35** (có 2 component tests).
- `npm.cmd run test:e2e -- --project=chromium`: PASS **23/23**, 0 skipped/retries. Sales editing **5**, lookup **7**, workspace **8**, foundation **3**; sales/lookup/workspace console warning/error và pageerror **0**.
- `npm run build`: PASS; chunk warning >500 kB còn hiện, JS khoảng 2.07 MB / gzip 584 kB.
- Viewport: sales editing 1440×900; workspace/lookup/foundation có 1280×720 và 1440×900, Light/Dark. Ảnh `web-05-sales-light.png`, `web-05-sales-dark.png`, `web-05-sales-small.png` ngoài repo; ảnh small Dark đã đọc sau khi theme transitions hoàn tất: headers/input/grid đọc được, toolbar không bị che. Zoom mặc định 100%; không tuyên bố OS DPI/zoom khác.

**RED → GREEN / review:** decimal 12 cases RED trước implementation; validation 3 RED; barrier latest revision/unmounted/serialize/late identity RED. Browser 200-line fixture bắt được stale renderer đọc line đã bị thay trước grid reconciliation; renderer hiện bỏ qua line đã biến mất, không đổi identity. Lookup harness bị thiếu chiều cao ở 720px sau thêm toolbar; ẩn header/note không dùng trong chế độ harness, regression tương tác grid xanh. Assertion lỗi raw cũ được cập nhật sang thông báo decimal validator.

Review độc lập read-only phát hiện ba lỗi, đều đã thêm regression RED → GREEN: (1) new canonical edits không dirty → so với initialDraft; (2) provided checkbox editor giữ local value đến stop, bị khóa barrier từ chối → chỉ expose provided renderer click/Space và kiểm chứng F2+Space; (3) date onChange xóa composition → giữ composition ref đến end. Reviewer không chạy test. Không có finding chưa xử lý. Click checkbox qua readOnlyEdit có pha renderer trả old value trước React nhận session; test dùng click + assertion đợi checked, không dùng immediate `check/uncheck` verdict. Không thay bằng sleep hoặc bỏ qua console error.

**Giới hạn/handoff:** Save vẫn là executor stub cho chứng từ mẫu hiện có, trả snapshot/document mới để kiểm tra close và state; không persist dataset. Snapshot chứng từ mới có thể ready, nhưng Create Save vẫn blocked rõ cho đến WEB-06. Unit/reference read-side trong stub không thay authoritative backend; unit khi product mới chưa được xác nhận không tự nhận giá trị client làm chân lý. Lookup field/modal riêng của harness không thuộc Sales field nên prepare chặn, không âm thầm đưa vào payload. Không Post/list/recovery/quyền thật, không kết luận HTTP serialization. Edge/Telex/VNI/screen reader attended còn PENDING. Task kế tiếp **WEB-06**.

**Tài liệu/file:** 85 text files UTF-8 không BOM, LF/final newline; 89 internal link targets tồn tại; `git diff --check` PASS. Commit local, không push/deploy hoặc thay đổi backend.


## PR #1 — sửa findings WEB-03/04/05 (2026-10-31)

Commit: commit `fix: address workspace and sales editing review findings` chứa mục này, parent `fce8916`; branch `codex/web-05-sales-editing`.

- Finding 1: ProductLookup có presentation cell, label/error vẫn liên kết accessible, actions dùng icon buttons Nova. Bỏ tăng row height lên 140. Browser kiểm tra chiều cao trước/trong/sau edit, input nằm trong dòng, action không đè input, popup trong viewport khi resize 1440×900 → 1280×720; suite lookup vẫn kiểm tra scroll/resize/move/hidden owner.
- Finding 2: adapter nhận printable `eventKey` của AG Grid và publish query trong layout effect, giữ original buffer trước khi thay. Browser focus cell → T nhận đúng T; Escape hai tầng phục hồi sản phẩm cũ.
- Finding 3: capture Delete/Backspace trên role=tab trước handler native Dockview, đưa session vào close admission. Browser cả hai phím với dirty hiện decision; pending/outcome-unknown giữ panel và session. Remove/move vẫn không finalize. Đính chính nhận định keybindings sai trong TECHNICAL_BASELINE.
- Finding 4: dirty lookup xét confirmed/composing và selected identity; không so query/label với ID. Restore truyền cả rawBuffers và lookupBuffers mới. Ba unit regression header query bằng ID: dirty, prepare blocked, close Cancel giữ session, restore confirmed cùng ID trở lại clean.
- Finding 5: Lab seed thay 200 dòng và loại raw/lookup của các dòng bị thay trong một store update; giữ header và buffer không liên quan, tuân thủ identity/canEdit. Browser edit Qty không hợp lệ + lookup chưa chọn trước seed, prepare thành công 200 dòng và giữ ghi chú header.

RED: 3 unit regression dirty thất bại trên code cũ; 4 browser regression thất bại (phím T mất, seed không prepare được, Delete và Backspace không hiện decision). GREEN: targeted 10/10 unit, 5/5 browser (gồm pending/unknown), sau đó toàn suite.

Môi trường: Windows, Node 22.14.0, npm 11.6.0; Playwright 1.64.1 Chromium 156.0.8078.4. Browser automation dùng Playwright; không có Browser plugin trong session.

Lệnh cuối và kết quả:

- `npm.cmd run typecheck`: PASS.
- `npm.cmd run test:unit`: PASS **60/60**, 9 files, 0 skipped.
- `npm.cmd run test:e2e -- --project=chromium`: PASS **27/27**, 0 skipped/retries; console warning/error và pageerror assertions xanh.
- `npm.cmd run build`: PASS; cảnh báo bundle >500 kB còn hiện, JS 2,075.58 kB / gzip 584.58 kB.
- `git diff --check`: PASS. Files thay đổi UTF-8 không BOM, LF.

Giới hạn: đây là automated Chromium acceptance với fake/stub; không thay integration backend, Edge hoặc attended Telex/VNI/screen reader. Không thêm dependency hoặc mở rộng WEB-06.


## PR #1 — review vòng 2: điều hướng numeric và Gift (2026-10-31)

Task WEB-05, commit `fix: preserve grid navigation and publish gift changes immediately` chứa mục này, parent `50551e6`; branch `codex/web-05-sales-editing`.

- Finding `4429560897`: Qty/UnitPrice không còn suppress toàn bộ keyboard. Khi focus trên cell, grid xử lý mũi tên và Tab; Enter/F2/printable đưa focus vào input. Khi nhập, text/caret/Escape ở input, Tab/Shift+Tab trả cho grid; composition giữ focus. Input không tạo tab stop riêng ngoài grid; click input đồng bộ row/column đang focus. Raw và composition vẫn publish vào session.
- Finding `4429560903`: Gift đặt `editable: false`, provided CheckboxCellRenderer nhận disabled theo canEdit; không còn đường Tab mở editor chứa local state. Renderer click/Space vẫn phát onCellEditRequest vào draft. Product Tab dừng editor rồi điều hướng grid qua mọi cột thay vì nhảy sang editor kế tiếp.
- Installed AG Grid 36.2.0 source `dist/package/main.esm.mjs` xác nhận CheckboxCellRenderer dùng params.disabled override editable và phát node.setDataValue; không cần tạo checkbox riêng. Cập nhật TECHNICAL_BASELINE, bao gồm sửa mô tả row-height còn sót từ vòng 1.

RED → GREEN: regression mũi tên đứng ở Qty thất bại trước sửa; regression Product → Tab → bật Gift → Ctrl+Alt+W không có dialog thất bại trước sửa. Sau sửa Sales suite 11/11; thêm regression printable/composition/mouse focus rồi chạy toàn bộ.

Automated browser scenarios mới: mũi tên qua Qty/UnitPrice theo cả hai chiều và giữa dòng; F2/Enter vào input; Tab Qty → UnitPrice → Gift → Amount → dòng kế tiếp và Shift+Tab ngược; Space đổi Gift; printable bắt đầu nhập; synthetic composition giữ Tab/Escape; click giá dòng 2 rồi Shift+Tab về đúng Qty dòng 2; Product Tab rồi đổi Gift buộc close decision, Cancel giữ dữ liệu và snapshot nhận isGift=true. Giữ các regression raw invalid, Escape restore, Save barrier và pending/unknown.

Môi trường: Windows, Node 22.14.0, npm 11.6.0, Playwright 1.64.1 / Chromium 156.0.8078.4; browser plugin không có, dùng Playwright. Viewport sales 1440×900; suite vẫn có resize 1280×720 và Light/Dark.

- `npm.cmd run typecheck`: PASS trước kiểm tra targeted; final build chạy lại tsc --noEmit PASS.
- `npm.cmd run test:unit`: **60/60 PASS**, 9 files, 0 skipped.
- `npm.cmd run test:e2e -- --project=chromium`: **30/30 PASS**, 0 skipped/retries; console warning/error và pageerror assertions xanh.
- `npm.cmd run build`: PASS, warning bundle >500 kB vẫn còn (JS 2,076.66 kB / gzip 584.90 kB).
- `git diff --check`: PASS; files thay đổi UTF-8 không BOM, LF.

Giới hạn: automated composition không thay attended Telex/VNI; chưa xác nhận Edge/screen reader hoặc integration backend. Save vẫn stub, không mở rộng WEB-06.


## PR #1 — review vòng 3: editor theo nhu cầu và header (2026-10-31)

Task WEB-04/05; commit `fix: address on-demand editors and header review findings` chứa mục này, parent `f518a7f`, branch `codex/web-05-sales-editing`.

- `4429856735`: lookupIssue nhận CatalogKind; UI dùng scope.catalogKind, barrier ánh xạ field và validation draft dùng chung tên danh mục. Required/unconfirmed của khách hàng/kho/nhân viên/sản phẩm được kiểm chứng qua barrier; browser header kiểm tra required qua snapshot và unconfirmed qua Save stub.
- `4429856736`: Qty/UnitPrice idle chỉ có text, custom decimal-string cellEditor chỉ mount khi double-click/Enter/F2/printable. Raw invalid vẫn hiển thị và giữ trong session sau unmount; onValueChange cập nhật grid model, không chuyển sang Number. Escape restore trước cancel, Enter/Tab trả cell focus; Tab qua Gift và dòng kế tiếp, Shift+Tab ngược. Giữ composition. Close validation mở đúng Qty hoặc UnitPrice rồi để editor autoFocus; không focus fallback alert khi input chưa mount. Regression sửa tiếp và Enter sau lỗi ngăn editor bị orphan.
- `4429856738`: lookup field giữ label/helper nhìn thấy, icon Xóa/Khôi phục cùng hàng input, title và accessible name, preset icon-sm; helper text-xs giữ aria-invalid/describedby. Kiểm tra selected/unconfirmed/empty của cả ba header và Tab tới các actions.
- `4429856740`: Ghi chú tách label khỏi hàng input/trạng thái; toolbar items-center/text-sm. Geometry assertions cho Chưa thay đổi/Chưa lưu, 1/6 dòng, wrap thật ở viewport 600×1100; ảnh 900×900 đã xem trực tiếp, không chồng input/actions và trạng thái căn hàng.

RED → GREEN: ba unit header lỗi required RED (trả sản phẩm); test idle decimal RED (34 input thay vì 0). Khi tích hợp, test close validation rồi sửa tiếp phát hiện focus fallback đóng grid model trước React mount; sửa chủ focus và kiểm chứng lại. Đã cập nhật các test cũ để chủ động mở editor và kiểm tra raw text khi idle, giữ kịch bản drag/remount/invalid/Save/200 dòng.

Môi trường Windows, Node 22.14.0, npm 11.6.0, Playwright 1.64.1 Chromium 156.0.8078.4. Không có Browser plugin, dùng Playwright. Automated browser không thay attended IME.

- `npm.cmd run typecheck`: PASS.
- `npm.cmd run test:unit`: **64/64 PASS**, 9 files, 0 skipped.
- `npm.cmd run test:e2e -- --project=chromium`: **36/36 PASS**, 0 skipped/retries. Foundation 3, lookup 7, review UI 4, sales 14, workspace 8. Console/pageerror assertions xanh.
- `npm.cmd run build`: PASS; cảnh báo bundle >500 kB vẫn còn, JS 2,077.09 kB / gzip 585.02 kB.
- `git diff --check`: PASS; files thay đổi UTF-8 không BOM, LF. Design/baseline cập nhật yêu cầu Owner, không nhân bản spec trong roadmap.

Ảnh `review-3-header.png` đã xem ngoài repo; test dùng testInfo.outputPath để artifact có đường dẫn portable. Giới hạn: Edge, Telex/VNI/screen reader attended còn PENDING; fake/stub không thay backend integration. Gift public callback bất đồng bộ trong cùng lượt JS như reviewer ghi; browser close/snapshot regression tiếp tục xanh, không tuyên bố publication đồng bộ. Không thêm dependency, không mở rộng WEB-06.


## PR #1 — review vòng 4: sort, chốt lookup và căn Gift (2026-10-31)

Task WEB-04/05; commit `fix: preserve row identity and commit lookup to quantity` chứa mục này, parent `7552dde`, branch `codex/web-05-sales-editing`.

- `4429973388`: Qty/UnitPrice error navigation resolve RowNode theo clientLineId trong callback focus, lấy displayed rowIndex hiện hành để ensure-visible/focus/start. Không lấy index từ draft.lines. Hai browser regression sửa invalid rồi sort giảm dần và Close → Save: editor đúng data-line-id, raw `-`; sửa tiếp/Enter cập nhật đúng dòng.
- `4429973390`: Sales grid opt-in đường chốt capture Enter/Tab trước native grid unmount. Active option được gate theo query/context/generation; hoặc dùng selection confirmed đã click. Publish session trước stopEditing, sau đó focus Qty cùng clientLineId qua RowNode. Không mở editor Qty. Bốn browser cases highlight/click × Enter/Tab kiểm tra focus Qty, không còn inline editor/input, label và snapshot productId đúng. Case bổ sung đổi query sau highlight/composition giữ raw/editor, không chọn highlight cũ; Escape restore. Field/modal/harness regression không đổi vì không opt-in luồng Sales.
- `4429973391`: provided CheckboxCellRenderer giữ nguyên, style scoped flex wrapper căn giữa hai trục. Geometry regression checked/unchecked/disabled và resize cột PASS; click/Space/keyboard/locks trong suite cũ tiếp tục xanh.

RED → GREEN: cả 7 acceptance cases ban đầu FAIL trên code cũ (2 sort identity, 4 commit focus Qty, 1 geometry; checkbox lệch ngang 18.5px). Sau sửa đã sửa expectation fixture SP002 về ID string thực `9007199254740994` (không giả định ID nhỏ), thêm case stale highlight/composition và chạy full suite.

Môi trường Windows, Node 22.14.0, npm 11.6.0, Playwright 1.64.1 / Chromium 156.0.8078.4. Không có Browser plugin, dùng Playwright. New cases viewport 1440×900; full suite giữ Light/Dark, resize/wrap và các viewport đã ghi ở vòng 3.

- `npm.cmd run typecheck`: PASS.
- `npm.cmd run test:unit`: **64/64 PASS**, 9 files, 0 skipped.
- `npm.cmd run test:e2e -- --project=chromium`: **44/44 PASS**, 0 skipped/retries, gồm 8 cases vòng 4; console/pageerror assertions xanh.
- `npm.cmd run build`: PASS; warning bundle >500 kB còn hiện, JS 2,077.66 kB / gzip 585.20 kB.
- `git diff --check`: PASS. Files thay đổi UTF-8 không BOM, LF. Contract/design và baseline đã cập nhật yêu cầu Owner mới.

Giới hạn: synthetic composition không thay attended Telex/VNI; chưa bổ sung Edge/screen reader/backend integration. Gift public callback vẫn bất đồng bộ trong cùng lượt JS; không thay đổi cam kết đã ghi ở vòng 3. Không thêm dependency hoặc mở rộng WEB-06.


## WEB-06 — Sales pilot, fake outcomes và recovery (2026-10-31)

Task WEB-06; commit `feat: complete async Sales pilot and recovery scenarios` chứa mục này, parent `7a082a8`, branch `codex/web-06-sales-pilot`. Làm trong checkout hiện tại trên nhánh riêng; không sửa main, không push/merge. Không thay package/lockfile; `salesFixtures.ts` tách dataset Sales khỏi catalog fixture. `SalesScenarioControls` thay close stub controls; code stub cũ đã bỏ.

### Hành vi và truy vết

| Boundary/scenario | Kiểm chứng thực chạy |
|---|---|
| SAL-01 | Browser `create edit save post preserves session and row identity`: chọn header/product qua Floating UI, Create trả Sale ID/version và unit, giữ session/row; sửa Save rồi Post; total 31.2500; Posted chặn input/F2/printable/paste synthetic/checkbox Space. |
| SAL-04/05 | Browser empty header/ngày không thật/note dài không tạo; known failure/forbidden capabilities không mất raw; Write và Post độc lập. Unit map `lines[index]` về clientLineId của snapshot và giữ fieldless feedback; fake port tự kiểm tra quyền/validation kể cả bypass UI. |
| SAL-06/07 | Browser hai session delayed response hoàn tất ngược thứ tự, khóa đúng panel và không duplicate pending. Unit dedup Save/Post, không auto-save trước Post, response actor generation cũ không apply, exception thành unknown. |
| SAL-08 | Browser Update/Post commit rồi mất response; version cũ, denied/error, changed version nhưng nội dung khác giữ lock; eventual commit được external controller giải phóng sau Get cũ. Get phù hợp chỉ đề nghị đối soát, phải xác nhận; snapshot gốc vẫn xem được. Unit đảo thứ tự recovery reads, trả sai Sale ID, Post Get đổi thứ tự/thêm dòng. |
| SAL-09 | Browser Create unknown: list rỗng/lỗi/nhiều ứng viên không replay hoặc tự liên kết; chọn ID, Get và so business data rồi xác nhận. Đổi ID khỏi candidate đang preview vô hiệu hóa xác nhận. Unit eventual Create không tạo lại; Create success bind record vào cùng session. |
| SAL-10 | Dataset 36 chứng từ; unit BigInt sort đúng ID vượt safe integer, keyset trước/sau, cursor ràng buộc filters, Product membership giữ tổng mọi dòng. Browser default 25 mục, next/filter reset cursor. |
| SAL-12 | Browser mở 1004 có sản phẩm inactive ngoài catalog search, đóng/mở vẫn giữ nhãn từ Get. Version/reference conflict giữ note và raw decimal; explicit reload/review không bỏ bản sửa cho đến xác nhận. Unit reload tái dùng clientLineId theo saleLineId, phiên sửa tiếp trong lúc đọc vô hiệu hóa preview nhưng không kẹt loading. |
| SAL-02/03/11, EDT-01–04 | Decimal/barrier suite và toàn bộ Sales editing regression PASS với fake runtime: duplicate product independent IDs, gift, 200/201 dòng, invalid raw/IME synthetic, last keystroke/snapshot và raw trước port. |
| WKS-01–09, đặc biệt WKS-07/08 | Workspace browser regression dùng fake dataset Save thật thay stub: X/middle-click/Delete/Backspace/Ctrl+Alt+W, Cancel/Discard invalid, failed Save giữ phiên, delayed/unknown chặn đóng, split/move/route remount giữ dữ liệu/đích lệnh. |
| LKP-01–06 | Unit/component và lookup-grid browser regression qua Floating UI/AG Grid thật PASS; không sửa owner popup hoặc adapter keyboard. |

App `/` và `/lab/sales` cùng `SalesWorkspace`; `/lab/components` giữ catalog harness và dùng cùng document components. Danh sách có nút tải lại để đọc dataset sau mutation; không tự refetch ghi đè draft. Lab cho chọn mutation/read mode và giải phóng request; product recovery chỉ dùng public `list`/`get`, không đọc hàng đợi/outcome bí mật. Query scenario có allowlist; unknown fallback default.

### Môi trường, lệnh và kết quả

Windows; Node **22.14.0**, npm **11.6.0**, Playwright **1.64.1**, Chromium **156.0.8078.4**. Browser plugin không có; dùng Playwright của repo tại `http://127.0.0.1:5173`. Viewports 1440×900, 1280×720 và regression wrap 600×1100/900×900; Light/Dark giữ panel. Không nhận viewport nhỏ làm browser zoom/OS DPI evidence.

- Baseline trước sửa: `npm.cmd run test:unit` — **64/64 PASS**.
- Targeted fake/keyset: **12/12 PASS**; targeted port commands cuối: **15/15 PASS**. Các test behavior mới đã chạy RED trước implementation cho command/reload/delayed response lost; fake adapter do subagent chạy RED → GREEN.
- `npm.cmd run typecheck` — **PASS**.
- `npm.cmd run test:unit` — **91/91 PASS**, 12 files, 0 skipped.
- `npx playwright test tests/e2e/sales-flow.spec.ts tests/e2e/sales-recovery.spec.ts --workers=1` (project Chromium duy nhất trong cấu hình repo) — **10/10 PASS**. Targeted list default25 regression **1/1 PASS**, đã RED ở 10 trước sửa.
- `npm.cmd run test:e2e -- --project=chromium --workers=2` — **54/54 PASS**, 0 skipped/retries: 44 regression + 10 Sales flow/recovery. Page identity/content/no framework overlay và console/pageerror checks PASS. Một lần chạy bị dừng do HMR khi source còn đổi không được tính acceptance; regression trung gian 21/23 đã sửa expectation label stub và threshold grid200, các run cuối xanh.
- `npm.cmd run build` — **PASS**; warning chunk >500 kB vẫn còn: JS **2,097.46 kB**, gzip **592.16 kB**. Không mở rộng task sang code splitting.
- `git diff --check`, internal Markdown links và UTF-8 không BOM/LF trên các file thay đổi — **PASS**.

Ảnh browser `web06.png` lưu qua `testInfo.outputPath`, đã xem trực tiếp bản ngoài repo: Posted document có header/grid/feedback, controls disabled; đợi Dockview resize ổn định và assert không tràn ngang trước chụp. Không commit screenshot/traces/logs. Synthetic ClipboardEvent/composition là automated evidence, không phải thao tác IME người dùng.

### Review và giới hạn

Reviewer độc lập báo một lỗi P2: Post recovery dùng snapshot index có thể gán nhầm hoặc trùng clientLineId khi bản Posted từ Get đổi thứ tự/thêm dòng. Regression `Post recovery reconciles changed authoritative lines by server identity, never index` đã RED → GREEN; Post recovery giờ ghép theo saleLineId, chỉ cấp ID mới cho dòng mới. Save/Create vẫn giữ mapping snapshot khi business fields/order đã khớp. Không có deferred finding khác. Rà spec cũng sửa default list từ 10 về 25 và thêm browser regression.

Fake cost/profit bằng dữ liệu demo có nhãn; không tính COGS/ledger/SQL. Capability không phải security production; concurrency/recovery giả lập không hứa backend idempotency. Abort không được xem là rollback; Save/Post không auto retry; Create unknown không có đường mở khóa bằng timeout/list rỗng. Dataset và draft mất khi reload trang. **Edge/Telex/VNI/screen reader attended PENDING**; HTTP/auth/backend integration, layout persistence WEB-07, handoff WEB-08 chưa được thực hiện trong task này. Task kế tiếp **WEB-07**.

## WEB-07 — Layout persistence và integration hardening (2026-10-31)

Task WEB-07; commit `feat: persist safe workspace layouts and harden integration` chứa mục này, parent `da2c63a`, branch `codex/web-07-layout-persistence`. Tiếp tục trong checkout hiện tại trên nhánh riêng; không push/merge. Không thay package/lockfile hoặc backend. `workspaceLayouts.ts` giữ orchestration bên cạnh close controller hiện hữu, không tạo admission thứ hai.

### Hành vi và truy vết

| Boundary/scenario | Kiểm chứng thực chạy |
|---|---|
| WKS-10 | Unit serializer rebuild theo allowlist, schema/registry version và actor key/generation; giới hạn graph/depth/size, duplicate/reference lỗi bị từ chối. Browser inject JSON lỗi, schema lạ, sai actor, component lạ, params có draft/session ID và hidden group: fallback vẫn mở được chứng từ, không nhận nội dung injected. Unknown component được bỏ nếu graph còn hợp lệ. |
| WKS-11 | Browser split saved records → reload tạo session ID mới, Get lại baseline và nhãn sản phẩm inactive; raw/note và tab mới chưa Save không được khôi phục. Stored JSON chỉ có layout/reference, không có draft/raw/session IDs. Record mất hiển thị lỗi, retry/close hoạt động; unit retry không tạo document giả. |
| WKS-12 | Browser restore/reset/switch actor dùng closeAll: invalid raw Cancel giữ phiên; Discard cho phép chuyển; failed Save chặn; pending/unknown chặn cả ba đường. Unit serialized admission và khóa entry mới khi đang chờ, storage denied/quota và fromJSON throw fallback. Beforeunload là best effort; UI có đúng copy giới hạn refresh. |
| WKS-03/04 | Browser move/split/resize/route remount giữ session/scroll/column width và thứ tự các cột đã di chuyển. Route remount giữ layout trong memory cùng phiên, không deserialize draft từ localStorage. Test thứ tự chỉ so các header còn render ở cả hai độ rộng vì AG Grid virtualize cột cuối. |
| LKP-05/06, EDT-01/02 | Full lookup-grid, editing và review regressions chạy production components: popup resize/scroll/move/hidden owner, synthetic composition, invalid decimal, grid navigation, barrier/last keystroke. Không thay owner positioning/focus/dismiss. |
| Resize/theme/zoom | Chromium viewport 1440×900, 1280×720; wrap regression 900×900/600×1100; Light/Dark và two-group routing. Native tab zoom 125%/200% xác nhận qua Chrome getZoom trong isolated extension profile: focus, note, session và Save giữ đúng; không tràn ngang trang. List panel cuộn và có minimum grid height để controls vẫn truy cập khi vùng làm việc thấp. |

Layout debounce 250 ms qua `toJSON`; `fromJSON` chỉ nhận graph đã sanitize/remap. Actor demo switch nằm ngoài sản phẩm trong Lab; generation khác không dùng lại layout cũ. Runtime-only memory giữ raw/draft qua route, không được ghi thẳng ra storage. Persisted layout không phải recovery journal; saved reference vẫn có thể refetch khác sau reload. Fake dataset vẫn chỉ trong bộ nhớ.

### Môi trường và kết quả

Windows; Node **22.14.0**, npm **11.6.0**, Playwright **1.64.1**, Chromium **156.0.8078.4**. Browser plugin không có; dùng Playwright repo tại `http://127.0.0.1:5173`. Native zoom dùng Chromium persistent context trong temporary profile được xóa sau test; không dùng profile người dùng.

- Baseline **91/91 unit PASS**. Serializer/controller tests đã RED trước implementation. Review regressions hidden group và reattach dirty/new/unknown đã RED → GREEN.
- `npm.cmd run test:unit` — **127/127 PASS**, 15 files, 0 skipped.
- `npm.cmd run typecheck` — **PASS**.
- `npm.cmd run test:e2e -- --project=chromium --workers=2` — **68/68 PASS**, 0 skipped/retries: 54 regression + 13 layout restore + 1 native zoom. Bao gồm toàn bộ `workspace.spec.ts`, `layout-restore.spec.ts` và lookup/editing/Sales regression. Console/pageerror assertions của các suite PASS.
- `npm.cmd run build` — **PASS**; warning chunk >500 kB còn hiện, JS **2,107.52 kB**, gzip **595.12 kB**. Không mở rộng task sang code splitting.
- `git diff --check`, internal Markdown links và UTF-8 không BOM/LF trên file thay đổi — **PASS**. Đây là kiểm tra tài liệu, không thay browser acceptance.

Đã xem ảnh `layout-restore.png` (1280×720) và `zoom-2.png` qua output của test: typography/theme giữ preset, nội dung dài dùng panel/grid scroll, không tràn ngang trang. Ở 200%, note đang focus và phần grid dưới fold; Save đã thực hiện thành công trước ảnh. Screenshot/log/trace là artifact kiểm chứng cục bộ, không commit.

### Review và giới hạn

Reviewer độc lập tìm hai lỗi P2 và xác nhận sửa: (1) Dockview transient fromJSON clear rồi throw khiến live session mất panel; runtime attach giờ dựng lại panel còn thiếu và active session, giữ dirty/unknown; (2) `visible:false` có thể ẩn hết group mà không có lệnh hiện lại; schema từ chối và fallback. Không còn finding actionable sau review.

Các run trung gian không tính acceptance: sửa cấu hình native zoom `viewport:null` không tương thích deviceScaleFactor của Playwright; sửa list height/scroll và phép đo header virtualization; một full run **66/67** có timeout boundingBox ở wrap regression, chạy riêng **1/1 PASS** mà không đổi behavior/test đó. Typecheck đã bắt property injection `visible` thiếu trong inferred test fixture; dùng Object.assign cho payload không tin cậy.

Không có HTTP/auth/backend thật, durable drafts/offline, idempotency backend hoặc popout. Không tuyên bố fake actor/capability là security production. **Edge/Telex/VNI/screen reader attended vẫn PENDING**; synthetic composition không thay thao tác người dùng. Task tiếp theo **WEB-08**, chưa thực hiện HTTP integration handoff trong WEB-07.

# Evidence — Web Workspace and Editing Foundation

**Ngày:** 2026-10-31. **Candidate hiện tại:** WEB-01 trên `codex/web-01-foundation`. **Runtime:** shell/Lab và fake catalog, dependency lock đã có; chưa có Sales runtime/API thật.

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

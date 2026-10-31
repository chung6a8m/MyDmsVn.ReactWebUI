# Web Workspace and Editing Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Khi môi trường không cung cấp các skill đó, dùng trực tiếp thứ tự task, interface, kiểm tra và review dưới đây; không phải cài thêm công cụ để đọc hoặc triển khai plan.

**Goal:** xây nền Web và Sales pilot có hành vi nhập liệu/workspace được kiểm chứng qua fake async ports.

**Architecture:** React feature components dùng chung giữa app và Lab. Dockview chỉ giữ layout; session store giữ draft/raw buffers; AG Grid và Floating UI giao tiếp qua editor barrier và command routing của ứng dụng. Backend thật là boundary riêng.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS v4, shadcn/ui Nova + Base UI, Dockview, AG Grid Community, Floating UI React, TanStack Router/Query, Zustand, React Hook Form/Zod, Vitest/Testing Library/Playwright.

**Spec:** [Web UI Foundation](../design/WEB_UI_FOUNDATION.md), [Workspace](../design/WORKSPACE_BEHAVIOR.md), [Lookup/Editing](../design/LOOKUP_AND_GRID_EDITING.md), [Sales Pilot](../design/SALES_PILOT.md).

**Ngày chọn:** 2026-10-31. **Trạng thái:** ACTIVE / IN PROGRESS. WEB-01–WEB-06 DONE; task kế tiếp WEB-07. Repo lúc chọn rỗng; kết quả triển khai được ghi trong evidence.

## Global Constraints

- Giữ Nova/default themes; không Business Compact, font 14px bắt buộc hoặc density riêng.
- AG Grid Community; không cài Enterprise hoặc dùng feature có license thương mại để vượt giới hạn.
- Một chủ sở hữu popup: ProductLookup trực tiếp dùng Floating UI; không lồng Base UI Combobox controller.
- Active chỉ same-window dock/tab/split/resize và fake API. HTTP/runtime/auth thật, floating/popout, durable drafts/offline, in/xuất chưa active.
- Precision/date/identity theo Sales Pilot; raw buffers và draft thuộc session, không thuộc layout/DOM.
- Không auto retry mutation, không suy abort = rollback, không nhập pending backlog của repo desktop.
- Source/Markdown UTF-8 không BOM, LF. Đọc [Test Policy](../TEST_POLICY.md); mọi đường dẫn runtime dưới đây là file sẽ tạo.

## Review Focus

1. Remove/add khi kéo panel phải giữ phiên và buffer — test `move_panel_does_not_close_session`, WEB-02/07.
2. Raw text invalid/composition chưa xong phải giữ được qua hide và Close Cancel; Close Discard được dùng khi an toàn — WEB-03/04/05.
3. Ký tự cuối và checkbox vừa đổi phải vào đúng snapshot khi Save ngay — WEB-05.
4. Popup click/Tab/Escape trong modal và grid không commit/cancel hai lần — WEB-04/05.
5. Mutation đã commit nhưng response mất phải giữ recovery lock, không replay vào phiên khác — WEB-06.

## Thứ tự và cách làm

WEB-01 → WEB-02 → WEB-03 + WEB-04 → WEB-05 → WEB-06 → WEB-07 → WEB-08. Hai task song song phải tách file ownership; interfaces thuộc spec. Trước một behavior mới, tạo kiểm tra có khả năng phát hiện sai behavior và chạy để thấy failure có ý nghĩa; sau đó hiện thực và chạy lại. Scaffold/config không cần test giả tạo. Commit từng deliverable, cập nhật task/evidence và review boundary trước task phụ thuộc.

### WEB-01 — Toolchain, default shell, Lab và contracts

**Files tạo:** `package.json`, `package-lock.json`, `.gitignore`, `.editorconfig`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/app/{App.tsx,providers.tsx,router.tsx,theme.ts}`, `src/index.css`, `src/components/ui/`, `src/lab/{SalesLab.tsx,ComponentsLab.tsx}`, `src/features/sales/contracts.ts`, `src/ports/{salesPort.ts,catalogPort.ts}`, `src/infrastructure/fake/{fixtures.ts,fakeCatalogPort.ts}`, `vitest.config.ts`, `playwright.config.ts`, `tests/e2e/foundation.spec.ts`.

**Consumes:** các quyết định/type/port trong spec; chưa có code.

**Produces:** app/Lab entry, app theme mode, `SalesPort`, `CatalogPort`, `ReadResult`, `WriteResult`, các type Foundation/Sales Pilot trong `contracts.ts`; scripts của Test Policy. Route `/lab/sales`, `/lab/components`; allowlist `scenario`. `CatalogPort.search(query, context)` trả fixture có kiểm soát.

- [x] Xác minh release stable và tương thích của Node LTS/Vite/React/Tailwind/shadcn Base+Nova/Dockview/AG Grid/Floating UI. Ghi exact versions, generator command và cấu hình trong Technical Baseline; pin bằng lockfile. Kiểm tra API source đã khảo sát so với package cài thực tế.
- [x] Khởi tạo React TS/Vite, cài Tailwind v4 plugin chính thức, tạo Nova + Base UI. Giữ defaults; ghi built-in Dockview themes và Quartz được chọn. Đặt order CSS layers/import phù hợp; chỉ thêm layout/portal integration CSS cần thiết.
- [x] Định nghĩa contracts nguyên văn về shape/semantics, providers và fixture catalog. Fake context có `actorKey`, `actorGeneration`, `signal`; không có real login/secret/env API endpoint.
- [x] Tạo shell và direct Lab routes, có một Dockview panel với AG Grid Community để chứng minh ba nền tích hợp. App/Lab import cùng component; đăng ký Community modules theo bản đã pin. Không scaffold deployment hoặc server.
- [x] Browser smoke `default_libraries_render_and_switch_theme`: load hai routes, grid visible có kích thước, đổi Light/Dark không lỗi console hoặc tạo mất nội dung panel. Tạo scripts, chạy `npm run typecheck`, `npm run build`, `npm run test:e2e -- tests/e2e/foundation.spec.ts --project=chromium`.
- [x] Ghi evidence phiên bản/kết quả thực chạy và commit `chore: establish default React web UI foundation`.

**Done:** shell/Lab chạy, Community-only dependency inventory, build/typecheck và browser smoke PASS; không được báo Sales hoàn chỉnh.

### WEB-02 — Document sessions và Dockview

**Files tạo/sửa:** `src/app/workspace/{WorkspaceHost.tsx,panelRegistry.ts,commandRouter.ts}`, `src/features/sales/{salesSessionStore.ts,SalesDocumentPanel.tsx}`, `tests/unit/workspace/sessionIdentity.test.ts`, `tests/e2e/workspace.spec.ts`; App/Lab composition.

**Consumes:** contracts và providers WEB-01.

**Produces:** store theo `DocumentSessionId`; registry ánh xạ record→session→panel; `openSalesDocument(saleId: ServerId | null): Promise<DocumentSessionId>`; command target được chụp từ focus/active; lifecycle events không tự finalise session.

- [x] Thêm `reopen_record_activates_existing_session`, `move_panel_does_not_close_session`, `two_groups_route_to_focused_document`. Assert session/line IDs, raw buffer và request generation được giữ; remove/add do move không increment session generation.
- [x] Dùng Dockview React adapter, `always` cho panel edit ban đầu, scope observers/cleanup rõ. Hoạt động nền không cần thiết theo visibility được tạm dừng; không tối ưu bằng remount.
- [x] Lưu column/view state theo session; layout đổi không fit-to-size mọi cột hoặc ghi width=0. Toolbar giữ target khi focus chuyển từ editor sang button.
- [x] Chạy `npm run test:unit -- tests/unit/workspace/sessionIdentity.test.ts`, `npm run test:e2e -- tests/e2e/workspace.spec.ts --project=chromium`, typecheck; chứng minh WKS-01–04. WEB-05/07 kiểm tra lại với editor hoàn chỉnh.
- [x] Cập nhật evidence và commit `feat: add document sessions and docked workspace`.

**Done:** mở/chuyển/kéo/split/resize với dữ liệu edit harness không mất phiên; chưa cấp quyền cho mọi đường đóng.

### WEB-03 — Close admission và command routing

**Files tạo/sửa:** `src/app/workspace/{workspaceController.ts,DocumentTab.tsx,CloseDocumentDialog.tsx,commandRouter.ts}`, `src/features/sales/salesCommands.ts`, `tests/unit/workspace/closeAdmission.test.ts`, `tests/e2e/workspace.spec.ts`.

**Consumes:** session registry WEB-02; `SaveOutcome` chuẩn; save executor có thể thay bằng deferred fake trong test.

**Produces:** `requestClose(sessionId, reason): Promise<'closed'|'cancelled'|'blocked'>`; `closeAll(reason: CloseReason): Promise<'closed'|'cancelled'|'blocked'>`; một cửa admission cho mọi close/reset command. Save executor sẽ nối barrier WEB-05 và đầy đủ port WEB-06.

- [x] Thêm `invalid_buffer_can_discard_but_cancel_preserves`, `save_failure_does_not_close`, `pending_or_unknown_blocks_discard`, `close_all_stops_at_first_cancel`, `close_intent_does_not_change_target_after_await`.
- [x] Nối `DockviewDefaultTab.closeActionOverride` cho X/middle-click ở version pin. Inventory mọi affordance/menu/group close; route qua guard hoặc chưa expose. Không giả định global cancellable remove hook.
- [x] Định nghĩa một quyết định đang mở/session; Save/Discard/Cancel giữ semantics của Workspace. Finalise đúng một lần sau admission; dùng draft mutation stub có kết quả rõ để test close, không giả vờ đó là backend thật.
- [x] Browser kiểm tra WKS-05–09 bằng X và middle-click thật, invalid raw, repeated close, hai group. Chạy unit path và `tests/e2e/workspace.spec.ts`; typecheck.
- [x] Ghi đường đóng đã bao phủ/đường bị tắt, cập nhật evidence, commit `feat: guard document close and route workspace commands`.

**Done:** không tồn tại đường đóng được cung cấp cho người dùng mà bypass admission. WEB-06 bổ sung recovery thật trong fake port.

### WEB-04 — Floating UI lookup

**Files tạo:** `src/shared/lookup/{ProductLookup.tsx,useProductLookup.ts,lookupTypes.ts,LookupOverlayHost.tsx}`, `src/shared/grid/ProductLookupCellEditor.tsx`, `tests/unit/lookup/lookupState.test.ts`, `tests/components/lookup/ProductLookup.test.tsx`, `tests/e2e/lookup-grid.spec.ts`; sửa ComponentsLab và fake catalog scenarios.

**Consumes:** `CatalogPort`, session identity, panel/modal ownership. **Produces:** ProductLookup controlled selected ID/display/query contract, một overlay host, adapter field và grid; raw buffer publication vào session.

- [x] Thêm tests LKP-01/02: gõ không tự đổi ID; clear tường minh; query chưa xác nhận chặn save; request cũ/context cũ/session cũ không ghi đè. Dùng deferred responses, không random delay.
- [x] Hiện thực một Floating UI controller với middleware/autoUpdate cleanup, virtual list navigation và non-modal behavior theo Lookup spec. Không lồng Base UI Combobox controller. Khi host chưa có hoặc panel hidden, không portal nhầm ra body.
- [x] Hiện thực composition/keyboard/pointer theo LKP-03/04: Enter chọn đúng một lần, Escape lần đầu đóng popup, Tab giữ default grid navigation, chuột chọn thắng race blur, touch vẫn cuộn được.
- [x] Gắn `ag-custom-component-popup`, host panel/modal và lifecycle. Browser LKP-05/06 kiểm tra modal focus/inert, resize/scroll/move, hidden/zero-size và cleanup. Test IME synthetic được gắn nhãn, bổ sung attended khi có môi trường.
- [x] Chạy unit/component paths, `npm run test:e2e -- tests/e2e/lookup-grid.spec.ts --project=chromium`, typecheck/build; cập nhật evidence và commit `feat: add Floating UI product lookup and grid adapter`.

**Done:** lookup dùng được ở field và grid harness; dữ liệu chưa xác nhận được giữ và báo đúng.

### WEB-05 — Decimal, lines và barrier

**Files tạo/sửa:** `src/features/sales/{decimal.ts,validation.ts,SalesLinesGrid.tsx,SalesHeaderForm.tsx,salesSessionStore.ts}`, `src/shared/grid/{DecimalCellEditor.tsx,editorBarrier.ts,ProductLookupCellEditor.tsx}`, `tests/unit/sales/{decimal.test.ts,validation.test.ts}`, `tests/unit/grid/editorBarrier.test.ts`, `tests/e2e/sales-editing.spec.ts`.

**Consumes:** state WEB-02, close flow WEB-03, lookup WEB-04, canonical type. **Produces:** bảy cột/headers, raw buffers + normalized draft; `prepareSave(sessionId): Promise<PrepareSaveResult>` và immutable snapshot có `editRevision`.

- [x] Test arithmetic với `1.0001 * 0.5000 → 0.5001`, max Qty/Price, overflows, zero trailing normalization và nonzero excess scale; duplicate product IDs vẫn hai clientLineIds, gift giữ giá, 201 dòng bị chặn.
- [x] Hiện thực BigInt fixed-scale parser/calc, validation header/date/lines, DecimalCellEditor giữ raw; kiểu hiển thị/payload local theo Sales Pilot. Dùng editor checkbox/text sẵn có khi retention contract đã được chứng minh.
- [x] Test `save_immediately_after_last_keystroke_uses_new_revision`, `unmounted_editor_valid_buffer_is_flushed`, `invalid_buffer_blocks_without_losing_text`, `escape_restores_preedit_session_buffer`. Không chờ arbitrary timeout hoặc đọc DOM để đoán commit.
- [x] Hiện thực barrier serialize prepare intent, đợi commit publication và lock revision trước snapshot. Buffer còn composition/query chưa xác nhận phải blocked; hide/move giữ buffer; Discard không đi qua validator.
- [x] Chạy unit paths, `npm run test:e2e -- tests/e2e/sales-editing.spec.ts --project=chromium`, và lookup browser regression nếu đổi adapter; chứng minh EDT-01–04, SAL-02/03/11; commit `feat: add precise sales editing and save barrier`.

**Done:** có snapshot chính xác từ input thực, mọi lỗi giữ dữ liệu; chưa tuyên bố HTTP serialization được quyết định.

### WEB-06 — Sales pilot và fake outcomes

**Files tạo/sửa:** `src/infrastructure/fake/{fakeSalesPort.ts,scenarioController.ts,fixtures.ts}`, `src/features/sales/{SalesWorkspace.tsx,SalesListPanel.tsx,SalesDocumentPanel.tsx,salesCommands.ts,SalesFeedback.tsx}`, `src/lab/SalesLab.tsx`, `tests/unit/sales/{salesCommands.test.ts,keyset.test.ts}`, `tests/e2e/{sales-flow.spec.ts,sales-recovery.spec.ts}`.

**Consumes:** ports và prepareSave; requestClose chờ SaveOutcome. **Produces:** list/get/save/post fake, capabilities, conflict/recovery và shared app/Lab feature graph.

- [x] Tạo dataset >=30 chứng từ, lọc trước cursor/page, Product membership không cắt line totals; cursor ràng buộc filter, Sale ID sort dùng so sánh số chính xác. Test SAL-10.
- [x] Fake Get/Save/Post trả server identity/version, line mapping và read-side reference summaries. Test mở lại inactive reference ngoài trang search vẫn có nhãn; session tái dùng line identity theo contract. Fake Post xác nhận Posted/read-only; validation và optimistic concurrency chạy ở fake port, không xây SQL/COGS engine.
- [x] Nối requestSave/requestPost: chuẩn bị snapshot, freeze đúng session, không auto-save trước Post, không duplicate pending write. Map issues theo snapshot/clientLineId; fieldless errors luôn nhìn thấy.
- [x] Thêm scenarios forbidden, version/reference conflict, delay, known failure và commit-then-response-lost. Recovery dùng public Get/list: version cũ trước eventual commit, deny/error hoặc version mới không khớp vẫn khóa; đối soát bằng chứng dương tính theo Sales Pilot giữ snapshot để người dùng xem. Create unknown không replay khi search rỗng hoặc mơ hồ. Fake controller ngoài product region không thành lối đọc outcome bí mật của UI.
- [x] Chạy SAL-01/04/05/06/07/08/09/12 qua browser và unit, nối lại EDT-03/WKS-07/08 với fake mutation. Lệnh: unit sales paths, `npm run test:e2e -- tests/e2e/sales-flow.spec.ts tests/e2e/sales-recovery.spec.ts --project=chromium`, typecheck/build.
- [x] Ghi giới hạn fake/cost/security và commit `feat: complete async Sales pilot and recovery scenarios`.

**Done:** app và `/lab/sales` chạy cùng màn hình, happy/failure/unknown đều có kết quả xác định và dữ liệu không thất lạc.

### WEB-07 — Layout persistence và integration hardening

**Files tạo/sửa:** `src/app/workspace/layoutPersistence.ts`, `WorkspaceHost.tsx`, `workspaceController.ts`, `tests/unit/workspace/layoutPersistence.test.ts`, `tests/e2e/{workspace.spec.ts,layout-restore.spec.ts}`; scenario/evidence theo nhu cầu hẹp.

**Consumes:** đầy đủ session/command graph. **Produces:** versioned allowlisted layout persistence, guarded restore/reset, fallback và copy giới hạn draft sau refresh.

- [ ] Test invalid JSON, schema cũ không hỗ trợ, component lạ, params chứa draft, sai actor scope, record không còn; fallback mở được app, không lộ dữ liệu draft trong JSON.
- [ ] Dùng `toJSON`/`fromJSON` qua schema/allowlist; lưu references cho record đã có; restore tạo session mới và refetch. Tab new chưa lưu không phục sinh giả. Thay layout/actor đi qua closeAll; cancel/unknown chặn thay.
- [ ] Chạy WKS-10–12 và lặp boundary WKS-03/04, LKP-05/06, EDT-01/02 với production Sales. Resize/zoom/Light-Dark và hai group phải giữ focus/dữ liệu; không reset column state theo resize.
- [ ] Chạy unit layout, `npm run test:e2e -- tests/e2e/workspace.spec.ts tests/e2e/layout-restore.spec.ts --project=chromium` và regression boundary vừa sửa; cập nhật evidence, commit `feat: persist safe workspace layouts and harden integration`.

**Done:** lưu layout an toàn, restore/fallback thực chạy; không hứa durable drafts hoặc multi-window.

### WEB-08 — Evidence cuối và handoff API

**Files cập nhật:** README, AGENTS nếu routing thay đổi, Technical Baseline, evidence, plan/index và Codex handoff. **File tạo:** `docs/development/HTTP_INTEGRATION_HANDOFF.md`.

**Consumes:** toàn bộ task trước. **Produces:** bằng chứng đúng phạm vi, interface inventory và việc cần quyết định trước HTTP thật; không có runtime backend mới.

- [ ] Chạy một lần tổng hợp `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run test:e2e -- --project=chromium`; ghi số test thực chạy, failures/skips và environment.
- [ ] Đối chiếu mọi WKS/LKP/EDT/SAL ID với test/evidence cụ thể. Kiểm tra attended Edge/Windows + IME nếu có; nếu chưa có, ghi PENDING riêng và không tuyên bố toàn bộ input acceptance PASS.
- [ ] Handoff HTTP: đối chiếu C# DTO/JSON source thật, `int64`/decimal conversion, calendar date/version, create unknown, Post acknowledgement/detail reload, independent permissions, auth/session, CORS/cookie/bearer decision và host/runtime net48. Mỗi mục ghi required decision hoặc verified mapping; không tự chọn migration backend.
- [ ] Kiểm tra Community-only packages/features, native themes và generated Nova config; docs links/status/encoding. Ghi limitations, next-scope recommendation và commit `docs: record web foundation evidence and HTTP handoff`.

**Done:** automated scope có evidence; attended scope được ghi thật; roadmap status kết thúc đúng mức. API thật và roadmap mới chưa tự active.

## Bàn giao hiện tại

WEB-01 DONE: toolchain, shared shell/Lab, contracts và fake catalog; typecheck/build, 3 unit và 3 Chromium tests PASS. WEB-02 DONE: document sessions và Dockview edit harness; WKS-01–04 được kiểm tra trong phạm vi harness. WEB-03 DONE: close admission và Save stub, WKS-05–09 có evidence trong phạm vi stub; recovery còn thuộc WEB-06. WEB-04 DONE: lookup field/grid/modal và LKP-01–06 có automated evidence; attended IME/screen reader còn PENDING. WEB-05 DONE: precise decimal, header/7-column grid và save barrier; EDT-01–04, SAL-02/03/11 có evidence trong phạm vi stub. WEB-06 DONE: fake Sales list/Get/Save/Post, capabilities/conflict và public-read recovery có automated evidence; không có backend thật. WEB-07–WEB-08 vẫn PLANNED. [Codex handoff](../development/CODEX_HANDOFF.md) là điểm giao việc, [evidence](../evidence/20261031-web-foundation.md) là nơi ghi kết quả khi thực hiện.

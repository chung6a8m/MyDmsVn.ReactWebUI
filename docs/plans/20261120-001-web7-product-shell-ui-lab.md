# Roadmap 07 — Product Shell, UI Lab và shared UI (ReactWebUI)

**Ngày chọn hướng: 2026-11-20. Trạng thái hiện hành: WEB7-01 DONE (PR #46 merged); WEB7-02 VERIFIED CODE / PR #47 IN REVIEW; WEB7-03–09 PLANNED.** Owner chọn giữ cùng repo, bổ sung Product Shell theo cấu trúc sidebar-07 trên Nova + Base UI, nâng Lab thành catalog/nơi kiểm tra hành vi, rồi phát triển shared UI từ Sales/Receipt/Inventory. Lần **lập roadmap ban đầu** chỉ tạo tài liệu, không triển khai UI. WEB7-01 đã merge ở PR #46 và WEB7-02 đang review qua PR #47; các kết quả runtime được ghi tại [WEB7-01](../evidence/web7/20261120-web7-01-lab-diagnostics.md) và [WEB7-02](../evidence/web7/20261120-web7-02-product-shell.md), không kế thừa từ lần lập roadmap.

**Goal:** ứng dụng có navigation, workspace và thao tác nghiệp vụ rõ ràng; Lab tiếp tục phục vụ prototype/focused tests; các control dùng chung có contract nhập liệu và accessibility cụ thể.

**Architecture:** cùng repo và dependency graph; Product và Lab có composition/runtime riêng, dùng chung feature components và UI. Dockview tiếp tục sở hữu layout; feature/runtime tiếp tục sở hữu phiên tài liệu, raw buffers, quyền, mutation và recovery.

**Tech stack:** React/TypeScript/Vite, Tailwind v4, shadcn `base-nova` + Base UI, AG Grid Community, Dockview, Floating UI. Giữ preset và pins đã có; không tạo package UI mới hoặc thay thư viện grid.

**Spec:** [thiết kế WEB7](../design/WEB7_PRODUCT_SHELL_AND_UI_FOUNDATION.md). **Source baseline:** `main` tại `c06b1e97d5a476fd790043f75cd9fa826819e1fb`; [inventory và nguồn tham chiếu](../references/WEB7_SOURCE_BASELINE.md). **Verification:** [acceptance matrix](../development/WEB7_ACCEPTANCE_MATRIX.md), [handoff](../development/WEB7_CODEX_HANDOFF.md), [evidence mới](../evidence/web7/README.md).

**Cho người/agent triển khai:** thực hiện task đã được chọn, theo thứ tự phụ thuộc và một PR có phạm vi rõ ràng. Nếu dùng Superpowers, dùng `subagent-driven-development` hoặc `executing-plans` theo cách triển khai đã chọn; đọc contract và test hiện hữu trước khi sửa. Roadmap này là đầu vào cho triển khai tiếp theo, không yêu cầu tự chạy chín task trong lượt tạo tài liệu.

## 1. Kết quả và phạm vi

| Trục | Kết quả cần có | Điểm hoàn thành |
|---|---|---|
| Product | Sidebar thu gọn, header/breadcrumb, tài khoản/theme; các module và lệnh dùng được với workspace hiện hữu | WEB7-01–03 |
| Shared UI | Field/error, date + calendar, decimal mechanics, lookup/filter/status dùng trong màn hình thật | WEB7-04–07 |
| Lab | Catalog primitives/controls/recipes, scenario có thể mở trực tiếp, kiểm tra hành vi bằng cùng component production | Bổ sung theo từng PR; hoàn thiện WEB7-08 |
| Chất lượng | Regression hành vi nhập liệu, nhiều chứng từ, keyboard/focus, layout/theme và production isolation trên candidate cụ thể | WEB7-09 |

Không đặt mục tiêu port toàn bộ WinFormsKit. Dùng các nhóm chức năng tương ứng để phát hiện nhu cầu: navigation, field/error, date, decimal, lookup, toolbar, feedback, list/edit recipes. Không thêm dashboard giả, settings chưa có chức năng, framework form, design system mới, Storybook/package/monorepo hoặc backend endpoint chỉ để hoàn thành catalog.

### Cùng tồn tại với WEB6

**WEB7 sở hữu giao diện; WEB6 tiếp tục sở hữu recovery/resend, durable-operation contracts và các gate pair/cutover/workload/recovery còn mở.** WEB7 không archive WEB6 và không bật ordinary manual resend. Các task shell/catalog có thể tiến hành độc lập với live acceptance WEB6 nếu giữ nguyên các contract đó.

Tại baseline, WEB6 đã có bounded implementation; [evidence cập nhật 14/11](../evidence/web6/20261110-f04b-measured-quality.md) ghi Chromium/Edge pair PASS, cutover **FAIL / FailedRetained**, workload/recovery **NOT RUN / NOT MEASURED**, `CandidateVerified` absent. Đây là trạng thái của candidate WEB6, không phải kết quả kiểm chứng WEB7. Lỗi protected draft khác epoch cần thiết kế tại owning WEB6 scope; không sửa namespace/filter hoặc giảm assertion để làm UI PASS. [Owning WEB6 plan](20261103-001-web6-recovery-quality-web.md) và [evidence index](../evidence/web6/README.md) vẫn hoạt động; staging NOT ACCEPTED / production NO-GO chưa thay đổi.

## 2. Thứ tự triển khai và trạng thái

Một hàng tương ứng một PR mặc định; có thể tách nhỏ thêm nếu diff khó review, nhưng không gộp mất exit criteria. Không gắn ngày hoàn thành khi chưa có capacity/candidate thực tế.

| Task | Deliverable | Phụ thuộc | Branch gợi ý | Trạng thái |
|---|---|---|---|---|
| [WEB7-01](#web7-01) | Diagnostic UI/shortcut thuộc Lab | Không | `codex/web7-01-lab-diagnostics` | **DONE — PR #46 MERGED** |
| [WEB7-02](#web7-02) | Product Shell theo sidebar-07 | 01 | `codex/web7-02-product-shell` | VERIFIED CODE (CI on `46ac2664`); PR #47 IN_REVIEW |
| [WEB7-03](#web7-03) | Workspace actions theo module/document | 02 | `codex/web7-03-workspace-actions` | PLANNED |
| [WEB7-04](#web7-04) | Shared field, error association và focus | 03 | `codex/web7-04-fields-validation` | PLANNED |
| [WEB7-05](#web7-05) | DateField + calendar | 04 | `codex/web7-05-date-field` | PLANNED |
| [WEB7-06](#web7-06) | Exact decimal input mechanics | 04 | `codex/web7-06-decimal-input` | PLANNED |
| [WEB7-07](#web7-07) | Filters, list/status presentation | 04, 05 | `codex/web7-07-filters-feedback` | PLANNED |
| [WEB7-08](#web7-08) | Catalog và recipes hoàn chỉnh | 01–07 | `codex/web7-08-lab-catalog` | PLANNED |
| [WEB7-09](#web7-09) | Integrated UI acceptance/handoff | 08 | `codex/web7-09-ui-acceptance` | PLANNED |

**M1 — Product shell dùng được:** 01–03. **M2 — Nhập liệu/màn hình dùng shared UI:** 04–07. **M3 — Lab và UI candidate có evidence:** 08–09. Task 05/06 có thể song song sau 04 nếu ownership file rõ ràng; mặc định một người làm theo số thứ tự. Không đợi 08 mới thêm Lab cases cho control được tạo ở 04–07.

## 3. Quy tắc chung cho mỗi task

- [ ] Đối chiếu HEAD với source baseline; ghi thay đổi liên quan, dependency/version thực tế và acceptance IDs thuộc task.
- [ ] Dùng lại component/command/store hiện hữu; chỉ tạo file mới có trách nhiệm riêng. Các đường dẫn ghi “mới” dưới đây là vị trí dự kiến, chưa tồn tại ở baseline.
- [ ] Khi đổi hành vi, thêm hoặc cập nhật test vào đúng boundary có thể phát hiện regression; không test đếm file, snapshot nguyên Tailwind hoặc nhân bản implementation.
- [ ] Thêm scenario Lab tương ứng cùng PR nếu task tạo/sửa shared control; dùng cùng component với product.
- [ ] Chạy typecheck/build và focused tests theo [handoff](../development/WEB7_CODEX_HANDOFF.md); ghi lệnh, commit, browser, số test thực chạy và giới hạn vào WEB7 evidence.
- [ ] Review diff, contract/lifecycle và UX; cập nhật đúng task status. Không ghi DONE chỉ từ screenshot, build xanh hoặc kết quả của candidate cũ.

## WEB7-01

**Diagnostic ownership và nền Lab.** Kết quả: product không còn snapshot/mark debug; `/lab/sales` và `/lab/components` vẫn phục vụ các test hiện có.

**Files:** sửa `src/app/workspace/WorkspaceExtensions.tsx`, `WorkspaceHost.tsx`, `src/features/sales/SalesDocumentPanel.tsx`, `src/lab/runtime/LabProvider.tsx`; thêm `src/lab/WorkspaceDiagnostics.tsx` và `src/lab/SalesSnapshotDiagnostics.tsx` nếu cần tách trách nhiệm. Giữ `src/lab/routes.tsx`, `src/app/router.tsx`, `vite.config.ts` làm boundary DEV/build.

- [x] Thêm extension slot tối thiểu cho diagnostic document và keyboard registration; default rỗng. Production/feature không import `src/lab` hoặc fake adapters.
- [x] Chuyển nút **Đánh dấu phiên**, **Ctrl+Alt+M**, **Kiểm tra snapshot**, snapshot message/JSON vào Lab implementations. Giữ Ctrl+Alt+W và close admission ở product.
- [x] Giữ oracle `prepared-snapshot` và mark tại Lab, cùng các scenario/harness đã dùng; snapshot vẫn đi qua prepare/barrier thực của feature.
- [x] Cập nhật focused selectors nếu composition thay đổi; không bỏ assertion last keystroke/invalid raw/IME/unmounted buffer để tránh lỗi test.

**Verify:** mới `tests/e2e/web7-diagnostics.spec.ts`; các suite hiện hữu `tests/e2e/sales-editing.spec.ts`, `review-ui.spec.ts`, `review-round4.spec.ts`, `workspace.spec.ts`, `web3-workspace.spec.ts`; `tests/production/runtimeIsolation.spec.ts` và `tests/e2e/runtimeIsolation.spec.ts`. Assert cả absence diagnostic UI/shortcut trong product và presence/behavior trong Lab; production build vẫn loại Lab/fake graph.

**Checkpoint thực thi (2026-11-20):** [PR #46](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/46), implementation commit `80a9c52cc5cb1d274e4a5558e00c5308059051a2`; các source/selector/oracle trong checklist đã được thay đổi, không đổi dependency/backend. **Final disposition:** PR #46 MERGED 2026-11-20 (squash `e6c822aa`); source HEAD `e4c2a9d7` đạt unit 1.797 PASS / 1 SKIP, Chromium 290/290, artifact 3/3. Xem [evidence WEB7-01](../evidence/web7/20261120-web7-01-lab-diagnostics.md).

**Exit:** diagnostic chỉ do Lab cấp; product giữ mọi command nghiệp vụ/recovery; các oracle cũ còn chứng minh cùng hành vi.

## WEB7-02

**Product Shell trên Nova + Base UI.** Kết quả: `/` sau đăng nhập có sidebar/header/footer tài khoản và workspace thật; Lab có entry DEV rõ ràng.

**Files:** mới `src/app/shell/ProductShell.tsx`, `ProductSidebar.tsx`, `ProductHeader.tsx`, `AccountMenu.tsx`, `moduleNavigation.ts`; sửa `src/app/App.tsx`, `src/app/runtime/ApplicationEntry.tsx`, `src/app/workspace/ProductionWorkspace.tsx`; thêm các primitive shadcn cần dùng dưới `src/components/ui/`. Chỉ sửa `src/index.css` nếu thực sự thiếu layout token/rule; không tái tạo preset.

- [x] Kiểm tra generator pin và API Base UI đang cài; lấy cấu trúc sidebar-07, generate/adapt các primitive cần thiết bằng config `base-nova`. Ghi generated source/dependency diff; không paste nguyên New York/Radix `asChild` sang Base.
- [x] Hiện Bán hàng, Phiếu nhập, Tồn kho, Thẻ kho theo capability. Menu module gọi `workspace.openPanel`; chọn lại kích hoạt panel có sẵn. Header/breadcrumb phản ánh panel đang focus.
- [x] Đưa tên tài khoản/logout và Light/Dark vào shell qua callback/context hiện hữu. Login/reauth nằm ngoài authenticated shell; giữ route `/` và DEV dynamic import Lab.
- [x] Giữ `ApplicationEntry` registry và `createConfiguredProductionRuntime`; shell không tạo runtime, không key theo menu/theme, chỉ mount một `WorkspaceHost` cho product. Sidebar desktop/mobile dùng chung workspace.
- [x] Kiểm tra collapsed icons/accessible names, drawer, Tab/Escape/return focus, layout co giãn và portal trong vùng Dockview. Action toolbar hiện hữu vẫn dùng được cho đến 03.

**Verify:** mới `tests/components/ProductShell.test.tsx`, `tests/e2e/product-shell.spec.ts`; hiện hữu `tests/components/ApplicationEntry.test.tsx`, `tests/components/sales/runtimeInjection.test.tsx`, `tests/unit/http/web6CandidateConfig.test.ts`, `tests/e2e/foundation.spec.ts`, production isolation. Assert cùng session/raw/line identity khi đổi menu/theme/sidebar, capability denied không mở panel, runtime factory không gọi lại do chrome state.

**Checkpoint thực thi (2026-11-20):** [PR #47](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/47) source SHA `46ac2664418d44cf93de1baffe6d454585100620` đã đạt 1.799 unit/component PASS + 1 SKIP, 293/293 Chromium, 3/3 artifact trên [PR CI](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44731629740). Bổ sung shell, nav theo quyền, header/breadcrumb, mobile drawer, actor/logout/theme và DEV Lab links. Existing `WorkspaceHost` toolbar giữ tới 03, không sửa backend/WEB6. Adapter Menu được viết cho Base UI `1.9.0` đã pin và Nova tokens; **không chạy shadcn generator/registry mới**, không đổi lock. Xem [evidence](../evidence/web7/20261120-web7-02-product-shell.md). Docs HEAD mới yêu cầu xác nhận CI riêng trước merge; task chưa chuyển DONE ở checkpoint này.

**Exit:** shell đủ chức năng điều hướng và tài khoản; không còn demo rectangles/menu chưa thực hiện; Nova, auth boundary, runtime và workspace được giữ.

## WEB7-03

**Workspace actions theo ngữ cảnh.** Kết quả: thao tác mở module, tạo chứng từ, tài liệu, bố cục và bản nháp ở vị trí nhất quán, không còn dãy nút pilot hỗn hợp.

**Files:** mới `src/app/workspace/WorkspaceActions.tsx`; sửa `WorkspaceHost.tsx`, `ProductionWorkspace.tsx`, `src/app/shell/ProductHeader.tsx` và `moduleNavigation.ts`. Chỉ chỉnh presentation `LocalDraftControls.tsx`/`RecoverySupport.tsx` nếu cần; `panelRegistry.ts`, `commandRouter.ts`, `moduleCapabilities.ts` là contract tham chiếu, không viết lại.

- [ ] Phân vị trí theo [command placement](../design/WEB7_PRODUCT_SHELL_AND_UI_FOUNDATION.md#commands): sidebar mở module; menu Tạo chứng từ ở header theo Write grant độc lập Read/active panel, toolbar ngữ cảnh có shortcut nếu cần; Save/Post ở document; menu workspace cho split/close/layout; entry bản nháp ổn định. User có Write nhưng không Read vẫn tạo được Sales/Receipt từ empty workspace hoặc Inventory, không mở/gọi list trước.
- [ ] Derive target từ `panelState.activeId` và module thực, capture identity trước async. Inventory không được rơi vào lệnh Sales mặc định. Giữ write/read/post/busy guards trong handler, không dựa riêng vào disabled UI.
- [ ] Mọi close/reset/restore/logout dùng admission hiện hữu; di chuyển tab không dispose document. Giữ restore-failure/remount semantics.
- [ ] Nếu dialog được mở từ menu/drawer đã đóng, đặt return-focus fallback vào trigger workspace còn mounted. Giữ một popup owner, initial Cancel và nested confirmation của recovery.
- [ ] Kiểm tra pending/unknown chỉ khóa đúng chứng từ; không khóa toàn app bằng overlay mới. Tách rõ retry local persistence, check result và manual resend trong tên/action.

**Verify:** mới `tests/components/WorkspaceActions.test.tsx`, `tests/e2e/product-workspace-actions.spec.ts`; `tests/unit/workspace/multiModuleRuntime.test.ts`, `multiModuleClose.test.ts`, `restoreCapabilities.test.ts`, `layoutRuntime.test.ts`, `epochPropagation.test.ts`; `tests/e2e/layout-restore.spec.ts`, `durableDraftWorkspace.spec.ts`, `web4RecoveryWorkspace.spec.ts`, `web6ManualResendDialog.spec.ts`; `tests/components/Web6AuthRecoveryBoundary.test.tsx` và `RecoverySupport.test.tsx` nếu sửa presentation tương ứng.

**Exit:** hai nhóm Dockview có focus/commands đúng module; Write-only user vẫn có entry tạo mới, không phát list request; Cancel/invalid Save/pending/unknown không mất phiên; gate WEB6 và số lần transmission không thay đổi.

## WEB7-04

**Field và validation presentation.** Kết quả: Sales và Receipt có label/helper/error thống nhất, liên kết lỗi truy cập được và focus đúng trường/dòng.

**Files:** thêm primitive `src/components/ui/field.tsx` theo generator; mới `src/shared/forms/DocumentField.tsx`, `fieldIdentity.ts`, `ValidationSummary.tsx` khi hai consumer cần chung; sửa `SalesHeaderForm.tsx`, `SalesFeedback.tsx`, `GoodsReceiptHeaderForm.tsx`, `GoodsReceiptFeedback.tsx`, `src/features/goodsReceipt/fieldErrors.ts`. Feature paths đều ở `src/features/`.

- [ ] Chốt IDs từ module + documentSessionId + field hoặc clientLineId; giữ ổn định khi sort/move, không dùng index/Product ID/server ID đơn độc.
- [ ] Compose label, description, required, `aria-invalid`/`aria-describedby`; không thêm local form store mirror. Feature tiếp tục quyết định editable/validation và publish raw/composition.
- [ ] Error summary dùng issue list thực và callback feature để focus field/AG Grid row; first invalid focus sau validation thất bại, không cướp focus mỗi keystroke. Lookup tiếp tục sở hữu label/input/popup, tránh nested label/duplicated IDs.
- [ ] Dùng ngay trong cả Sales và Receipt; thêm Lab states normal/required/invalid/disabled/read-only/helper, hai chứng từ đồng thời và dòng đã sort.

**Verify:** mới `tests/components/fields/DocumentField.test.tsx`, `tests/e2e/form-validation.spec.ts`; mở rộng `tests/components/goodsReceipt/header.test.tsx`, thêm `tests/components/sales/header.test.tsx`; focused Sales/Receipt browser flows. Assert accessible name/description, IDs duy nhất, focus theo clientLineId sau virtualization, validation không mutate draft ngoài barrier.

**Exit:** cùng contract trình bày lỗi ở ít nhất hai feature; không hợp nhất business validators hoặc tạo form framework.

## WEB7-05

**DateField + calendar.** Kết quả: ngày chứng từ nhập bằng text hoặc lịch, giữ raw/canonical `yyyy-MM-dd` và hành vi lưu hiện hữu.

**Files:** mới `src/shared/inputs/DateField.tsx`, `dateOnly.ts`; generate `src/components/ui/popover.tsx`/`calendar.tsx` và dependency pin được review; sửa hai HeaderForm, date filter trong `src/features/sales/SalesListPanel.tsx` khi contract phù hợp. Validators feature chỉ được gọi lại/refactor tương đương, không đổi rule nghiệp vụ.

- [ ] Đọc installed types/generated calendar; ghi chính xác package/version được thêm. Baseline chưa có DayPicker/date-fns; không mặc định package/major hiện trên live docs tương thích.
- [ ] Controlled raw/composition do caller sở hữu; parser phân biệt empty/incomplete/invalid/valid. Gõ `2026-`, ngày không tồn tại hoặc clear không bị tự sửa/mất khi blur, đổi panel hay reload draft.
- [ ] Calendar chỉ publish ngày chọn `yyyy-MM-dd` vào cùng editing path; không tự Save/Post. Không parse date-only qua `Date.parse`, `toISOString` hoặc UTC round trip. UI `Date` nếu thư viện cần chỉ ở boundary với year/month/day.
- [ ] Bounds/required/nullability thuộc caller; Receipt vẫn từ chối `0001-01-01` theo validator riêng. V1 không thêm grammar dd/MM/yyyy, ngày tương đối, range/multiple selection.
- [ ] Định nghĩa focus mở/chọn/Escape/outside, keyboard trong calendar không chạy workspace commands; bảo vệ composition. Thêm Lab cases leap day, invalid/partial, bounds và popup trong document panel.

**Verify:** mới `tests/unit/inputs/dateOnly.test.ts`, `tests/components/inputs/DateField.test.tsx`, `tests/e2e/date-field.spec.ts`; `tests/unit/sales/validation.test.ts`, `tests/unit/goodsReceipt/editing.test.ts`, focused header/editing specs. Assert timezone-independent canonical string và invalid raw survives remount. Inventory UTC filters không dùng DateField.

**Exit:** date control dùng thật trong Sales/Receipt, calendar và text đồng bộ với cùng store, legacy raw ISO không cần migration.

## WEB7-06

**Exact decimal input mechanics.** Kết quả: giảm lặp input/IME/Escape giữa grid Sales và Receipt bằng adapter có contract chung.

**Files:** mới `src/shared/inputs/DecimalInput.tsx` và helper nhỏ nếu cần; sửa `src/shared/grid/DecimalCellEditor.tsx`, `src/features/goodsReceipt/GoodsReceiptEditors.tsx`. Tham chiếu `src/shared/grid/editorBarrier.ts`, feature `decimal.ts`, `sessionEditing.ts`, session stores; không chuyển domain store vào shared component.

- [ ] Tách presentation/raw change/composition/ref/focus khỏi feature adapter. Props nhận raw string, disabled/accessibility, callbacks raw+composing và Escape; consumer sở hữu validate/commit/restore.
- [ ] Giữ original editor binding được capture khi mount, kể cả AG Grid refresh thiếu custom params; giữ entry raw để Escape restore. Không dùng blur/local state làm nguồn duy nhất cho Save.
- [ ] Giữ exact string/BigInt, comma hoặc dot hiện hữu, scale/overflow/nullability và 64-character bound của Receipt. Không dùng floating point, tự rounding, format grouping lúc gõ hoặc caret jump.
- [ ] Dùng cùng shared input trong hai feature adapters; Lab có field/editor examples, giá trị dài, incomplete/invalid, last keystroke và IME.

**Verify:** mới `tests/components/inputs/DecimalInput.test.tsx`; `tests/unit/grid/editorBarrier.test.ts`, `tests/unit/sales/decimal.test.ts`, `tests/unit/goodsReceipt/decimal.test.ts`, `editing.test.ts`; `tests/e2e/sales-editing.spec.ts`, `review-round4.spec.ts`, `web3-receipt.spec.ts`. Assert giá trị chính xác, Escape, barrier/flush unmounted, stable line ID sau sort/virtualization; Sales cho phép cùng product nhiều dòng, Receipt tiếp tục chặn duplicate.

**Exit:** chia sẻ cơ chế nhập liệu có hai consumer, không thay validators/arithmetic/lifecycle của từng nghiệp vụ.

## WEB7-07

**Filters, danh sách và feedback theo vùng.** Kết quả: bộ lọc Sales chọn được tên/mã thực; Sales/Receipt/Inventory có state/action layout dễ hiểu và đúng query contract.

**Files:** sửa `src/features/sales/SalesListPanel.tsx`, `src/features/goodsReceipt/GoodsReceiptListPanel.tsx`, `src/features/inventory/InventoryReadPanel.tsx`, feature feedback; mới `src/shared/feedback/ReadState.tsx`, `src/shared/layout/FilterBar.tsx` nếu có ít nhất hai consumer. Reuse `src/shared/lookup/ProductLookup.tsx` và catalog port; chỉ mở rộng adapter tại nơi cần, không thêm lookup engine.

- [ ] Thay Customer/Warehouse/Employee/Product ID filter thô của Sales bằng lookup optional; chỉ selected/confirmed ID đi vào query. Clear bỏ filter; query text/highlight chưa commit không thay ID.
- [ ] Giữ Sales cursor pagination; thay filter reset cursor. Receipt/Inventory giữ page-number/totalCount; filter/page-size đổi reset page 1. Không ép vào một pagination DTO.
- [ ] Stock Card yêu cầu warehouse + product đã commit; Stock Balances vẫn optional. UTC range giữ chuỗi `yyyy-MM-ddTHH:mm:ss[.fffffff]Z`, từ ≤ đến, phần lẻ tùy chọn 1–7 chữ số được bảo toàn, không ép đủ bảy hoặc truncate; thêm helper/error presentation, không reinterpret thành date range/local time.
- [ ] Trình bày distinct initial/loading/empty/no-match/error/forbidden và mutation pending/unknown. Shared component nhận state/actions từ caller; chỉ read retry nếu caller cung cấp, không tự retry mutation, unlock hoặc báo rollback.
- [ ] Giữ query actor/epoch/generation, stale-result fences và cache hiding khi revoke; giữ filter draft/raw riêng với applied query khi cần. Feedback lỗi quan trọng ở document, không chỉ toast tự biến mất.
- [ ] Dùng presentation ở ít nhất hai màn hình; thêm Lab cases latency/error/empty/forbidden và đổi filter khi request cũ chưa về.

**Verify:** `tests/components/SalesListEpoch.test.tsx`, `tests/components/lookup/ProductLookup.test.tsx`, `tests/unit/lookup/lookupState.test.ts`, `tests/unit/inventory/queries.test.ts`, `tests/unit/http/web3WireSchemas.test.ts`, `tests/e2e/sales-list-layout.spec.ts`, `web3-inventory.spec.ts`, `web3-receipt.spec.ts`; mới `tests/components/feedback/ReadState.test.tsx` nếu tạo component. Assert query payload chính xác, reset pagination, hidden stale rows và zero unintended write.

**Exit:** không cần người dùng nhập raw ID ở bộ lọc Sales; query/paging/time contracts và recovery semantics được giữ.

## WEB7-08

**UI Lab catalog và recipes.** Kết quả: Lab dùng được để tra cứu control, thử state và kiểm tra composition với feature thật.

**Files:** mới `src/lab/LabShell.tsx`, `catalog/catalogEntries.ts`, `catalog/ControlExample.tsx`, `recipes/FilterResultsRecipe.tsx`, `recipes/DocumentEditRecipe.tsx`, `GoodsReceiptLab.tsx`, `InventoryLab.tsx`; sửa `ComponentsLab.tsx`, `routes.tsx`, `runtime/LabProvider.tsx`, `runtime/createLabWorkspaceRuntime.ts`. Reuse fake adapters hiện có, thêm fixture/adapter hẹp ở `src/infrastructure/fake/` khi còn thiếu.

- [ ] Catalog ba nhóm primitives, controls, recipes; mỗi entry có mục đích, consumer thật, state controls, keyboard/validation notes và test liên quan. Component chưa tồn tại ghi planned, không dựng façade giả đủ parity.
- [ ] Giữ `/lab/sales` và `/lab/components`/scenario cũ; thêm route `/lab/receipts`, `/lab/inventory` và deep link catalog theo allowlist. Scenario không tự remount/discard phiên dirty đang giữ; reset là thao tác rõ ràng qua admission phù hợp.
- [ ] Thể hiện DateField, DecimalInput, ProductLookup field/cell, DocumentField/summary, read states, toolbar/dialog/layout; hoàn thiện cases đã thêm ở 04–07.
- [ ] Recipes filter+results và edit document dùng cùng feature compositions, fake ports deterministically chọn loading/empty/error/permission/latency. ReceiptLab dùng real GoodsReceipt components, không coi `receiptWorkspaceStub.ts` là implementation nghiệp vụ.
- [ ] Giữ Lab auth/runtime/query cache/draft storage tách production; Lab navigation không tạo HTTP fallback hay bật candidate env. Preserve retained Lab workspace/beforeunload và existing harnesses.

**Verify:** mới `tests/e2e/ui-lab-catalog.spec.ts`; `tests/e2e/runtimeIsolation.spec.ts`, `lookup-grid.spec.ts`, `tests/unit/workspace/labAuthSnapshot.test.ts`, production artifact isolation. Assert deep links/unknown scenario, state transitions, same shared component behavior và không request production API. Test real Dockview/AG Grid/portal trong recipe.

**Exit:** developer có thể mở một control hoặc recipe, chọn state và chạy focused test tương ứng; product bundle không chứa Lab/fake imports.

## WEB7-09

**Integrated UI acceptance và handoff.** Kết quả: một candidate WEB7 có evidence rõ phạm vi, đủ cho quyết định UI tiếp theo.

**Files:** hoàn thiện `docs/evidence/web7/` với evidence theo candidate, cập nhật plan status, acceptance/handoff/source baseline nếu có quyết định mới; chỉ sửa `src/`/`tests/` để xử lý lỗi tích hợp đã quan sát, ghi task sở hữu và regression case.

- [ ] Ghi commit/lock/runtime/browser/build và cấu hình feature thực; rà lại toàn bộ acceptance matrix, phân biệt PASS/FAIL/BLOCKED/NOT RUN/NOT APPLICABLE có lý do.
- [ ] Chạy flows Sales tạo/sửa/Save/Post, Receipt tạo/sửa/Save/Post, Inventory reads bằng fixtures đúng contract; nhiều tab/split, dirty/invalid/raw, close/reset/restore/logout, auth/epoch thay đổi, recovery dialogs. Ghi đây là frontend mocked scope khi không có backend thật.
- [ ] Kiểm tra layout 1440×900 và 1280×720, narrow shell, Light/Dark, keyboard/focus, popup cạnh panel và real browser zoom 125%/200%. Native Edge trên Windows và attended Telex/VNI/Narrator cần ghi thực chạy; không suy từ Chromium hoặc synthetic events.
- [ ] Build production và chạy isolation trên built assets, không chỉ Vite DEV. Chạy required CI hiện hữu; không nới gate vì đổi markup.
- [ ] Review độc lập UI/behavior; khép lỗi thuộc scope, cập nhật hướng dẫn mở Product/Lab và control catalog. Giữ WEB6 release/candidate decisions ở tài liệu sở hữu.

**Verify:** các suite liên quan đã map ở acceptance; command bundles trong handoff. Không cần chạy lại SQL/live pilot chỉ để đổi catalog; nếu yêu cầu nghiệm thu thật thì chọn candidate/runbook/gates của owning scope và ghi evidence riêng.

**Exit:** mọi gate bắt buộc có evidence của candidate mới hoặc limitation cụ thể được trình bày để quyết định; không còn blocker mất dữ liệu, sai target/quyền, write ngoài ý muốn, popup/focus hoặc production isolation. “UI acceptance” không đồng nghĩa staging/production GO; roadmap chỉ archive khi Owner yêu cầu.

## 4. Review và quản lý thay đổi

Review ưu tiên: lifecycle/session identity; commands/grants; raw/decimal/date/IME; popup/focus; fake/HTTP isolation; generated Base/Nova compatibility; rồi mới layout/visual polish. Mọi thay đổi chính sách ngày/số, backend contract, recovery/epoch/CAS, enabled resend, grid engine hoặc design preset phải được ghi thành thay đổi phạm vi cụ thể; không ẩn trong PR giao diện.

Tài liệu sở hữu: plan giữ queue/status/dependencies; design giữ quyết định và component contract; acceptance giữ assertions; handoff giữ workflow/lệnh; source baseline giữ provenance; evidence giữ kết quả thực. Không sao chép toàn bộ spec vào từng PR, không ghi test tương lai thành PASS.

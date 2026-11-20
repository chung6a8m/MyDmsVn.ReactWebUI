# WEB7 — Nguồn khảo sát Product Shell, UI Lab và shared controls

**Ngày khảo sát:** 2026-11-20. **Frontend main:** `c06b1e97d5a476fd790043f75cd9fa826819e1fb`.
**Trạng thái tài liệu:** DOCS ONLY; ghi nhận source và quyết định phạm vi, không chứng nhận runtime hoặc nghiệm thu WEB7.
Tài liệu sở hữu: [roadmap WEB7](../plans/20261120-001-web7-product-shell-ui-lab.md), [thiết kế WEB7](../design/WEB7_PRODUCT_SHELL_AND_UI_FOUNDATION.md), [acceptance WEB7](../development/WEB7_ACCEPTANCE_MATRIX.md).

## 1. Cách đọc bằng chứng

Các đường dẫn trong bảng hiện trạng dưới đây tồn tại tại baseline; mô tả được đối chiếu source.
Tên component và hạng mục WEB7 ở mục 5 là đề xuất triển khai, không phải file hoặc API đã có.
Manifest/lockfile và mã/type của dependency được cài là căn cứ compatibility; tài liệu trực tuyến chỉ hỗ trợ khảo sát.
[Technical baseline](TECHNICAL_BASELINE.md) giữ lịch sử generator và các lần kiểm tra package trước WEB7; không sửa lại bằng chứng lịch sử.

## 2. Source frontend hiện có

| Phạm vi | Source tại baseline | Dữ kiện liên quan WEB7 |
| --- | --- | --- |
| Khung ứng dụng | [App.tsx](../../src/app/App.tsx) | Header, điều hướng ứng dụng/Lab và nút Light/Dark; chưa có Product Shell theo sidebar-07. |
| Router | [router.tsx](../../src/app/router.tsx) | Route `/` dùng ApplicationEntry; import động routes Lab nằm trong nhánh DEV. |
| Auth và runtime entry | [ApplicationEntry.tsx](../../src/app/runtime/ApplicationEntry.tsx) | Tạo runtime theo auth/actor/generation/epoch; logout đi qua close admission. |
| Factory thực tế | [web6CandidateConfig.ts](../../src/app/runtime/web6CandidateConfig.ts) | `createConfiguredProductionRuntime` đọc cấu hình candidate rồi gọi `createProductionRuntime`; không bỏ qua wrapper này khi đổi shell. |
| Production composition | [ProductionWorkspace.tsx](../../src/app/workspace/ProductionWorkspace.tsx) | Gắn Sales, Goods Receipt, Stock Balances/Stock Card và local drafts vào WorkspaceHost. |
| Dockview và lệnh workspace | [WorkspaceHost.tsx](../../src/app/workspace/WorkspaceHost.tsx) | Toolbar đang chứa nhiều lệnh, gồm “Đánh dấu phiên”; shell mới phải giữ đường command/admission. |
| Session và layout | [workspaceController.ts](../../src/app/workspace/workspaceController.ts), [workspaceLayouts.ts](../../src/app/workspace/workspaceLayouts.ts) | Ranh giới document/session và thao tác layout cần được bảo toàn. |
| Primitive đã sinh | [Button](../../src/components/ui/button.tsx), [Dialog](../../src/components/ui/dialog.tsx), [Input](../../src/components/ui/input.tsx), [NativeSelect](../../src/components/ui/native-select.tsx) | Đây là bốn file UI primitive đang có, không phải bộ catalog đầy đủ. |
| Lookup dùng chung | [ProductLookup.tsx](../../src/shared/lookup/ProductLookup.tsx), [useProductLookup.ts](../../src/shared/lookup/useProductLookup.ts) | Control/logic lookup hiện hữu; Floating UI tiếp tục sở hữu popup. |
| Adapter grid | [DecimalCellEditor.tsx](../../src/shared/grid/DecimalCellEditor.tsx), [ProductLookupCellEditor.tsx](../../src/shared/grid/ProductLookupCellEditor.tsx) | Tái sử dụng hợp đồng raw buffer/editor; không thay bằng editor làm mất dữ liệu đang nhập. |
| Ngày chứng từ Sales | [SalesHeaderForm.tsx](../../src/features/sales/SalesHeaderForm.tsx) | Input `yyyy-MM-dd` đọc raw trước draft và công bố composition vào session. |
| Ngày phiếu nhập | [GoodsReceiptHeaderForm.tsx](../../src/features/goodsReceipt/GoodsReceiptHeaderForm.tsx) | Input ngày có raw buffer/composition riêng của Goods Receipt. |
| Timestamp Inventory | [InventoryReadPanel.tsx](../../src/features/inventory/InventoryReadPanel.tsx), [inventoryQueries.ts](../../src/features/inventory/inventoryQueries.ts) | `fromUtc/toUtc` là timestamp UTC; không phải ngày chứng từ. |
| Hợp đồng ngày/thời gian | [web3WireSchemas.ts](../../src/infrastructure/http/web3WireSchemas.ts) | Phân biệt `web3Date`, `web3Utc`; `utcOrder` giữ so sánh phần lẻ tới bảy chữ số. |
| Lab và scenario | [routes.tsx](../../src/lab/routes.tsx), [ComponentsLab.tsx](../../src/lab/ComponentsLab.tsx) | Lab có route/scenario thực; chưa tương đương catalog các họ control được đề xuất. |
| Runtime Lab | [createLabWorkspaceRuntime.ts](../../src/lab/runtime/createLabWorkspaceRuntime.ts) | Dùng fake ports/scenario; phải tiếp tục tách khỏi runtime production. |

Không suy “đã chạy API thật” từ việc ProductionWorkspace hoặc HTTP adapters có mặt trong cây source.
Không chuyển session/draft/auth vào sidebar hoặc Dockview; Dockview vẫn quản lý layout.

## 3. Dependency và generator đã pin

Đối chiếu trực tiếp [package.json](../../package.json), [package-lock.json](../../package-lock.json) và [components.json](../../components.json):

| Nhóm | Pin thực tế |
| --- | --- |
| React / ReactDOM | `19.3.1` / `19.3.1` |
| TypeScript / Vite | `5.9.3` / `8.3.5` |
| shadcn CLI / Base UI | `4.23.0` / `@base-ui/react 1.9.0` |
| Tailwind / Vite plugin | `4.3.3` / `@tailwindcss/vite 4.3.3` |
| AG Grid Community / React | `36.2.0` / `36.2.0` |
| Dockview / React adapter | `8.8.2` / `8.8.2` |
| Floating UI React | `0.27.20` |
| TanStack Router / Query | `1.170.46` / `5.105.0` |
| React Hook Form / Zod / Zustand | `7.91.0` / `4.6.7` / `5.0.16` |

Preset hiện tại là `base-nova`, neutral, Lucide, CSS variables, `rsc: false`, CSS tại `src/index.css`.
`react-day-picker` và `date-fns` chưa có trong lockfile; Sidebar, Field, Calendar, Popover chưa có trong bốn primitive trên.
Khi triển khai, dùng CLI local đã pin, xem diff source/dependency, chốt exact version mới và kiểm tra type/bundle thực tế.
Pin CLI không đóng băng nội dung registry từ xa; phải ghi nhận source sinh ra và dependency lock của candidate triển khai.
Không chạy lại init/apply preset hoặc nâng major chỉ để khớp ví dụ mới trên website.

## 4. Nguồn chính thức đã đọc ngày 2026-11-20

| Nguồn | Điều nguồn hỗ trợ; giới hạn sử dụng |
| --- | --- |
| [Preview sidebar-07 theo yêu cầu](https://ui.shadcn.com/view/new-york-v4/sidebar-07) | Mốc tham chiếu bố cục và cách phân cấp điều hướng; không là ảnh chụp app hiện tại. |
| [Registry source sidebar-07](https://ui.shadcn.com/r/styles/new-york-v4/sidebar-07.json) | Sidebar thu về icon, nhóm navigation, context/account menu, header/breadcrumb; body chỉ là placeholder. |
| [Base Sidebar](https://ui.shadcn.com/docs/components/base/sidebar) | Composition qua provider, header/content/footer, trigger và trạng thái desktop/mobile; API phải đối chiếu bản cài. |
| [Nova/style introduction](https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create), [theming](https://ui.shadcn.com/docs/theming) | Nova có lựa chọn spacing/structure riêng; theme dùng semantic tokens. Không lấy CSS New York đè Nova. |
| [Base Field](https://ui.shadcn.com/docs/components/base/field) | Field/Label/Description/Error và grouping; `data-invalid` trên field, `aria-invalid` trên control. |
| [Base Calendar](https://ui.shadcn.com/docs/components/base/calendar), [Date Picker](https://ui.shadcn.com/docs/components/base/date-picker) | Calendar chọn ngày; date picker ghép Popover + Calendar, không có DatePicker root độc lập. |
| [DayPicker input](https://daypicker.dev/guides/input-fields), [accessibility](https://daypicker.dev/guides/accessibility) | Đồng bộ text/calendar và cơ chế keyboard/focus; tài liệu hiện tại không chứng minh API của dependency chưa cài. |
| [HTML date](https://html.spec.whatwg.org/multipage/input.html#date-state-(type=date)), [datetime-local](https://html.spec.whatwg.org/multipage/input.html#local-date-and-time-state-(type=datetime-local)) | Native date có value sanitization; datetime-local không mang timezone offset. |

Source New York-v4 có chi tiết Radix như `asChild`; ví dụ Base hiện tại dùng composition `render`.
Chọn lại composition phù hợp Base/Nova, không sao chép nguyên bộ primitive New York hoặc đổi primitive library.
Có drift cần chú ý: trang shadcn Calendar còn mô tả `react-day-picker`, trong khi guide DayPicker hiện tại dùng `@daypicker/react` và hướng dẫn v10.
Đây là cảnh báo xác minh dependency, không phải quyết định cài v10, đổi package hoặc chuyển React Aria.
Không có kết luận compatibility của CLI 4.23.0/Base UI 1.9.0 chỉ từ ngày cập nhật của tài liệu trực tuyến.

## 5. Quyết định WEB7 và phần chưa triển khai

Product Shell, catalog theo họ component và DateField v1 là các hạng mục dự kiến; vị trí file mới do thiết kế/roadmap WEB7 sở hữu.
Tại baseline chưa có shared `DateField` hoặc `ProductShell`; không biến tên dự kiến thành bằng chứng “đã có”.

### DateField v1

- Giữ grammar nhập và canonical hợp lệ `yyyy-MM-dd`; raw text có thể chưa hoàn chỉnh hoặc sai ngày.
- Thêm calendar vào cùng control; calendar `Date` chỉ là giá trị tại biên UI, không đổi kiểu ngày trong draft/wire.
- Giữ raw/composition, dirty, lỗi field và save barrier của từng module; không ép text lỗi thành rỗng hoặc tự chọn hôm nay.
- Không thêm grammar `dd/MM/yyyy`, không đổi locale parsing hoặc timezone policy trong v1.
- Không đổi `fromUtc/toUtc` thành khoảng ngày; giữ `yyyy-MM-ddTHH:mm:ss[.fffffff]Z`, precision và so sánh hiện hữu.
- Định nghĩa/kiểm chứng Arrow, Home/End, PageUp/PageDown, Enter/Space, Tab, Escape và focus return trong panel thực.
- Một popup có một chủ positioning/focus/dismiss; key của calendar không được vô tình đóng document hoặc chạy command khác.

### Catalog và tương đương chức năng

Catalog phải dùng cùng component có ích cho product: field/error, ngày, lookup, decimal editor, feedback và command composition.
Tái sử dụng primitive đủ hợp đồng; chỉ thêm adapter có nhu cầu nghiệp vụ, không bọc lại mọi Button/Input hoặc dựng package/framework UI tổng quát.
Giữ Lab/scenario để prototype và kiểm tra tập trung; fake ports, state, persistence và debug controls không trở thành production fallback.
Giữ AG Grid Community, Dockview, Floating UI và Nova/Base UI; không có scope chuyển grid, Enterprise hoặc React Aria.

Tham chiếu WinFormsKit là [snapshot audit lịch sử `5056704527c3ac19d7dc0518e8f75e482177ad0f`](https://github.com/chung6a8m/MyDmsVn.WinFormsKit/commit/5056704527c3ac19d7dc0518e8f75e482177ad0f), không phải xác nhận HEAD ngày 20/11.
Audit đó khảo sát `src/MyDmsVn.Bootstrap5WinFormUI/Controls/`, `src/MyDmsVn.BootstrapSourceGrid/Editors/`, `samples/ControlGallery/`.
[Composition recipes tại pin](https://github.com/chung6a8m/MyDmsVn.WinFormsKit/blob/5056704527c3ac19d7dc0518e8f75e482177ad0f/docs/guides/UI_COMPOSITION_RECIPES.md) ghi UIC01/CompositionListDemoForm và UIC02/CompositionEditDemoForm đã hiện hữu; UIC03/EditableLines và UIC04/MasterDetail mới PLANNED.
Dùng các họ chức năng làm đối chiếu trong thiết kế WEB7; không port control C# hoặc suy roadmap WinForms đã hoàn tất.

## 6. Điểm kiểm tra hồi quy hiện có

Các file sau là điểm bắt đầu chọn regression theo boundary; việc liệt kê không có nghĩa đã chạy trong WEB7.

| Boundary | Test source hiện hữu |
| --- | --- |
| Auth entry/runtime | [ApplicationEntry.test.tsx](../../tests/components/ApplicationEntry.test.tsx), [web6CandidateConfig.test.ts](../../tests/unit/http/web6CandidateConfig.test.ts) |
| Lab/runtime isolation | [runtimeIsolation.spec.ts](../../tests/e2e/runtimeIsolation.spec.ts), [labAuthSnapshot.test.ts](../../tests/unit/workspace/labAuthSnapshot.test.ts) |
| Document close/layout | [workspace.spec.ts](../../tests/e2e/workspace.spec.ts), [layout-restore.spec.ts](../../tests/e2e/layout-restore.spec.ts) |
| Lookup/editor | [lookup-grid.spec.ts](../../tests/e2e/lookup-grid.spec.ts), [sales-editing.spec.ts](../../tests/e2e/sales-editing.spec.ts) |
| Receipt/header | [header.test.tsx](../../tests/components/goodsReceipt/header.test.tsx), [web3-receipt.spec.ts](../../tests/e2e/web3-receipt.spec.ts) |
| Inventory/date wire | [queries.test.ts](../../tests/unit/inventory/queries.test.ts), [web3WireSchemas.test.ts](../../tests/unit/http/web3WireSchemas.test.ts) |
| Theme/zoom | [foundation.spec.ts](../../tests/e2e/foundation.spec.ts), [workspace-zoom.spec.ts](../../tests/e2e/workspace-zoom.spec.ts) |

Test mới cho Product Shell/catalog/DateField chỉ là kế hoạch trong acceptance WEB7; không thay bằng test đếm file hoặc khóa chuỗi Tailwind.

## 7. WEB6 còn mở và giới hạn báo cáo

[WEB6 F04b evidence cập nhật 14/11](../evidence/web6/20261110-f04b-measured-quality.md) là mốc trạng thái live gần nhất được đọc.
Chromium pair và Edge pair PASS; cutover FAIL/FailedRetained ở ca Chromium thứ ba sau restoreEpoch; Edge cutover NOT RUN.
Workload/recovery NOT RUN / NOT MEASURED; Task 6 OPEN, CandidateVerified chưa có; không suy các gate còn lại PASS.
Giữ ordinary resend OFF, staging NOT ACCEPTED, production NO-GO; WEB7 không đóng WEB6 hoặc sửa lệch hợp đồng cross-epoch UNKNOWN.
Đợt lập roadmap này chỉ sửa Markdown: không cài dependency, đổi runtime, chạy browser/SQL/IIS hoặc tạo kết quả acceptance mới.

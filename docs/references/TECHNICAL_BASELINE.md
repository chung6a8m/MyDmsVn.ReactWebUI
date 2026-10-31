# Technical baseline và nguồn

**Khảo sát:** 2026-10-31, Asia/Bangkok. Repo ReactWebUI ban đầu rỗng, default branch `main`; chưa có package manifest hoặc lockfile. Các Git SHA dưới đây ghi mốc nguồn đọc, **không phải phiên bản dependency đã cài**. WEB-01 phải kiểm tra release stable phù hợp và cập nhật bảng phiên bản thực tế.

## 1. Quyết định Owner và phạm vi

Owner chọn Tailwind CSS v4 + Nova defaults, AG Grid Community, Dockview và cho phép Floating UI cho lookup; mục tiêu ưu tiên behavior. Business Compact và font 14px bắt buộc đã được bỏ khỏi hướng Web. Quyết định chi tiết ở [Foundation](../design/WEB_UI_FOUNDATION.md).

## 2. Nguồn đã kiểm tra

| Nguồn | Mốc khảo sát | Điều được nguồn hỗ trợ |
|---|---|---|
| [shadcn/ui](https://github.com/shadcn-ui/ui/tree/b8d7baa15b1dca5716f13153e63795fc3d741f6b) | `b8d7baa15b1dca5716f13153e63795fc3d741f6b` | Nova style, component source; preset không tự trở thành policy nghiệp vụ |
| [AG Grid](https://github.com/ag-grid/ag-grid/tree/026e1513b7620fd01faa8e68a106609c5c0e4439) | `026e1513b7620fd01faa8e68a106609c5c0e4439` | Quartz; Community editors; editing lifecycle và popup class |
| [Dockview](https://github.com/dockview/dockview/tree/18a975de67631ac2dafe5a5719fb132eb36ed392) | `18a975de67631ac2dafe5a5719fb132eb36ed392` | Rendering, panel move events, default-tab override và serialization |
| [Floating UI](https://github.com/floating-ui/floating-ui/tree/93ea014e0344ec0169e9a03db8aee70e90fd5a09) | `93ea014e0344ec0169e9a03db8aee70e90fd5a09` | Positioning, autoUpdate cleanup, virtual list navigation, portal root/focus primitives |
| [MyDmsVn](https://github.com/chung6a8m/MyDmsVn/tree/5b9f960ee4048581f107e9ee6350e1dfad462b53) | `5b9f960ee4048581f107e9ee6350e1dfad462b53` | Sales/Contracts: độc lập dòng, decimal/date/version, quyền và recovery; chưa có HTTP host trong baseline đã đọc |

### Đường dẫn hữu ích

- Tailwind: [Vite integration](https://tailwindcss.com/docs/installation/using-vite), [theme](https://tailwindcss.com/docs/theme).
- shadcn: [Nova/style choices](https://github.com/shadcn-ui/ui/blob/b8d7baa15b1dca5716f13153e63795fc3d741f6b/apps/v4/content/docs/changelog/2025-12-shadcn-create.mdx), [Nova source](https://github.com/shadcn-ui/ui/blob/b8d7baa15b1dca5716f13153e63795fc3d741f6b/apps/v4/registry/styles/style-nova.css).
- AG Grid: [themes](https://github.com/ag-grid/ag-grid/blob/026e1513b7620fd01faa8e68a106609c5c0e4439/documentation/ag-grid-docs/src/content/docs/themes/index.mdoc), [provided editors](https://github.com/ag-grid/ag-grid/blob/026e1513b7620fd01faa8e68a106609c5c0e4439/documentation/ag-grid-docs/src/content/docs/provided-cell-editors/index.mdoc), [editing lifecycle](https://github.com/ag-grid/ag-grid/blob/026e1513b7620fd01faa8e68a106609c5c0e4439/documentation/ag-grid-docs/src/content/docs/cell-editing-start-stop/index.mdoc), [custom editors](https://github.com/ag-grid/ag-grid/blob/026e1513b7620fd01faa8e68a106609c5c0e4439/documentation/ag-grid-docs/src/content/docs/cell-editors/index.mdoc).
- Dockview: [rendering](https://github.com/dockview/dockview/blob/18a975de67631ac2dafe5a5719fb132eb36ed392/packages/docs/docs/core/panels/rendering.mdx), [events](https://github.com/dockview/dockview/blob/18a975de67631ac2dafe5a5719fb132eb36ed392/packages/docs/docs/core/events.mdx), [tab source](https://github.com/dockview/dockview/blob/18a975de67631ac2dafe5a5719fb132eb36ed392/packages/dockview-react/src/dockview/defaultTab.tsx), [save](https://github.com/dockview/dockview/blob/18a975de67631ac2dafe5a5719fb132eb36ed392/packages/docs/docs/core/state/save.mdx), [load](https://github.com/dockview/dockview/blob/18a975de67631ac2dafe5a5719fb132eb36ed392/packages/docs/docs/core/state/load.mdx).
- Floating UI: [React](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/react.mdx), [autoUpdate](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/autoUpdate.mdx), [portal](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/FloatingPortal.mdx), [list navigation](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/useListNavigation.mdx). Các sources bổ sung ở Lookup spec.
- React: [state update semantics](https://github.com/reactjs/react.dev/blob/main/src/content/reference/react/useState.md).
- MyDmsVn: [Sales](https://github.com/chung6a8m/MyDmsVn/blob/5b9f960ee4048581f107e9ee6350e1dfad462b53/docs/DIRECT_SALES.md), [Contracts](https://github.com/chung6a8m/MyDmsVn/blob/5b9f960ee4048581f107e9ee6350e1dfad462b53/docs/CONTRACTS.md), [Architecture](https://github.com/chung6a8m/MyDmsVn/blob/5b9f960ee4048581f107e9ee6350e1dfad462b53/docs/ARCHITECTURE.md).

## 3. Giới hạn dùng nguồn

Source của nhánh phát triển có thể có API chưa phát hành. Chỉ sử dụng API có trong version đã cài; nếu close override hoặc event semantics khác, ghi phương án tương đương và kiểm chứng trước khi expose affordance. Không tự nâng major để khớp một đoạn tài liệu.

Các tài liệu MyDmsVn giữ nhiều trạng thái lịch sử. Repo này chỉ lấy business/contract semantics đã nêu; không kế thừa acceptance hoặc execution queue. Không sửa repo backend trong roadmap đầu.

## 4. Inventory WEB-01 — đã cài và kiểm chứng

Ngày 2026-10-31; Windows, Node 22.14.0, npm 11.6.0; package-lock.json lockfileVersion 3. Node 22 thuộc Maintenance LTS ([release schedule](https://github.com/nodejs/Release)); chọn runtime đang có, không thay Node toàn máy. Vite 8.3.5 yêu cầu ^20.19.0 hoặc >=22.12.0. Các package dùng stable dist-tag tại thời điểm cài; TypeScript chủ động pin nhánh 5.9.3. Exact versions trong manifest và lockfile; npm ci là đường tái lập.

| Package | Version | Nhóm |
|---|---|---|
| @base-ui/react | 1.9.0 | dependencies |
| @floating-ui/react | 0.27.20 | dependencies |
| @fontsource-variable/geist | 5.3.0 | dependencies |
| @tanstack/react-query | 5.105.0 | dependencies |
| @tanstack/react-router | 1.170.46 | dependencies |
| ag-grid-community | 36.2.0 | dependencies |
| ag-grid-react | 36.2.0 | dependencies |
| class-variance-authority | 0.7.1 | dependencies |
| cn | 0.5.1 | dependencies |
| dockview | 8.8.2 | dependencies |
| dockview-react | 8.8.2 | dependencies |
| lucide-react | 1.65.0 | dependencies |
| react | 19.3.1 | dependencies |
| react-dom | 19.3.1 | dependencies |
| react-hook-form | 7.91.0 | dependencies |
| tw-animate-css | 1.4.0 | dependencies |
| zod | 4.6.7 | dependencies |
| zustand | 5.0.16 | dependencies |
| @playwright/test | 1.64.1 | devDependencies |
| @tailwindcss/vite | 4.3.3 | devDependencies |
| @testing-library/jest-dom | 7.0.1 | devDependencies |
| @testing-library/react | 16.3.3 | devDependencies |
| @types/node | 22.20.5 | devDependencies |
| @types/react | 19.3.0 | devDependencies |
| @types/react-dom | 19.3.0 | devDependencies |
| @vitejs/plugin-react | 6.1.2 | devDependencies |
| jsdom | 29.1.1 | devDependencies |
| shadcn | 4.23.0 | devDependencies |
| tailwindcss | 4.3.3 | devDependencies |
| typescript | 5.9.3 | devDependencies |
| vite | 8.3.5 | devDependencies |
| vitest | 5.0.5 | devDependencies |

### Generator và CSS

Lệnh thành công: `npx --yes shadcn@4.23.0 init --preset nova --base base --template vite --no-monorepo -y`.
CLI 4.23.0 từ chối tên `base-nova` ở flags; `nova` + `--base base` sinh `components.json` với `style: base-nova`, neutral, lucide, CSS variables, Geist Variable. Đã đọc generated Button (Base UI) và utility; giữ nguyên toàn bộ token/type/spacing/radius, không override density. shadcn chuyển sang devDependency vì chỉ dùng CLI và build-time CSS.

Thứ tự imports: Tailwind → tw-animate-css → shadcn/tailwind.css → Geist → Dockview CSS. Tailwind dùng plugin `@tailwindcss/vite`; AG Grid dùng Theming API, không import legacy grid CSS. Nova root `.dark`, Quartz `data-ag-theme-mode` và Dockview `themeLight`/`themeDark` đều nhận một app mode. Chỉ thêm utility layout/overflow; không palette tùy biến.

### Đối chiếu package thực tế

- `dockview` 8.8.2 là core entry; React adapter được phát hành riêng trong `dockview-react` 8.8.2, peer React/ReactDOM hỗ trợ 19. Kiểm tra `dockview-react/dist/cjs/dockview/{dockview,defaultTab}.d.ts` và bundle: có `DockviewReact`, `hideClose`, `closeActionOverride` (bao gồm middle-click). Core types có `renderer: always`, `disableFloatingGroups`, `disableDnd`, `themeLight`, `themeDark`, remove event, `toJSON`/`fromJSON`. WEB-01 tắt drag/floating/context menu, hide close và no-op close override ở panel chỉ đọc; không hiện thực document lifecycle trước WEB-02/03.
- AG Grid 36.2.0: `dist/types/src/main.d.ts` export `AllCommunityModule`, `ModuleRegistry`, `themeQuartz`, `colorSchemeVariable`. Đăng ký Community modules; Quartz dùng mode mặc định qua data attribute. Không có Enterprise trong dependency tree hoặc feature đang expose. Row ở đây là **catalog option**, ID catalog là identity đúng; sales line grid ở WEB-05 bắt buộc dùng `clientLineId` riêng.
- Floating UI 0.27.20: installed declarations có `autoUpdate`, `useInteractions`, `useListNavigation`/`virtual`, `FloatingPortal.root`, focus manager. Chưa chạy popup/focus acceptance; WEB-04 sở hữu phần đó.
- React 19.3.1, Base UI 1.9.0, Router/Query: strict typecheck, production build và Chromium rendering chạy cùng nhau. Zustand/RHF/Zod đã pin cho consumer tasks, chưa gán ownership state giả hoặc dựng Sales runtime sớm.
- Vitest 5.0.5 (Node environment cho fake port); Testing Library/jsdom đã cài cho component tasks sau. Playwright 1.64.1 / Chromium 156.0.8078.4, build 1248.

Nguồn bổ sung: [shadcn Base Button](https://ui.shadcn.com/docs/components/base/button), [Vite setup](https://ui.shadcn.com/docs/installation/vite), [Tailwind Vite plugin](https://tailwindcss.com/docs/installation/using-vite). Compatibility kết luận từ installed types, `npm ls`, typecheck/build và browser run; không suy từ source main.

### WEB-02 — đối chiếu bổ sung trên versions đã pin

- Generated Input bằng `npx shadcn add input -y` (local CLI 4.23.0), sau `npx shadcn docs input` và đọc [Base Input](https://ui.shadcn.com/docs/components/base/input). Giữ source Nova nguyên bản; không thay token/density, không thay lockfile.
- Dockview 8.8.2: `DockviewApi.onDidActivePanelChange` trả event có `panel`; `panel.api.setActive()`, `moveTo({ group, position: 'right' })`, `onDidRemovePanel`/`onDidAddPanel`, `renderer: 'always'`, `api.isVisible` có trong installed types. Browser đã exercise split và HTML5 mouse drag thật. `dockview-react` bundle dùng `useKeptInstance`: StrictMode không đảm bảo gọi lại onReady; host phải attach qua effect theo instance, cleanup chỉ hủy subscriptions.
- AG Grid Community 36.2.0: installed `GridState` chứa `columnOrder`, `columnSizing`, `scroll`, `focusedCell`; `initialState` phục hồi state và `getRowId` dùng clientLineId. Installed bundle cập nhật scroll cache tại `bodyScrollEnd`; `onBodyScroll` cung cấp top/left để publish ngay trước hide/remount. DOM scroll viewport ở bản này là `.ag-grid-viewport`, không phải `.ag-body-viewport` của bản cũ. DOM selector chỉ dùng test; ứng dụng lưu qua public events/State API.
- Zustand 5.0.16 dùng vanilla store + `useStore` selector; instance thuộc provider trên route, không thuộc panel. Không thay dependencies/engine constraints của WEB-01.

### WEB-03 — close admission trên versions đã pin

- Generated Dialog bằng `npx shadcn add dialog -y` (local CLI 4.23.0), sau đọc docs và installed Base UI Dialog types. Giữ source Nova nguyên bản; `DialogContent` dùng `initialFocus` tới Cancel, Base UI là chủ focus/dismiss duy nhất. Không đổi dependency/lockfile.
- `DockviewDefaultTab.closeActionOverride` ở React adapter 8.8.2 đã được browser exercise qua X và middle-click thật; chỉ gọi controller, không gọi remove trực tiếp. `DockviewApi.removePanel` chỉ chạy sau admission. Đính chính sau review PR #1: native tablist handler 8.8.2 xử lý Delete/Backspace bằng `panel.api.close()`, bypass override của default tab. WorkspaceHost chặn capture khi target là role=tab và chuyển session được đánh dấu bởi DocumentTab qua admission; tab danh mục không đóng. Browser regression bao phủ cả hai phím với dirty, pending và outcome-unknown. Ctrl+Alt+W do ứng dụng quản lý.
- Inventory đường đóng và acceptance cụ thể nằm trong [evidence WEB-03](../evidence/20261031-web-foundation.md#7-web-03--close-admission-và-command-routing). Không suy ra khả năng chặn remove toàn cục của Dockview.

### WEB-04 — Floating UI và grid editor trên versions đã pin

- Đã đối chiếu installed `@floating-ui/react` 0.27.20 declarations/bundle: `useFloating<HTMLInputElement>`, `offset → flip → shift → size`, `autoUpdate`, `FloatingPortal.root`, `useListNavigation` virtual và `useInteractions`, `useDismiss({ancestorScroll:false,escapeKey:false})`. Không thêm Base UI Combobox hoặc focus trap vào lookup.
- `useListNavigation` bản cài có item `onClick` gọi focus vào option kể cả virtual; sau selection tường minh ProductLookup trả focus về input. Outside-dismiss không kéo focus về input. `autoUpdate` cleanup cả subscription lẫn frame đang chờ; cập nhật vị trí qua animation frame để tránh ResizeObserver feedback loop khi size middleware đổi kích thước.
- AG Grid React 36.2.0: `CustomCellEditorProps.value/onValueChange` có trong installed types. Native keyboard listener của grid chạy trước React bubble handler, nên product column gắn `suppressProductLookupKeyboard`; Escape tầng hai phục hồi session ở capture trước default grid cancel. Popup có `ag-custom-component-popup`; browser đã kiểm tra chọn chuột không làm editor commit sớm.
- Base UI 1.9.0 modal là chủ focus trap. Host nằm trong DialogContent; popup không inert. Tab đi qua Base UI focus guard rồi trở lại input ở frame kế tiếp; test đợi focus ổn định. Không đổi generated Dialog/Input/Button, token/palette hoặc package lock.

### WEB-05 — publication trước barrier

- AG Grid Community 36.2.0 installed source: provided CheckboxCellRenderer phát `node.setDataValue` ngay khi click/Space; `readOnlyEdit` chuyển thành `onCellEditRequest`. Ứng dụng cập nhật immutable session draft, grid render lại từ store. Provided CheckboxCellEditor chỉ đọc local checkbox ở `getValue()` khi stop, không đáp ứng retention/barrier; không expose editor đó. Đính chính review vòng 2: chặn F2/Enter chưa đủ vì Tab từ editor vẫn có thể mở provided checkbox editor. Cột Tặng hiện `editable: false`, truyền `cellRendererParams.disabled` theo canEdit (installed renderer dùng `params.disabled ?? !column.isCellEditable(node)`). Click/Space vẫn phát onCellEditRequest; mọi đường vào cell không mở editor.
- Product editor vẫn inline; `suppressClickEdit` + handler double-click chỉ mở editor sản phẩm, presentation cell giữ nguyên row height, label/error accessible và actions dạng icon (sửa từ review vòng 1). Decimal inline cell renderer dùng Input Nova và session raw adapter vì cần giữ text/composition chính xác; không dùng Number editor.
- `stopEditing`, `getEditingCells`, `onCellEditRequest`, `onCellEditingStarted/Stopped`, `refreshCells`, `setRowHeight/onRowHeightChanged` có trong package cài. Barrier đăng ký flush với grid, xác nhận không còn editing cells sau stop; mọi adapter công bố raw/selection trước acknowledgement. Không dùng DOM selector hoặc timeout để lấy snapshot. DOM lookup chỉ dùng focus lỗi và browser tests.
- BigInt fixed-scale là code ứng dụng, không thêm dependency hoặc suy JSON wire từ Decimal4 local port. Header dùng cùng Floating UI controller với CatalogKind customer/warehouse/employee nằm trong query key; không tạo popup controller thứ hai.

- Review vòng 2: Tab từ Product dừng editor trước khi gọi `tabToNextCell`/`tabToPreviousCell`, nên đi qua cả cột read-only. Decimal renderer có input tabIndex=-1; focus chuột đồng bộ grid position, Enter/F2/printable chuyển từ cell vào input. Chỉ suppress text keys khi input có focus; Tab/Shift+Tab trả cho grid, composition giữ focus. Browser regression xác minh điều hướng hai chiều và Gift dirty trước close/snapshot.


### Review vòng 3 — thay renderer số bằng editor theo yêu cầu Owner

- Qty/UnitPrice hiện dùng `cellEditor: DecimalCellEditor`; text idle đọc raw buffer trước draft. Renderer tương tác mô tả tại vòng 2 đã được thay thế. Adapter publish decimal string/composition vào session ngay và gọi `onValueChange` cho model editor; không dùng Number editor. Escape khôi phục buffer đầu lần sửa trước grid cancel.
- Installed AG Grid 36.2.0 `_setupEditor` có nhánh refresh editor đã mở bằng core editorParams, không merge custom params; decimal adapter giữ binding session/line ban đầu qua useRef. Explicit double-click/focus-error guard không yêu cầu start lại cell đang editing.
- `startEditingCell` không đồng nghĩa React input đã mount. Đường close validation dùng autoFocus của editor, không focus fallback alert ngay sau start (đường đó khiến stopEditingWhenCellsLoseFocus đóng model khi input đang mount). Browser regression thực hiện sửa tiếp + Enter sau close validation cho Qty và UnitPrice.
- Giới hạn Gift đã được reviewer xác nhận: public onCellEditRequest dispatch bất đồng bộ; các kết luận click/Space → close/snapshot là luồng browser đã kiểm chứng, không cam kết đồng bộ trong cùng một lượt JavaScript.


### Review vòng 4 — row identity và chốt lookup Sales

- Close validation dùng `getRowNode(clientLineId).rowIndex` tại thời điểm điều hướng, dùng cùng displayed index cho ensureIndexVisible/setFocusedCell/startEditingCell. Browser kiểm chứng cả Qty và UnitPrice sau sort giảm dần.
- Sales Product adapter opt-in `onCommitSelection`: React capture xử lý Enter/Tab trước native grid handler. useProductLookup đã loại active option khác query/context/generation; adapter publishLookup thành công mới stopEditing và focus Qty qua RowNode. Không startEditingCell cho Qty. Field/modal/harness giữ contract cũ; Shift+Tab vẫn điều hướng ngược.
- CSS chỉ giới hạn `.sales-gift-cell .ag-checkbox-cell` để căn flex wrapper, không text-align lên cell và không thay provided renderer.


### WEB-06 — API trên installed versions

Không thêm dependency hoặc thay lockfile. Dockview 8.8.2 `DockviewPanelApi.setTitle` được đối chiếu trong `node_modules/dockview-core/dist/cjs/api/dockviewPanelApi.d.ts`: Create đổi tiêu đề panel hiện hữu, không remount session. AG Grid Community 36.2.0 `onRowDoubleClicked`/`onCellKeyDown` có trong installed `gridOptions.d.ts`, dùng mở list row qua double-click/Enter. Typecheck và browser chạy các consumer thật. Fake adapter/commands/recovery là API ứng dụng; không suy HTTP protocol hay đảm bảo backend từ implementation này.

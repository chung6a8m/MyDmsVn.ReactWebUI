# WEB7 — Product Shell và UI foundation

**Thiết kế cho roadmap đã chọn ngày 2026-11-20; chưa triển khai.** [Owning plan](../plans/20261120-001-web7-product-shell-ui-lab.md) giữ task/status; [source baseline](../references/WEB7_SOURCE_BASELINE.md) giữ bằng chứng source, dependency pins và nguồn bên thứ ba; [acceptance](../development/WEB7_ACCEPTANCE_MATRIX.md) giữ các assertion cần kiểm chứng. Nội dung dưới đây là contract mục tiêu, không phải mô tả UI đã có.

## 1. Hướng đã chọn

Giữ một repo với hai môi trường sử dụng: **Product** cho công việc nghiệp vụ và **Lab** cho thử nghiệm/kiểm tra tập trung. Cả hai dùng cùng feature components và shared UI; composition, runtime và nguồn dữ liệu tách nhau.

Product Shell lấy cấu trúc [sidebar-07](https://ui.shadcn.com/view/new-york-v4/sidebar-07): navigation cạnh trái có thể thu gọn, header/breadcrumb và vùng nội dung chính. Triển khai bằng config **`base-nova` + Base UI hiện hữu**, giữ typography, spacing, radius, palette và Light/Dark. Reference New York là tham chiếu bố cục; không reinitialize preset, mang Radix-specific trigger code vào Base hoặc sao chép menu/demo data không có chức năng.

| Phương án | Quyết định và lý do |
|---|---|
| Cùng repo, Product/Lab compositions, shared controls từ use case thật | Chọn: phản hồi nhanh, kiểm tra cùng implementation, ít boundary mới |
| Tách Lab thành app/package/repo ngay | Chưa cần: chưa có consumer độc lập hoặc yêu cầu release riêng bù cho chi phí đồng bộ |
| Tạo bộ widget đầy đủ trước khi hoàn thiện màn hình | Không thuộc WEB7: chỉ tạo thành phần có consumer Sales/Receipt/Inventory hoặc shell |

Không thay AG Grid Community, Dockview, Floating UI, route nền hoặc backend contracts. Không thêm System theme/density setting khi product hiện chỉ có Light/Dark. Không áp Business Compact hoặc font 14px bắt buộc từ desktop.

## 2. Composition và ownership

| Lớp | Sở hữu | Không được nhận thêm |
|---|---|---|
| `ApplicationEntry` | Auth boundary, retained runtime registry, key actor/epoch/generation, logout admission, beforeunload | Runtime mới theo sidebar/theme/route con |
| Product Shell mới | Navigation, header/account, collapsed/mobile chrome, module context được derive | Draft/store/mutation state thứ hai |
| `ProductionWorkspace` / `WorkspaceHost` | Ghép feature panels, mount Dockview, gọi workspace API | Dispose document khi chỉ đổi layout/tab/host |
| Feature/runtime | Session identity, raw/composition, validation, dirty, capabilities, command/recovery | Chính sách lấy từ trạng thái trang trí của shell |
| Shared UI | Input/popup mechanics và presentation có contract | HTTP endpoints, IDB namespace, grant/commit/retry authority |
| Lab composition | Fake runtime/scenario/diagnostics, catalog và recipes | Production auth/cache/storage hoặc fallback HTTP |

`ApplicationEntry` giữ default factory **`createConfiguredProductionRuntime`**, không gọi thẳng factory bỏ qua WEB6 candidate binding. Sau auth, `WorkspaceProvider` bọc Product Shell và nội dung runtime hiện hữu. Product Shell nhận account/logout qua props/context, không tạo AuthSession mới. Chỉ có **một product WorkspaceHost được mount**; sidebar desktop và drawer mobile không chứa hai bản workspace.

Sidebar state chỉ là preference hiển thị. Module hiện hành lấy từ `panelState.activeId` và module panel thực; hai nhóm Dockview đổi focus phải cập nhật breadcrumb/actions theo cùng nguồn này. Chọn module gọi `workspace.openPanel`, còn tạo chứng từ là hành động `workspace.openDocument(module, null)` riêng. Không giữ thêm `currentModule` có thể lệch active panel, không biến đổi menu thành close/reset.

Route `/` vẫn là product entry; login/reauth nằm ngoài authenticated shell. `/lab/*` tiếp tục dynamic import chỉ trong DEV. App↔Lab có thể unmount host theo router, nhưng runtime/session đang được retained phải giữ đúng lifecycle/beforeunload hiện hữu; không tạo runtime mới hoặc dispose tài liệu chỉ vì đổi route. Không persist auth, document hoặc raw vào sidebar preference.

## 3. Product navigation và layout

| Vị trí | Nội dung |
|---|---|
| Sidebar header | Tên MyDmsVn; không dựng organization/team switcher khi chưa có contract |
| Navigation | Bán hàng; nhóm Kho gồm Phiếu nhập, Tồn kho, Thẻ kho; mục chỉ xuất hiện/khả dụng theo module capability hiện hữu |
| Sidebar footer/account | Tên actor thực, logout gọi callback admission; theme Light/Dark; link Lab chỉ DEV |
| Header | Toggle sidebar, breadcrumb theo module/panel, menu Tạo chứng từ theo Write grant độc lập Read/active panel, contextual actions |
| Content | Workspace thực và Dockview tabs/groups; không thay bằng dashboard/cards placeholder |

Navigation state phân biệt active, disabled/busy và thiếu quyền. Handler vẫn kiểm capability/context sau khi người dùng chọn; menu không thay authorization. Module không có quyền Read không được mở danh sách để lộ dữ liệu cached. **Write và Read độc lập:** menu Tạo chứng từ ở header cho phép tạo Sales/Receipt theo Write grant riêng, kể cả không có active panel hoặc đang ở Inventory; không bắt người dùng mở danh sách trước. Khi scope đổi, stale menus/dialogs/results không tiếp tục thao tác với actor/epoch cũ.

Layout dùng full available height, `min-width/min-height` phù hợp và scroll theo vùng: sidebar, workspace/panel, grid. Header/toolbar wrap hoặc có overflow menu đủ nhãn, không che Save/Post/close. Giữ typography/density Nova và theme integration của AG Grid/Dockview. Không dùng global CSS zoom để ép nhiều nội dung.

Desktop là mặt bằng chính: kiểm tra 1440×900, 1280×720; narrow shell tại 768px và drawer/navigation tại 390px. Grid rộng có thể cuộn ngang trong panel; không tuyên bố toàn bộ nghiệp vụ đã tối ưu thao tác mobile. Ở zoom thật 125%/200%, command và dialog vẫn tiếp cận được, không kẹt focus hoặc mất nội dung xác nhận. Test navigation bằng keyboard, icon accessible names khi collapse, visible focus, Escape và return focus.

## commands

### Vị trí và target của lệnh

| Nhóm lệnh | Vị trí mục tiêu | Contract |
|---|---|---|
| Mở Sales/Receipt/Inventory | Sidebar | `openPanel(module)` với Read grant; chọn lại activate panel hiện hữu |
| Tạo Sales/Receipt | Menu Tạo chứng từ ở header; shortcut toolbar module nếu có | `openDocument(module, null)` với Write grant độc lập Read/active panel; người dùng chọn module rõ ràng, không ngầm fallback Sales từ Inventory |
| Save/Post, hành động dòng | Document/grid toolbar | Feature command capture + editor barrier + quyền/dirty/mutation state hiện hữu |
| Split, đóng tài liệu/tất cả | Workspace action menu/tab controls | Active panel thực, common close admission; di chuyển không phải đóng |
| Reset/restore bố cục | Workspace layout menu | Giữ cơ chế tự persist/layout admission hiện hữu; failure không xóa retained sessions |
| Bản nháp và hỗ trợ recovery | Entry workspace ổn định, status theo document | LocalDraftControls/RecoverySupport hiện hữu; giữ IDs để chọn đúng draft/operation |
| Snapshot, mark, fixtures/latency | Lab toolbar/catalog | DEV-only extensions; Ctrl+Alt+M không đăng ký ở product |

Đưa entry bản nháp vào vùng header/toolbar còn mounted khi menu/drawer đóng. Nếu một dialog mở từ trigger sẽ unmount, chỉ định return-focus fallback vào trigger workspace ổn định; không thêm focus trap thứ hai. Đóng popup và mở dialog phải có thứ tự rõ; nested resend confirmation giữ Cancel là initial focus và trả focus đúng khi thoát.

Save/Close/Reset/Restore/Logout bảo toàn invalid raw và pending/unknown. Busy presentation theo document/vùng; layout-close busy có thể khóa các lệnh layout hiện hữu, không biến một write đang chờ thành toàn app bất động. Một click/Enter trên menu không được dispatch hai command; IME composition và repeat events vẫn được bảo vệ.

## 4. Những counterpart có giá trị với WinFormsKit

Đối chiếu **chức năng**, không mang control desktop, font/palette hoặc implementation WinForms sang web. [Baseline](../references/WEB7_SOURCE_BASELINE.md) ghi pin lịch sử WinFormsKit, tránh hiểu bảng này là chứng nhận parity với HEAD hôm nay.

| Nhóm WinFormsKit tham chiếu | Nền web đã có | Kết quả WEB7 |
|---|---|---|
| BootstrapSidebar/Breadcrumb/Tabs/ButtonToolbar | Dockview, panel registry, button | Product Shell + command placement; giữ tab engine/lifecycle hiện hữu |
| TextBox/InputGroup/ValidationState | Input, Receipt field errors, feature validators | DocumentField/helper/error/summary dùng cho Sales và Receipt |
| DateInput/Calendar/DatePicker | Text ISO và date validators | DateField ISO + calendar, raw/IME/focus contract |
| DecimalInput/NumericBox/grid editors | Exact decimal parsers và hai feature editors | Shared input mechanics với feature adapters |
| LookupBox/LookupColumn/Select | ProductLookup + Floating UI; NativeSelect | Reuse field/cell lookup, thêm Sales list filters và catalog states |
| Pagination/Alert/Badge/Spinner/BusyOverlayHost | Paging/query/recovery state trong feature | FilterBar/ReadState và feedback theo vùng, giữ pagination/domain ownership |
| ControlGallery/list-edit recipes | `/lab/sales`, `/lab/components`, fixtures | Catalog có state matrix, Filter Results và Document Edit recipes |

Toast/modal/advanced date range/multiple selection/tree/list/notification center chỉ thêm khi có nhu cầu thuộc task. Không mở mục tiêu “đủ mọi control WinFormsKit”; UIC-03/UIC-04 của snapshot desktop còn planned, không coi là implementation phải port.

## 5. Shared UI contracts

### 5.1 Ba mức tái sử dụng

`src/components/ui/` chứa primitive sinh từ shadcn theo preset, chỉ thêm cái cần dùng. `src/shared/` chứa control/composition có behavior chung đã được chứng minh qua consumer. `src/features/` giữ adapters, business validation, field mapping, commands và data state. Tên nằm trong `shared` hiện nay không tự chứng minh đã domain-neutral: DecimalCellEditor đang phụ thuộc Sales cần tách mechanics có chủ đích; ProductLookup có scope type gắn Sales nhưng được reuse bằng adapter hẹp, không bắt buộc viết lại cả engine.

Không bọc lại mọi Button/Input. Không dùng React Hook Form hoặc state local làm bản sao raw/draft của document store. Shared component có thể giữ trạng thái UI tạm như popup open, highlighted day, caret/ref; raw/value/composition làm căn cứ Save vẫn publish vào feature state đúng thời điểm.

### 5.2 DocumentField và ValidationSummary

Contract tối thiểu: stable field/control ID, label, helper text, required/read-only/disabled presentation, issues/description IDs, child control hoặc slot cần thiết. Component không tự đọc workspace hay validate nghiệp vụ. Caller quyết định `canEdit`, issue list và callback focus.

ID gồm module + documentSessionId + field/clientLineId, không dùng vị trí dòng hoặc Product ID. Helper/error IDs được gắn với input qua `aria-describedby`, invalid qua `aria-invalid`; label click focus đúng control. Lookup đã có label/input ownership thì compose helper/error xung quanh, không bọc nested label. ValidationSummary hiển thị lỗi thật; chọn lỗi hoặc lần submit thất bại focus đúng field/row sau khi reveal panel/virtualized row. Không focus mỗi lần gõ hoặc lấy nhầm dòng sau sort.

### 5.3 DateField v1

**Raw và canonical đều giữ grammar `yyyy-MM-dd`; calendar là cách nhập bổ sung.** Tách raw text khỏi ngày valid, nhưng không đổi định dạng raw đã persist. Placeholder/helper nói rõ format. V1 không tự đoán năm/ngày ngắn, không nhận dd/MM/yyyy, không đổi timezone hoặc migrate draft.

| Tình huống | Hành vi |
|---|---|
| Empty/incomplete/invalid, ví dụ `2026-` hoặc `2026-02-30` | Giữ nguyên raw; không ép về empty/last valid; feature quyết định lỗi và Save barrier |
| ISO hợp lệ | Pure parser trả year/month/day + canonical string; caller vẫn kiểm required/bounds/business rule |
| Chọn ngày trên calendar | Publish ISO qua cùng raw-edit path; chưa tự Save/Post; đóng popup và trả focus hợp lý |
| Blur/Escape/outside popup | Không tự sửa raw hoặc revert input; Escape đóng popup, giữ text đã gõ; dismissal không dispatch command |
| Composition đang diễn ra | Publish composing flag; tránh selection/Enter hoặc shortcut gây commit ngoài ý muốn |
| Restore/remount | Dùng raw của feature store/draft, kể cả text invalid; không reset từ local component state |

Pure helper nên trả discriminated result `empty | incomplete | invalid | valid`; chính sách bắt buộc/nullable/min/max thuộc feature. Giữ Receipt reject `0001-01-01` và Sales policy hiện hữu. Nếu thư viện calendar nhận `Date`, convert year/month/day ở UI boundary và kiểm years 0001–0099 đúng; không dùng `Date.parse`, `toISOString` hay UTC conversion để tạo giá trị wire. Highlight date từ valid raw; khi invalid, calendar không được làm mất raw bằng cách chọn lại baseline ngầm.

Một popup owner quản lý focus/position/dismiss. Verify Tab, Escape, Enter/Space, arrow/Home/End/PageUp/PageDown theo API calendar thực sự pin. Giữ ref/ARIA hợp với field và Dockview portal. Chọn dependency calendar sau khi đọc generated source/installed types; hiện chưa có DayPicker trong lock, live shadcn/DayPicker docs có thể khác major/package. Ghi version/source trong evidence, không dùng `@latest` vô điều kiện.

**Inventory timestamp là contract khác:** tiếp tục raw `yyyy-MM-ddTHH:mm:ss[.fffffff]Z`, UTC, start ≤ end và tối đa bảy chữ số phần giây theo wire schema. WEB7 chỉ cải thiện helper/error/layout của các input này; không thay bằng DateField hoặc `datetime-local`, không dùng JavaScript Date làm mất precision, không biến thành khoảng ngày inclusive.

### 5.4 DecimalInput và grid adapters

Shared input nhận controlled raw string, accessibility/disabled/ref, callback raw+composing và Escape/keyboard events cần thiết. Nó không nhận WorkspaceRuntime, Product ID, commit HTTP hoặc feature store. Feature adapter capture session/line/edit identity từ mount, giữ entry raw và gọi write/restore/prepare hiện hữu. AG Grid refresh có thể bỏ custom params; binding không được đổi theo props refresh không đầy đủ.

Giữ chính sách hiện tại: exact decimal string/BigInt, separator dot/comma, scale/limits theo feature; trailing zeros được xử lý đúng parser hiện hữu; không round quá scale hoặc convert sang JS number. Receipt giữ lexical bound 64 ký tự và rule unitCost riêng; Sales giữ qty/unitPrice/tổng tiền, gift và duplicate-product semantics riêng. Không format grouping khi đang gõ làm nhảy caret. Save thấy ký tự cuối qua barrier kể cả editor unmount; Escape phục hồi raw khi bắt đầu edit; invalid raw vẫn dirty.

### 5.5 Lookup, filters và read states

ProductLookup/Floating UI tiếp tục quản lý một popup: query, highlighted option và committed selected ID là ba trạng thái khác nhau. Dùng catalog port đã có cho Customer/Warehouse/Employee/Product; không thêm Base Combobox controller/Positioner cho cùng popup. Optional Sales filters chỉ dùng ID đã confirm; clear bỏ filter. Receipt/Inventory giữ rule required tương ứng và captured actor/epoch/generation.

FilterBar chỉ sắp xếp controls/actions. Sales giữ cursor; Receipt/Inventory giữ page number/total count, reset theo contract. Shared ReadState nhận state và action callback của caller, không fetch hoặc retry tự động. Phân biệt chưa đủ filter, loading, không có dữ liệu, không khớp filter, lỗi và mất quyền; khi mất quyền phải ẩn rows/cache cũ. Không báo “rỗng” thay cho network error. Initial/refetch busy không làm mất raw filter đang gõ.

Feedback nghiệp vụ giữ state machine ở feature/runtime. Pending/UNKNOWN/COMMITTED cần đối soát/NOT_EXECUTED không được rút thành một toast “Thử lại”. Local persistence retry chỉ lưu kết quả local; check result/resolution là đọc; manual resend là original frozen mutation có gate/consent riêng. Action availability và messages lấy từ owner tương ứng. Lỗi quan trọng và support identifiers có thể đọc lại, không biến mất theo toast timer; không đưa raw payload/secrets vào catalog hoặc support copy.

## 6. UI Lab và catalog

Lab giữ môi trường DEV và cùng repo. `WorkspaceExtensions` là hướng injection: product nhận defaults rỗng, Lab cung cấp diagnostic UI/shortcut/harness. Chuyển snapshot preparation/message/JSON và mark controls về Lab; không chỉ CSS-hide nút hoặc bỏ label nhưng để shortcut global. Test snapshot/mark cũ vẫn chạy cùng barrier/command thật của feature.

| Nhóm catalog | Nội dung tối thiểu |
|---|---|
| Primitives | Những primitive thực có trong repo: Button/Input/Dialog/NativeSelect và phần thêm cho shell/field/calendar; state normal/disabled/focus/error khi thích hợp |
| Controls | DocumentField/summary, DateField, DecimalInput, ProductLookup field/cell, ReadState/FilterBar; raw/canonical/validation/focus scenarios |
| Recipes | Filter Results; Document Edit gồm header + lines + feedback/actions; shell/workspace với hai panel và dialogs |

Mỗi entry có ID ổn định, purpose, source/consumer, state chọn được, keyboard notes, giới hạn và test path. Dùng query/route allowlist để mở đúng entry/scenario, có fallback rõ cho input không hợp lệ. Catalog không render một input trông giống product nhưng có logic riêng. Example raw/parsed display nằm trong Lab; product chỉ hiển thị thông tin người dùng cần.

`/lab/sales` và `/lab/components` giữ tương thích journeys hiện hữu; thêm `/lab/receipts` và `/lab/inventory` dùng real feature components + deterministic fake ports. Giữ `ReceiptWorkspaceProbe`/stub như harness riêng khi tests còn cần, không dùng nó chứng minh nghiệp vụ Receipt. Fixture chọn module, quyền, latency/empty/error/invalid/pending theo scenario; data/key namespace riêng, QueryClient/auth/runtime tách product, không fallback HTTP. Khi đổi scenario/reset có dirty sessions, không ngầm vứt chúng; dùng lifecycle/admission rõ và giữ beforeunload protection.

Catalog được bổ sung cùng PR control, rồi WEB7-08 hoàn thiện navigation/recipes/coverage. Không cần Storybook hoặc design-system package để có catalog hữu ích.

## 7. Ranh giới với WEB6 và tiêu chí hoàn thành

WEB7 có thể đổi layout/presentation của recovery controls nhưng giữ default OFF, candidate binding, original operation identity/request, one-shot consent/CAS và actor/epoch/generation fences. Không thêm UI preference bật resend, auto retry, unlock, IDB migration hoặc cross-epoch listing. Recovery draft được chọn theo operation identity; không chọn first/latest để làm test dễ hơn. Nếu UI change cần đổi các contract đó, ghi dependency ở owning WEB6 task và xử lý quyết định riêng; shell/catalog còn lại không phải chờ live SQL gates.

Nghiệm thu theo [matrix](../development/WEB7_ACCEPTANCE_MATRIX.md): dùng product composition thật, native browser với Dockview/AG Grid/portal, built-artifact isolation và evidence cụ thể. UI có hình thức product chỉ là một phần: cùng document/session/raw/line IDs phải sống qua navigation/layout, commands phải đúng target/grant và không có transmission ngoài ý muốn. Frontend fixture PASS không chứng minh SQL effect, deployment/recovery readiness hoặc production GO.

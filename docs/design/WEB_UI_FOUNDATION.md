# Thiết kế nền Web: workspace và nhập liệu

**Ngày:** 2026-10-31. **Trạng thái:** hướng sản phẩm đã được Owner chọn; WEB-01 shell/Lab/contracts và WEB-02 document sessions/Dockview edit harness, WEB-03 close admission/Save stub đã triển khai và có evidence. Các boundary nghiệp vụ còn lại là thiết kế cho task sau; xem [evidence](../evidence/20261031-web-foundation.md) để biết phạm vi acceptance.

## 1. Mục tiêu và quyết định

Owner chọn chuyển UI sang Web, ưu tiên hành vi: nhập liệu bằng bàn phím, giữ dữ liệu khi đổi/kéo tab, feedback đúng tài liệu và xử lý async ổn định. Owner bỏ yêu cầu Business Compact và font 14px bắt buộc; giữ style/theme mặc định Tailwind v4 + Nova; chọn AG Grid Community, Dockview và cho phép Floating UI cho lookup.

| Boundary | Lựa chọn |
|---|---|
| Frontend | React + TypeScript strict + Vite |
| Styling | Tailwind CSS v4, shadcn/ui Nova trên Base UI; giữ cấu hình mặc định được generator tạo |
| Theme | Nova cho form; Quartz cho AG Grid; built-in Light/Dark cho Dockview; một app theme mode |
| Grid | AG Grid Community; text/select/checkbox editor sẵn có khi phù hợp; decimal và lookup adapter riêng |
| Workspace | Dockview tab/dock/split/resize trong một cửa sổ |
| Lookup | ProductLookup sở hữu behavior, dùng trực tiếp `@floating-ui/react` cho popup; không dùng hai controller |
| Data | Typed async feature ports; fake adapter là runtime duy nhất của roadmap đầu |
| State | TanStack Query cho query; Zustand cho document/workspace store; form state có chủ sở hữu rõ |
| Form | React Hook Form + Zod cho header/schema; không tạo bản sao thứ ba của line draft |
| Navigation | TanStack Router cho shell và route vào thẳng Lab; tab tài liệu do workspace quản lý |
| Verification | Vitest + Testing Library và Playwright; tình huống giả lập xác định được |

Các lựa chọn React/Base UI/state/form là đề xuất kỹ thuật tiếp nối cuộc trao đổi, không phải code hiện có. WEB-01 ghi phiên bản thật và lockfile. Tài liệu API bên thứ ba có nguồn tại [Technical Baseline](../references/TECHNICAL_BASELINE.md).

### Các hướng đã cân nhắc

1. Business Compact Web với token/density riêng: đã được thay thế bằng lựa chọn giữ mặc định của Owner.
2. Nova + component có sẵn + adapter hành vi nhỏ: hướng được chọn cho roadmap này.
3. Bộ component nghiệp vụ toàn diện hoặc tái hiện WinForms bằng một framework UI riêng: không cần cho pilot.

Lookup có hai cách hợp lệ: Base UI Combobox trọn gói hoặc input/listbox với Floating UI. Roadmap chọn cách thứ hai cho ProductLookup vì cần kiểm soát cùng một hành vi ở form và grid. Component Base UI khác dùng positioning/focus của chính chúng; không thay cơ chế nội bộ của thư viện.

## 2. Phạm vi và kết quả cuối

**Active:** ứng dụng + Web UI Lab chia sẻ production components; Sales list có filter/cursor; nhiều sales document; lookup header và sản phẩm; nhập bảy cột; Save/Post qua fake async ports; read-only, validation, conflict, pending/unknown/recovery; close guard; theme switch; lưu/khôi phục layout.

**Deferred:** HTTP host, login/token thật, backend/runtime migration, SQL, tính COGS production, floating/popout, mobile-first, offline, lưu draft qua refresh, in/xuất Excel, spreadsheet range clipboard, full Security Administration và bộ UI phát hành độc lập. WEB-08 tạo handoff API, không hiện thực các phần deferred.

Tiêu chí thành công là các scenario trong [Workspace](WORKSPACE_BEHAVIOR.md), [Editing](LOOKUP_AND_GRID_EDITING.md), [Sales](SALES_PILOT.md) chạy qua đường production với fake adapter. Không lấy hình WinForms hoặc đo font/control cố định làm tiêu chí chấp nhận.

## 3. Kiến trúc và ownership

| Lớp | Sở hữu | Không sở hữu |
|---|---|---|
| App shell | Theme, router, Dockview host, command routing | Nghiệp vụ Sales và dữ liệu server |
| Workspace controller | Registry phiên, mở/kích hoạt/đóng, layout | Tính tiền, posting, permission server |
| Sales feature | Header/line draft, raw edit, validation, command/recovery | DOM lifetime của Dockview |
| Shared editor/lookup | Input mechanics, floating, selection, commit protocol | Save/Post, session mutation authority |
| Feature ports | Query/command có kiểu, kết quả async | HTTP endpoint giả định |
| Fake infrastructure | Dataset và scenario xác định, delay/failure/outcome | SQL hoặc bảo mật production |

Query cache không tự ghi đè draft. React Hook Form là cơ chế form, không phải nơi duy nhất giữ dữ liệu tài liệu: session store giữ canonical draft + raw buffers; header fields subscribe/cập nhật có chủ đích. Grid nhận line models bằng stable row ID. Chỉ có một đường áp dụng thay đổi vào draft và một revision tăng khi người dùng thay đổi.

Một chứng từ mới có session ID cục bộ khác server Sale ID. Khi Create thành công, liên kết server ID vào cùng phiên, giữ client line IDs và trạng thái UI tương ứng. Không đổi React key rồi tạo lại toàn bộ editor.

### Cấu trúc đích (được tạo từ WEB-01)

| Đường dẫn đích | Trách nhiệm |
|---|---|
| `src/app/{App.tsx,theme.ts,router.tsx,providers.tsx}` | Composition, theme và router |
| `src/app/workspace/` | `WorkspaceHost.tsx`, `workspaceController.ts`, `panelRegistry.ts`, `layoutPersistence.ts`, `commandRouter.ts` |
| `src/components/ui/` | Mã shadcn Nova do generator cung cấp; giữ mặc định |
| `src/features/sales/` | Workspace/list/document, `salesSessionStore.ts`, `salesCommands.ts`, `contracts.ts`, `validation.ts`, `decimal.ts` |
| `src/shared/lookup/` | ProductLookup/useProductLookup và adapter cho lookup header |
| `src/shared/grid/` | Editor adapters và `editorBarrier.ts` |
| `src/ports/` | `salesPort.ts`, `catalogPort.ts` |
| `src/infrastructure/fake/` | Dataset, fake ports, scenario controller |
| `src/lab/` | Host và công cụ chọn scenario ngoài vùng nội dung sản phẩm |
| `tests/{unit,components,e2e}/` | Kiểm tra behavior theo policy |

Không scaffold monorepo/package chung cho một app. Có thể tách file khi một responsibility thực tế lớn lên; đổi đường dẫn thì cập nhật các task tiêu thụ cùng commit.

## 4. Hợp đồng nội bộ dùng chung

Các type dưới đây là **đề xuất app API**, không phải API của Dockview/AG Grid hoặc DTO HTTP hiện có. `SalesSaveSnapshot`, `SalesDocument` và `UiFailure` được định nghĩa ở [Sales Pilot](SALES_PILOT.md).

```ts
type DocumentSessionId = string;
type ClientLineId = string;
type CloseReason = 'tab' | 'middle-click' | 'command' | 'close-all' | 'layout-reset';

interface ValidationIssue {
  code: string;
  field: string;
  message: string;
  clientLineId?: ClientLineId;
}

type PrepareSaveResult =
  | { kind: 'ready'; snapshot: SalesSaveSnapshot; editRevision: number }
  | { kind: 'blocked'; issues: ValidationIssue[] };

type SaveOutcome =
  | { kind: 'saved'; document: SalesDocument }
  | { kind: 'blocked'; issues: ValidationIssue[] }
  | { kind: 'failed'; error: UiFailure }
  | { kind: 'outcome-unknown' };

declare function prepareSave(sessionId: DocumentSessionId): Promise<PrepareSaveResult>;
declare function requestSave(sessionId: DocumentSessionId): Promise<SaveOutcome>;
declare function requestPost(sessionId: DocumentSessionId): Promise<SaveOutcome>;
declare function requestClose(sessionId: DocumentSessionId, reason: CloseReason):
  Promise<'closed' | 'cancelled' | 'blocked'>;
```

`prepareSave` đợi editor đã publish giá trị cuối và store nhận đúng revision trước khi tạo snapshot. Đọc lại React state ngay sau `stopEditing()` không tự chứng minh điều này. Mỗi field/line buffer có chủ sở hữu và đăng ký barrier; không tạo cơ chế event bus toàn hệ thống.

Pending write làm tài liệu liên quan read-only và chặn mutation thứ hai; tài liệu khác vẫn hoạt động. `requestPost` yêu cầu Draft đã lưu và sạch; không âm thầm Save rồi Post. Post thành công được adapter chuẩn hóa thành `SalesDocument` hoặc kết quả có đủ trạng thái/version để thể hiện thành công; việc reload detail lỗi sau đó không đổi thành write thất bại.

## 5. Identity, async và recovery

- Mỗi request chụp fake actor/session generation, documentSessionId, document ID/version và request generation thích hợp.
- Kết quả chỉ áp vào phiên còn hợp lệ. Một lookup cũ không đổi lựa chọn mới; một load cũ không ghi đè draft.
- Dirty tính cả raw text chưa parse được, chưa chọn lại lookup hoặc mới thay đổi checkbox.
- Save/Discard/Cancel là lựa chọn đóng. Discard bỏ được buffer invalid khi không có pending/unknown mutation. Save bị validation giữ phiên mở.
- Không auto retry Create/Update/Post; query retry ở pilot cũng tắt mặc định để kịch bản xác định.
- Timeout/abort sau khi gửi write có thể là `outcome-unknown`. Khóa mutation, giữ phiên và cho người dùng explicit recovery.
- Existing document: Get lại với quyền Read để thu thập trạng thái/version, đối chiếu snapshot bị khóa theo Sales Pilot. Get thành công riêng lẻ không chứng minh write đã kết thúc; đọc version cũ hoặc nội dung mơ hồ vẫn giữ recovery lock. Giữ snapshot gốc để xem lại; không áp nó đè kết quả server. New Create: không có contract request-idempotent; tìm/mở lại qua list và đối chiếu có chủ đích, không khẳng định an toàn tạo lại vì client đã timeout.
- Fake adapter có thể điều khiển outcome để test UI nhưng không công bố operation-status/idempotency endpoint mới của backend.

## 6. Styling và accessibility phục vụ hành vi

Một app theme mode chỉ đổi mode của Nova/Quartz/Dockview. Không đặt font base 14px, thu nhỏ root, resize row bằng CSS thủ công hoặc bắt grid và Dockview có màu/spacing bằng hệt Nova. CSS phục vụ full-height layout, overflow, portal và focus là hợp lệ.

Giữ accessible name, label/error association, focus visible, thứ tự Tab và khả năng thao tác bàn phím. Popup lookup dùng role/ID/aria-activedescendant nhất quán; xử lý composition trước Enter/Escape. Dùng Nova variants sẵn có để báo lỗi/disabled/read-only; lỗi dài có chỗ đọc đầy đủ. Không khóa screenshot pixel cho các giá trị style mặc định.

App layout không cuộn ngang ngoài ý muốn; grid được cuộn hai chiều trong panel. Resize/zoom có thể reflow toolbar, không giấu thao tác cần thiết. Đo viewport trình duyệt, tách khỏi OS scaling khi ghi evidence.

## 7. Lab, phạm vi tương lai và quyết định mở

`/lab/sales` vào thẳng Sales, `/lab/components` chạy editor/lookup harness. App và Lab dùng cùng feature components và cùng provider contracts; scenario controls đặt ngoài panel sản phẩm. Không dựng bản giao diện thứ hai chỉ để demo.

Các quyết định còn ở bước triển khai: bộ package versions tương thích, Node LTS có thể dùng với Vite được chọn, built-in Dockview theme cụ thể, biểu diễn recovery UI và số lượng tab hợp lý theo đo đạc. WEB-01/WEB-06 ghi quyết định và lý do; chúng không đòi mở lại lựa chọn Nova/Community/Dockview.

Chọn HTTP runtime/auth và contract JSON cho `int64`/decimal cần khảo sát backend riêng. Giữ frontend port khác transport wire, không thêm SQL credentials hay dependency server vào bundle. Roadmap đầu kết thúc bằng handoff kỹ thuật; tích hợp thật chỉ trở thành active qua roadmap kế tiếp được chọn rõ.

## 8. Truy vết

- Workspace lifecycle: [Workspace Behavior](WORKSPACE_BEHAVIOR.md), WEB-02/03/07.
- Lookup/editor: [Lookup and Grid Editing](LOOKUP_AND_GRID_EDITING.md), WEB-04/05/07.
- Business/ports/scenarios: [Sales Pilot](SALES_PILOT.md), WEB-01/02/05/06/08.
- Verification và evidence: [Test Policy](../TEST_POLICY.md), [evidence record](../evidence/20261031-web-foundation.md).

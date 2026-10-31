# Lookup sản phẩm và chỉnh sửa grid

Trạng thái: **WEB-04 đã triển khai lookup field/grid/modal harness**. LKP-01–06 có automated evidence, IME/screen reader attended còn PENDING. WEB-05 đã có decimal/header/grid và barrier; xem [evidence](../evidence/20261031-web-foundation.md). Đọc cùng [nền tảng UI](WEB_UI_FOUNDATION.md), [workspace](WORKSPACE_BEHAVIOR.md), [pilot bán hàng](SALES_PILOT.md), [test policy](../TEST_POLICY.md) và [technical baseline](../references/TECHNICAL_BASELINE.md).

## 1. Một đường triển khai

Chọn `@floating-ui/react` trực tiếp cho `ProductLookup`: input controlled, listbox ARIA và một bộ điều khiển vị trí/tương tác. Input và giao diện dùng shadcn/ui Nova mặc định trên Tailwind v4; không ép 14px hoặc density. Base UI tiếp tục phục vụ primitive chung. Không đặt thêm Floating UI quanh positioning/focus của Base UI Combobox: hai chủ sở hữu dễ tranh chấp focus, Escape và vòng đời popup.

Đây là quyết định ứng dụng, không phải khẳng định Floating UI cung cấp combobox hoàn chỉnh. Thư viện cung cấp primitive; ứng dụng chịu trách nhiệm selection, tìm kiếm, accessibility và kiểm thử. Các API dưới đây đã đối chiếu source tài liệu chính thức; phải kiểm tra lại với phiên bản được khóa khi triển khai. [F1]

## 2. State và tìm kiếm

Model đề xuất tách `selectedId`, `displayText`, `query`, `activeOptionId`, `open`, `requestGeneration`. ID là giá trị nghiệp vụ; display là nhãn sản phẩm đã chọn; query là chuỗi đang gõ. Highlight không đồng nghĩa selection.

Gõ tiếp chỉ đổi query và đánh dấu chưa xác nhận. Không suy ID từ nhãn, không tự chọn kết quả đầu tiên. Selection hợp lệ cập nhật ID/nhãn/query cùng một intent. Nút **Xóa lựa chọn** đặt ID null và xóa nhãn/query; xóa ký tự đơn thuần vẫn là query chưa xác nhận. Trường bắt buộc báo lỗi khi không có lựa chọn; query chưa xác nhận chặn Save, kể cả khi còn ID cũ. Có lệnh khôi phục lựa chọn trước để bỏ riêng query đang sửa.

Kết quả async được nhận diện bằng `(sessionId, clientLineId, catalogContext, query, generation)`. Context bao gồm các chiều thực sự ảnh hưởng danh mục/giá trong hợp đồng API. Debounce chỉ trì hoãn request, không trì hoãn cập nhật input. Abort request cũ và kiểm tra toàn bộ khóa khi nhận response; abort riêng lẻ không đủ chống kết quả về muộn. Đổi query/context phải vô hiệu hóa highlight cũ. Loading, rỗng và lỗi có trạng thái riêng; lỗi không xóa selection hay draft. Kết quả phiên A tuyệt đối không cập nhật phiên B.

Giữ nguyên Unicode và chuỗi raw khi nhập tiếng Việt. Trong `compositionstart` đến `compositionend`, không chọn bằng Enter, điều hướng option, format input hoặc phát request từ chữ chưa hoàn tất. Sau composition, lấy giá trị cuối rồi tìm kiếm. Không chặn mọi `keydown`, không sửa giá trị theo từng phím để bỏ dấu.

## 3. Focus, bàn phím và pointer

Input có label, role combobox, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`; popup dùng listbox, mỗi option có ID ổn định và trạng thái selected. Dùng `useListNavigation(context, { virtual: true, ... })` để giữ DOM focus ở input, cập nhật `aria-activedescendant`. Hook yêu cầu ID riêng cho option. Tích hợp qua `useInteractions`, không ghi đè handler trả về bằng spread sai thứ tự. [F1, F3]

Tắt navigation khi composition. `useDismiss` xử lý outside press với `ancestorScroll: false`, `escapeKey: false`; handler Escape của ứng dụng kiểm tra composition và thứ tự popup/grid/dialog. Không biến scroll thành dismiss. [F6]

Trong composition, adapter ngăn Enter/Escape kích hoạt commit/cancel của grid, nhưng giữ xử lý IME của trình duyệt.

| Thao tác | Hành vi đề xuất |
| --- | --- |
| Mũi tên lên/xuống | Mở/di chuyển highlight khi không composition; không đổi ID |
| Enter | Chọn option đang active còn hợp lệ; query tự do không thành sản phẩm. Sales grid áp dụng luồng chốt sang Qty bên dưới |
| Trái/phải, Home/End | Giữ thao tác con trỏ văn bản |
| Tab/Shift+Tab | Field/modal và lookup harness: đóng popup, giữ điều hướng mặc định; không tự chọn highlight. Sales grid: Tab áp dụng luồng chốt bên dưới; Shift+Tab giữ điều hướng ngược |
| Escape khi popup mở | Chỉ đóng popup, giữ query/selection; chặn lan tới grid/dialog |
| Escape khi popup đã đóng | Hủy lần sửa cell theo mặc định grid; không đóng panel |

Yêu cầu Owner vòng 4 cho Product trong Sales grid: Enter hoặc Tab xác nhận active option còn hợp lệ theo query/context/generation, hoặc dùng lựa chọn đã click. Adapter publish session trước khi dừng editor, tìm RowNode bằng clientLineId rồi focus cell Qty cùng dòng; không mở editor Qty. Cả highlight → Enter/Tab và highlight → click → Enter/Tab dùng chung đường chốt. Query tự do/chưa xác nhận hoặc highlight cũ không được suy thành selection; giữ editor/raw để sửa. Composition không chốt; Escape giữ hai tầng. Field/modal không nhận quy tắc chuyển Qty.

Chỉ chặn phím lookup thực sự xử lý. Grid hỗ trợ `suppressKeyboardEvent` hoặc chặn propagation; phải tránh Enter vừa chọn sản phẩm vừa kết thúc editor ngoài ý muốn. Escape của grid mặc định hủy thay đổi, nên lần Escape đầu phải được lookup nhận trước. [G1, G2]

Hủy editor phải khôi phục raw/canonical đầu lần sửa trong session store và công bố editRevision mới; grid tự hủy không đủ.

Chọn pointer phải thắng cuộc đua blur/outside-dismiss. `pointerdown` trong option ghi nhận intent và giữ input focus cho chuột; `click` xác nhận đúng một lần bằng ID cùng generation, kiểm tra lại option còn hợp lệ. Touch phải vẫn cuộn được; không blanket `preventDefault` mọi pointer. Blur đơn lẻ không xóa query hoặc commit selection. Outside click đóng popup và giữ draft, không buộc focus quay lại khi người dùng chuyển trường.

## 4. Popup trong panel và modal

Dùng `useFloating` với `open`, `onOpenChange`, `refs`, `floatingStyles`; middleware theo thứ tự `offset`, `flip`, `shift`, `size`. `size` giới hạn chiều cao theo phần còn trống, đặt chiều rộng theo anchor trong giới hạn host và cho danh sách cuộn. Không tự cộng tọa độ viewport hoặc tạo dropdown absolute bằng CSS tùy ý. [F1, F2]

`FloatingPortal root={overlayHost}` đặt popup trong host của panel đang chứa editor; khi có modal, host nằm **trong** modal đang hoạt động. Không mặc định portal ra body khiến popup nằm ngoài focus scope hoặc trong vùng `inert`. Host phải ở ngoài vùng clipping của nội dung nhưng vẫn thuộc phạm vi sở hữu. `root` là API thư viện đã xác minh; `overlayHost` là contract ứng dụng đề xuất. [F4]

Lookup không tạo focus trap thứ hai. Nếu dùng `FloatingFocusManager`, cấu hình non-modal và `initialFocus={-1}`; modal bên ngoài sở hữu trap. Escape được adapter phối hợp với dialog, không giả định hai thư viện tự chia sẻ cây focus. Phải kiểm tra screen reader, Tab và pointer thực tế. [F3, F5]

Chỉ mount popup khi mở và panel đo được. `whileElementsMounted: autoUpdate` tự đăng ký/cleanup theo vòng đời DOM; nếu giữ DOM và ẩn CSS phải quản lý effect/cleanup riêng. Resize, scroll và layout shift chỉ cập nhật vị trí. Panel thực sự hidden thì tháo popup, giữ buffer. Kích thước tạm thời bằng 0 thì hoãn đo; kích thước trở lại mới định vị. Move panel đổi host phải cleanup host cũ. Không xem resize/move như yêu cầu đóng chứng từ. [F2]

## 5. Tích hợp AG Grid Community

Yêu cầu Owner tại review vòng 3: Qty/UnitPrice hiển thị text ở trạng thái xem; chỉ dựng decimal-string editor khi double-click, Enter/F2 hoặc gõ ký tự. Kết thúc/hủy trả lại cell và focus grid; Tab/Shift+Tab đi qua cả Gift. Raw invalid vẫn thuộc session khi editor không còn mount. Đường điều hướng lỗi phải tìm RowNode bằng clientLineId, lấy rowIndex hiển thị hiện hành sau sort để ensure-visible/focus/mở editor. Không dùng vị trí trong draft.lines làm vị trí grid.

Lookup dạng field giữ label/helper nhìn thấy; actions Xóa/Khôi phục dạng icon cùng hàng input, có tên truy cập/tooltip, dùng button preset. Helper dùng cấp chữ phụ nhỏ hơn và giữ aria association. Validation required/unconfirmed dùng đúng loại danh mục ở UI và barrier; lookup dòng giữ tên sản phẩm. Ghi chú tách label khỏi hàng input/trạng thái; số dòng căn với toolbar, kể cả khi wrap.

Product cell dùng editor inline; danh sách là popup ngoài editor có class `ag-custom-component-popup`. Đây là yêu cầu tài liệu AG Grid để nhận diện popup thuộc editor, không phải giải pháp đầy đủ cho focus modal. Không dùng Rich Select/Formula editor thuộc Enterprise. Text, checkbox và editor có sẵn được ưu tiên khi đáp ứng hợp đồng dữ liệu và giữ draft. [G1, G3]

React custom editor nhận `value`, gọi `onValueChange`; tài liệu nêu giá trị được áp dụng khi editing kết thúc. Không coi callback đó hoặc `stopEditing()` là xác nhận ứng dụng đã xuất bản snapshot mới. `stopEditingWhenCellsLoseFocus` cũng không thay thế luồng Save. [G1, G2]

Buffer nằm trong session store theo `(sessionId, clientLineId, field)`, gồm raw, editRevision, composition và lỗi; không sống duy nhất trong component/grid. Mỗi input ghi buffer trước khi yêu cầu render. Unmount chỉ gỡ đăng ký editor, không xóa buffer. Editor có sẵn chỉ được nhận vào luồng này khi adapter chứng minh giữ được lần nhập cuối qua hide/move; không đọc DOM bằng selector làm contract. Qty/UnitPrice cần editor chuỗi riêng do yêu cầu decimal.

## 6. Barrier trước Save và Close

API **do ứng dụng đề xuất**, theo [contract chuẩn](WEB_UI_FOUNDATION.md):

```ts
declare function prepareSave(
  sessionId: DocumentSessionId
): Promise<PrepareSaveResult>;
type PrepareSaveResult =
  | { kind: "ready"; snapshot: SalesSaveSnapshot; editRevision: number }
  | { kind: "blocked"; issues: ValidationIssue[] };
```

Barrier tuần tự hóa intent trong một session; chặn sửa mới trong lúc chuẩn bị snapshot. Nó đọc buffer mới nhất, kiểm tra composition/query/decimal, yêu cầu editor kết thúc sửa hợp lệ, rồi đợi acknowledgement rằng commit tương ứng đã được công bố vào session store. Cuối cùng kiểm tra editRevision và toàn bộ draft, trả snapshot bất biến. Nếu editRevision đổi trước khi khóa có hiệu lực, đọc lại; không trả snapshot cũ. Editor đã unmount thì session adapter vẫn parse/công bố buffer hợp lệ độc lập và đợi acknowledgement; không phụ thuộc instance grid.

Buffer sai hoặc composition chưa kết thúc trả `blocked`, giữ nguyên raw và chỉ dẫn cell cần sửa. Không âm thầm lấy giá trị cũ khi grid từ chối lần nhập mới. React setter không đổi ngay biến state hiện tại; `setState(); stopEditing(); save(state)` không phải barrier. Không dùng timeout tùy ý để đoán commit hoàn tất. [R1]

**Save** và **Save rồi đóng** dùng cùng barrier. Chỉ gửi snapshot `ready`; chỉ đóng khi lưu thành công. **Discard** hủy được buffer sai mà không validation; **Cancel** giữ nguyên session/buffer/panel. Hide/move không gọi Discard.

Coordinator khóa chỉnh sửa trong request. Kết quả xác định chưa commit mới cho sửa/thử lại; kết quả chưa rõ khóa sửa/đóng/Discard và chuyển recovery theo [pilot](SALES_PILOT.md).

## 7. Dòng bán và decimal

Mỗi dòng có `clientLineId` độc lập; sản phẩm được lặp, không dùng ProductId/row index làm khóa. Tối đa 200 dòng. Qty decimal(18,4) thuộc `(0, 99999999999999.9999]`; UnitPrice decimal(19,4) thuộc `[0, 999999999999999.9999]`.

Canonical `Decimal4` là string đúng bốn chữ số thập phân; đây là shape **LOCAL PORT**, không cam kết HTTP contract MyDmsVn hiện tại. Tính bằng BigInt có scale như [pilot](SALES_PILOT.md); không qua `Number`, `parseFloat` hay IEEE floating point.

Raw giữ cả chuỗi nhập dở. Parser nhận một dấu `,` hoặc `.` thập phân, cấm phân nhóm/exponent. Chuẩn hóa zero dư (`1.23000 → 1.2300`); từ chối phần lẻ dư khác zero, không làm tròn để đạt điều kiện nhập. Validate precision/range trước commit. `lineAmount = round4(Qty × UnitPrice)`, điểm giữa ra xa 0: `1.23445 → 1.2345`. Quà tặng giữ UnitPrice, amount `0.0000`; bỏ quà tặng tính lại. Backend kiểm tra lại.

## 8. File dự kiến và nghiệm thu

Lookup/adapter đã có ở WEB-04; decimal/barrier đã có ở WEB-05: `src/shared/lookup/ProductLookup.tsx`, `src/shared/lookup/useProductLookup.ts`; `src/shared/grid/ProductLookupCellEditor.tsx`, `DecimalCellEditor.tsx`, `editorBarrier.ts`. Test ở `tests/unit/lookup/*` và `tests/e2e/lookup-grid.spec.ts`.

| ID | Kịch bản bắt buộc | Runtime |
| --- | --- | --- |
| LKP-01 | ID/query/display, clear và query chưa xác nhận | PASS WEB-04 (harness) |
| LKP-02 | Response đảo thứ tự, đổi context, hai session | PASS WEB-04 (harness) |
| LKP-03 | Gõ từng phím tiếng Việt, composition + Enter | Automated PASS WEB-04; attended PENDING |
| LKP-04 | Keyboard, Escape hai tầng, pointer/blur và touch scroll | PASS WEB-04 (harness) |
| LKP-05 | Portal trong modal, inert, focus, accessibility | Automated PASS WEB-04; attended PENDING |
| LKP-06 | Resize/scroll/move, zero size, hide/show, cleanup | PASS WEB-04 (harness) |
| EDT-01 | Gõ ký tự cuối rồi Save ngay; snapshot đúng editRevision | PASS WEB-05; regression fake port WEB-06 PASS |
| EDT-02 | Raw sai qua hide/move/unmount; Save bị chặn | PASS WEB-05; regression fake port WEB-06 PASS |
| EDT-03 | Close Save/Discard/Cancel, lỗi lưu giữ draft | PASS WEB-05; regression fake port WEB-06 PASS |
| EDT-04 | Decimal biên, rounding, quà tặng, sản phẩm lặp, 200 dòng | PASS WEB-05; regression fake port WEB-06 PASS |

## Nguồn chính thức

Đối chiếu source ngày 2026-10-31 (Asia/Bangkok); upstream có thể thay đổi. Quy tắc nghiệp vụ/barrier là thiết kế ứng dụng.

- [F1: Floating UI React](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/react.mdx), [useFloating](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/useFloating.mdx).
- [F2: autoUpdate](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/autoUpdate.mdx), [size](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/size.mdx).
- [F3: useListNavigation](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/useListNavigation.mdx).
- [F4: FloatingPortal](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/FloatingPortal.mdx).
- [F5: FloatingFocusManager](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/FloatingFocusManager.mdx).
- [F6: useDismiss](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/useDismiss.mdx).
- [G1: AG Grid editors](https://github.com/ag-grid/ag-grid/blob/026e1513b7620fd01faa8e68a106609c5c0e4439/documentation/ag-grid-docs/src/content/docs/cell-editors/index.mdoc), [React contract](https://github.com/ag-grid/ag-grid/blob/026e1513b7620fd01faa8e68a106609c5c0e4439/documentation/ag-grid-docs/src/content/docs/cell-editors/_component-interface-react.mdoc).
- [G2: Start/stop editing](https://github.com/ag-grid/ag-grid/blob/026e1513b7620fd01faa8e68a106609c5c0e4439/documentation/ag-grid-docs/src/content/docs/cell-editing-start-stop/index.mdoc).
- [G3: Provided editors](https://github.com/ag-grid/ag-grid/blob/026e1513b7620fd01faa8e68a106609c5c0e4439/documentation/ag-grid-docs/src/content/docs/provided-cell-editors/index.mdoc).
- [R1: React useState](https://github.com/reactjs/react.dev/blob/main/src/content/reference/react/useState.md).

Cột Tặng giữ provided CheckboxCellRenderer, editable=false; wrapper riêng của cột căn checkbox giữa hai trục, bao gồm checked/unchecked/disabled và resize.

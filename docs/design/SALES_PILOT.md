# Sales pilot và fake async ports

**Trạng thái:** đặc tả cho triển khai, runtime **NOT RUN**. Phạm vi là frontend và fake adapter. Nguồn nghiệp vụ: [MyDmsVn Direct Sales](https://github.com/chung6a8m/MyDmsVn/blob/5b9f960ee4048581f107e9ee6350e1dfad462b53/docs/DIRECT_SALES.md) và [Contracts](https://github.com/chung6a8m/MyDmsVn/blob/5b9f960ee4048581f107e9ee6350e1dfad462b53/docs/CONTRACTS.md). Đọc với [Foundation](WEB_UI_FOUNDATION.md), [Workspace](WORKSPACE_BEHAVIOR.md), [Lookup/Editing](LOOKUP_AND_GRID_EDITING.md).

## 1. Màn hình và hành vi

Một Sales list có filter ngày, khách hàng, kho, nhân viên, trạng thái, sản phẩm và search. Mở một chứng từ vào document panel Dockview; chứng từ mới có session riêng. List dùng cursor trước/sau, không có số trang/total count bắt buộc. Fake adapter lọc toàn dataset trước khi phân trang; Product filter kiểm tra tồn tại dòng tương ứng nhưng tổng tiền vẫn tính tất cả dòng của chứng từ. Thứ tự Sale ID giảm dần; thay filter đặt lại cursor. Trang mặc định 25 mục là lựa chọn pilot, không phải tuyên bố giới hạn API hiện tại.

Header gồm ngày, khách hàng, kho, nhân viên bắt buộc; ghi chú tối đa 1.000 ký tự, từ chối NUL. Ngày là calendar date `yyyy-MM-dd`, không chuyển timezone/UTC. Catalog đang active dùng cho chọn mới; nhãn của tham chiếu cũ vẫn đọc được ở chứng từ đã lưu/Posted.

| Cột | Hợp đồng |
|---|---|
| STT | Thứ tự hiển thị 1..N, read-only |
| Sản phẩm | Lookup; cùng sản phẩm được lặp ở nhiều dòng |
| Đơn vị tính | Read-only; snapshot trả về sau Save, không nhận unit từ client làm chân lý |
| Số lượng | Lớn hơn 0, decimal(18,4) |
| Đơn giá bán | Người dùng nhập, không âm, decimal(19,4) |
| Tặng | Giữ đơn giá khi bật/tắt; bật thì thành tiền bằng 0 |
| Thành tiền | `round4(qty * unitPrice)` hoặc 0 khi Tặng; backend authoritative |

1–200 dòng khi lưu. Một dòng có giá 0 không tự thành quà tặng. Mỗi dòng có `clientLineId`, khác Product ID và ID dòng backend. Save response được reconcile theo mapping snapshot sang dòng trả về; không de-dup và không remount mọi row sau Create.

Save giữ Draft; Post chỉ dùng Draft đã lưu và sạch, có version và quyền Post. Thay đổi chưa lưu phải được lưu riêng trước Post. Posted read-only qua chuột, bàn phím, paste và checkbox; không có unpost, return, payment hoặc receivables.

Draft cost/profit là null. Posted cost/profit lấy từ kết quả giả lập có gắn nhãn demo; không tính COGS hay ghi ledger trong trình duyệt. Moving Average là nghiệp vụ server được giữ làm định hướng tích hợp, không được coi là đã kiểm chứng bởi fake Post.

## 2. Biểu diễn dữ liệu chính xác

Các kiểu sau là **hợp đồng port nội bộ frontend**, không phải JSON wire hiện có:

- `ServerId = string`: decimal positive integer string cho ID backend; không đi qua JS number nếu có thể vượt safe integer. Client session/line ID là chuỗi riêng, không gửi như server ID.
- `Decimal4 = string`: chuỗi decimal invariant không exponent, chuẩn hóa đúng 4 chữ số lẻ, ví dụ `"1.2500"`.
- `CalendarDate = string`: kiểm tra ngày thật, dạng `yyyy-MM-dd`.
- `VersionToken = string`: opaque, không so sánh số hoặc tự sinh ngoài fake adapter.

Qty tối đa `99999999999999.9999`; UnitPrice tối đa `999999999999999.9999`; LineAmount/TotalAmount phải vừa decimal(28,4). Chỉ làm tròn kết quả nhân/cộng theo hợp đồng; không làm tròn một input sai scale thành input hợp lệ. Số 0 ở cuối phần lẻ dư được normalize, ví dụ `1.23000` thành `1.2300`; `1.23001` bị từ chối.

Editor chấp nhận một dấu `,` hoặc `.` làm dấu thập phân; không nhận dấu phân nhóm hàng nghìn, exponent hoặc chuỗi có cả hai dấu. Hiển thị trợ giúp cạnh field khi cần. `1.234` được hiểu là 1 + 234/1000; không tự biến thành 1234. Raw rỗng/dấu đang gõ được giữ trong buffer nhưng chưa là giá trị lưu hợp lệ.

Triển khai pilot bằng BigInt fixed scale 10.000 hoặc thư viện decimal đã xác minh. BigInt là lựa chọn mặc định để tránh thêm dependency: parse bằng chuỗi, range-check integer đã scale, nhân ở scale 10^8 và làm tròn về 10^4 với tie away from zero. JSON không chứa BigInt; port nhận Decimal4 string. Tổng là tổng các lineAmount đã round, kiểm tra overflow tổng.

Ví dụ nghiệm thu: `1.0001 × 0.5000 = 0.50005`, lineAmount `0.5001`; gift thành `0.0000` nhưng unitPrice vẫn `0.5000`. Giá trị biên và vượt biên phải có test; không dùng `Number`, `parseFloat` hoặc `toFixed` làm số học authoritative.

## 3. Shapes và ports đề xuất

`src/features/sales/contracts.ts` sở hữu type nghiệp vụ; `src/ports/` chỉ khai báo port. Field/type dưới đây là nguồn chuẩn cho roadmap.

```ts
interface SalesLineDraft {
  clientLineId: ClientLineId;
  saleLineId: ServerId | null;
  productId: ServerId | null;
  qty: Decimal4;
  unitPrice: Decimal4;
  isGift: boolean;
}
interface SalesSaveSnapshot {
  saleId: ServerId | null;
  expectedVersion: VersionToken | null;
  saleDate: CalendarDate;
  customerId: ServerId;
  warehouseId: ServerId;
  employeeId: ServerId;
  note: string;
  lines: readonly SalesLineDraft[];
}
interface ReferenceSummary {
  id: ServerId;
  code: string;
  name: string;
  isActive: boolean | null; // null khi nguồn đọc không cung cấp trạng thái
}
interface SalesDocument {
  saleId: ServerId;
  saleNumber: string;
  version: VersionToken;
  status: 'Draft' | 'Posted';
  saved: SalesSaveSnapshot;
  references: {
    customer: ReferenceSummary;
    warehouse: ReferenceSummary;
    employee: ReferenceSummary;
  };
  lines: readonly (SalesLineDraft & {
    product: ReferenceSummary;
    unit: string;
    lineAmount: Decimal4;
    costAmount: Decimal4 | null;
  })[];
  totalAmount: Decimal4;
  totalCost: Decimal4 | null;
  grossProfit: Decimal4 | null;
}
interface UiFailure {
  kind: 'validation' | 'forbidden' | 'conflict' | 'not-found' | 'unavailable';
  code: string;
  message: string;
  issues?: readonly ValidationIssue[];
}
type ReadResult<T> = { kind: 'success'; value: T }
  | { kind: 'failed'; error: UiFailure };
type WriteResult<T> = ReadResult<T> | { kind: 'outcome-unknown' };
interface PortContext {
  actorKey: string;
  actorGeneration: number;
  signal: AbortSignal;
}
interface SalesPort {
  list(query: SalesListQuery, context: PortContext): Promise<ReadResult<SalesPage>>;
  get(saleId: ServerId, context: PortContext): Promise<ReadResult<SalesDocument>>;
  save(snapshot: SalesSaveSnapshot, context: PortContext): Promise<WriteResult<SalesDocument>>;
  post(input: { saleId: ServerId; expectedVersion: VersionToken },
    context: PortContext): Promise<WriteResult<SalesDocument>>;
}
```

`SalesListQuery` sở hữu optional `fromDate`, `toDate`, `customerId`, `warehouseId`, `employeeId`, `productId`, `status`, `search`, `cursor`; `pageSize` là integer. `SalesPage` gồm `items` (saleId, saleNumber, saleDate, status, totalAmount), `nextCursor`, `previousCursor`; không bắt buộc totalCount. Cursor của fake phải bị ràng buộc với filter, không giả lập offset nhảy trang dưới tên keyset.

`CatalogPort.search(query, context): Promise<ReadResult<readonly LookupOption[]>>` nhận `kind: 'product' | 'customer' | 'warehouse' | 'employee'`, `search: string`, `limit: number` (pilot 25). `LookupOption` gồm `id`, `code`, `name`, `isActive`, `unit?` (product). Cùng một lookup behavior được tái dùng qua adapter; không tạo bốn popup controllers khác nhau. Selected display có thể giữ option cũ khi result list thay đổi.

`SalesDocument.references` và `lines[].product` là dữ liệu đọc bắt buộc để mở/restore chứng từ; ID phải khớp với các ID trong snapshot. Nhãn không phụ thuộc cache lookup hoặc việc reference có nằm trong 25 kết quả tìm kiếm. Reference inactive vẫn hiển thị ở chứng từ đã lưu; eligibility cho lựa chọn mới lấy từ catalog, không suy từ nhãn hoặc `isActive: null`. Summary chỉ phục vụ hiển thị, không nằm trong request Save. Fake Get/Save/Post đều trả đủ summary; HTTP handoff sau này phải xác minh nguồn mapping thực.

`clientLineId` trong port là metadata frontend: Save response phải giữ mapping từ snapshot, kể cả sản phẩm trùng. Khi nhận Get, session reconciler tái dùng clientLineId hiện có theo `saleLineId`; chỉ cấp ID mới cho dòng chưa có trong phiên. Một phiên mới cấp bộ clientLineId riêng. Không dùng clientLineId do lần materialize/cache khác tạo ra để remount dòng đang sửa.

`SalesDocument.saved` là baseline authoritative cho lần sửa tiếp theo: `saleId` khớp ID ngoài cùng và `expectedVersion` bằng `SalesDocument.version` vừa nhận. Không giữ expectedVersion cũ của request thành baseline sau Save. `saved.lines` và read-side `lines` cùng thứ tự/danh tính và giá trị nghiệp vụ; read-side chỉ bổ sung dữ liệu hiển thị/tính toán.

Snapshot có `clientLineId` để fake adapter/reconciliation; wire adapter tương lai phải map sang DTO backend, loại metadata UI và ghi mapping line index → clientLineId khi gửi. Không gửi unit, amount, cost, status, number hoặc actor trong business request để client tự quyết định. `PortContext.actorKey` chỉ là fake scenario context; backend thật lấy actor từ phiên được xác thực.

Port trả `SalesDocument` sau Post để pilot đơn giản. API MyDmsVn hiện chỉ trả xác nhận Post với identity/status/time/version; handoff phải quy định cách merge xác nhận và reload detail riêng. Reload detail thất bại không biến Post đã xác nhận thành thất bại hoặc cho Post lại.

## 4. Mutation và recovery

Quyền giả lập gồm Read, Write, Post độc lập, tương ứng các key `Sales.Receipts.Read`, `.Write`, `.Post`. Nút/keyboard/editor đều tôn trọng trạng thái; fake port cũng kiểm tra để test đường bypass UI. Đây không phải kiểm thử security production.

Mỗi phiên có một mutation đang chạy; khóa sửa của tài liệu đó trước chụp snapshot tới khi resolve. Các phiên khác độc lập. Known failure chỉ cho retry bằng hành động người dùng sau xử lý lỗi; không tự gửi lại. Fake mutation có mode `commit-then-response-lost` để kiểm chứng unknown, không chỉ giả lập lỗi trước commit.

- **Update/Post unknown:** giữ session cùng snapshot bất biến đã gửi, khóa mutation/close/Discard; cho explicit Get để thu thập bằng chứng. Get trả version cũ không chứng minh write sẽ không commit về sau; version mới riêng lẻ cũng có thể do tác nhân khác. Read bị từ chối, lỗi hoặc kết quả mơ hồ đều giữ recovery lock, không unlock theo timeout.
- **Bằng chứng dương tính trong pilot:** Update chỉ đề nghị đối soát khi Get có version khác expectedVersion và toàn bộ business fields/line order của snapshot đã gửi khớp dữ liệu lưu; Post chỉ đề nghị đối soát khi cùng Sale ID đã Posted. Hiển thị snapshot gốc cạnh bản đọc, yêu cầu người dùng xác nhận dùng trạng thái authoritative đó; không tuyên bố xác định tác nhân nào đã commit. So khớp bỏ qua metadata UI và các field server sinh. Nếu không đủ điều kiện thì giữ lock. Fake port phải thực thi optimistic concurrency theo expectedVersion để request cũ không thể ghi đè version mới; handoff HTTP phải kiểm chứng lại tiền đề này.
- **Create unknown:** giữ dữ liệu gốc; cho mở list và xem chứng từ ứng viên qua Get, đối chiếu rồi chọn liên kết thủ công có xác nhận. Không tự chọn ứng viên đầu tiên hoặc suy cùng nội dung là cùng request. Query trả rỗng/lỗi hoặc có nhiều ứng viên chưa xác định không cho Create lại; phiên tiếp tục bị khóa. Trường hợp mutation gốc trả `failed` với bằng chứng chắc chắn chưa commit là known failure, không phải một lối thoát ẩn cho mutation đã trả `outcome-unknown`.
- Không tạo operation-status endpoint hay hứa idempotency backend. Fake scenario controller có thể giải phóng delayed response từ ngoài vùng sản phẩm để test, nhưng sản phẩm chỉ dùng public port.

## 5. Lab scenarios và acceptance

`/lab/sales` dùng cùng Sales components với app, có `scenario` query allowlist. Dataset xác định có ít nhất 30 chứng từ để kiểm tra cursor, product lặp/gift, tên tiếng Việt và tên dài. Có cap 200 dòng; chạy 201 dòng phải bị chặn. Seed ID/value/version cố định; không dùng dữ liệu khách hàng thật.

| ID | Kịch bản / assertion |
|---|---|
| SAL-01 | Happy path tạo Draft, sửa, Save, Post; returned identity/version và Posted read-only |
| SAL-02 | Bảy cột đúng thứ tự; sản phẩm lặp vẫn độc lập; bật/tắt gift giữ giá |
| SAL-03 | Decimal precision/range/tie/overflow; canonical strings không mất số |
| SAL-04 | Header/date/line validation; lỗi fieldless vẫn thấy; lỗi lines[index] về đúng clientLineId của snapshot |
| SAL-05 | Read-only/deny Write/deny Post; cả editor và command đều bị chặn đúng |
| SAL-06 | Hai phiên và response đảo thứ tự; đổi focus/theme không retarget mutation |
| SAL-07 | Double Save/Post chỉ một request mỗi intent đang pending; known failure giữ draft |
| SAL-08 | Update/Post commit rồi mất response; Get version cũ trước eventual commit, Get bị deny/lỗi hoặc version mới không khớp đều giữ lock; đối soát bằng chứng dương tính không retry mutation |
| SAL-09 | Create unknown không tự tạo lại khi list rỗng/lỗi hoặc nhiều ứng viên; chỉ liên kết ứng viên sau Get + đối chiếu + xác nhận, còn lại giữ recovery lock |
| SAL-10 | Keyset/filter/Product: đổi filter reset cursor, thứ tự ổn định, tổng đủ mọi dòng |
| SAL-11 | 200 dòng, dòng thứ 201; input cuối rồi Save; lỗi một dòng không xóa dòng khác |
| SAL-12 | Unit/reference thay đổi hoặc version conflict: yêu cầu reload/review, không tự đổi số lượng/đơn giá; mở lại/restore reference inactive ngoài trang search vẫn có nhãn và không cho chọn mới |

Tất cả scenario **NOT RUN** tại lần tạo tài liệu. Scenario control phải có cách chủ động resolve/reject request, không sleep dài hoặc random timing. Chỉ dùng response của fake public ports để quyết định trạng thái trong sản phẩm.

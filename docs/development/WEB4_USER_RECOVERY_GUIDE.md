# WEB4 — Hướng dẫn bản nháp và đối soát thao tác

**Phạm vi:** F05 / WEB4-06, bàn giao hành vi đã triển khai trong WEB4-04 và đã nghiệm thu giới hạn tại WEB4-05. Tài liệu này không bật tính năng mới hoặc cấp phép production. [Plan sở hữu trạng thái](../plans/20261101-002-web4-reliability-web.md) · [evidence F05](../evidence/web4/20261102-f05-operator-handoff.md) · [thiết kế sở hữu policy](../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md).

## 1. Đọc đúng thông báo trước khi tiếp tục

| Thông báo hoặc tình huống | Ý nghĩa và việc cần làm |
|---|---|
| **Đã lưu bản nháp trên thiết bị** | Snapshot đã lưu cục bộ, chưa chứng minh Save/Post lên máy chủ. Chỉ phần đã hoàn tất lưu cục bộ được phục hồi; những phím vừa gõ có thể chưa kịp lưu. |
| **Đang lưu bản nháp trên thiết bị…** | Chờ lưu hoàn tất trước khi dựa vào khả năng khôi phục. |
| **Chưa lưu được bản nháp trên thiết bị** | Giữ trang đang mở. Làm theo mục 3; không coi nội dung trong RAM là đã an toàn sau reload. |
| **Kết quả chưa rõ** / thao tác chưa đối soát | Máy chủ có thể đã ghi chứng từ. Giữ khóa, dùng **Kiểm tra kết quả** theo mục 4. Không tạo lại chứng từ hoặc Post lần nữa. |
| **Bản nháp xung đột với phiên khác** | Có dữ liệu mới ở phiên khác; giữ nội dung đang mở, đối chiếu theo mục 2. Không tự chọn bản mới nhất theo giờ lưu. |

Save/Update lưu chứng từ trên máy chủ; Post ghi sổ nghiệp vụ. Post cần chứng từ Draft đã lưu và sạch. Bản nháp trên thiết bị, bố cục tab và kết quả máy chủ là ba dữ liệu khác nhau.

## 2. Mở lại bản nháp sau reload hoặc mở trình duyệt

1. Truy cập đúng địa chỉ ứng dụng, đăng nhập đúng tài khoản và chờ xác minh quyền/cơ sở dữ liệu. Ứng dụng không cho xem bản nháp offline bằng tài khoản chưa được xác thực.
2. Chọn **Bản nháp trên thiết bị**, sau đó **Đọc lại danh sách** nếu cần. Kiểm tra loại Sales/Phiếu nhập, ID chứng từ hoặc “Chứng từ mới”, thời điểm lưu và cảnh báo chưa đối soát.
3. Chọn **Mở bản nháp** của bản cần làm tiếp. Đây là hành động mở nội dung cục bộ, không gửi Create/Save/Post. Raw text chưa hợp lệ và lookup chưa chọn vẫn cần người dùng kiểm tra; không suy rằng dữ liệu đã được chuẩn hóa.
4. Nếu có nhiều bản cho cùng chứng từ, đối chiếu từng bản và dữ liệu máy chủ bằng quyền hiện tại. Ứng dụng không tự gộp hoặc ghi đè. Phiên bản gốc có thể đã cũ; khi gặp conflict phải xử lý theo mục 7, không sửa version cục bộ để ép Save.
5. Nếu có marker thao tác chưa rõ kết quả, chuyển sang mục 4. Nếu bản ghi bị cách ly hoặc không mở được, giữ dữ liệu gốc và chuyển người phụ trách; không sửa JSON để bỏ marker.

Danh sách chỉ thuộc tài khoản và database epoch hiện tại, theo quyền module hiện tại. Bản nháp đang mở không được mở thành phiên thứ hai từ danh sách. Hai tab cùng tài khoản không phải cơ chế đồng bộ tự động; khi một tab báo conflict, giữ cả nội dung cần đối chiếu. Trước khi đóng tab phụ, kiểm tra bản nháp và thao tác chưa rõ kết quả của tab đó.

## 3. Lỗi lưu cục bộ, quota và sao chép có xác nhận

**Trước khi gửi mutation:** nếu lưu cục bộ thất bại thì Save/Post bị chặn. Có thể tiếp tục nhập trong RAM hoặc xem dữ liệu được phép, nhưng chưa được bảo đảm phục hồi sau reload. Không có chế độ bỏ qua IndexedDB để gửi trực tiếp.

1. Giữ trang và nội dung đang nhập. Kiểm tra dung lượng thiết bị và quyền cho website lưu dữ liệu trong trình duyệt; nếu policy của tổ chức chặn thì nhờ người phụ trách xử lý.
2. Nếu muốn giải phóng dữ liệu trong ứng dụng, vào **Bản nháp trên thiết bị**. Chỉ chọn **Xóa bản nháp này** khi đã kiểm tra bản đó không còn cần giữ và không có thao tác chưa đối soát; đọc cảnh báo mất nội dung chưa gửi rồi chọn **Xác nhận xóa** hoặc **Giữ bản nháp**. Đây không phải thao tác xóa chứng từ trên máy chủ. Lỗi xóa phải được xử lý, không được coi là đã dọn xong.
3. Trở lại tab đang gặp lỗi, mở **Bản nháp trên thiết bị** và chọn **Thử lại lưu cục bộ**. Chỉ tiếp tục Save/Post sau khi lưu cục bộ thành công và ứng dụng cho phép. Nút này không phải gửi lại HTTP mutation.
4. Nếu cần giữ bản sao, đánh dấu **Tôi hiểu bản sao có dữ liệu kinh doanh nhạy cảm; chỉ dán ở nơi được phép.**, rồi chọn **Sao chép bản nháp đang mở**. Chỉ dán ở nơi được tổ chức cho phép. Nếu trình duyệt từ chối clipboard hoặc không tạo được snapshot, chọn và sao chép riêng nội dung trong ô đang nhập. Bản sao không phải chứng từ đã lưu và không phải payload để tự gửi HTTP.

Không dùng “xóa toàn bộ dữ liệu website”, xóa IndexedDB hay đổi browser profile như cách sửa quota khi còn nội dung cần giữ hoặc UNKNOWN. Không sửa/xóa operation record bằng DevTools. Khi lỗi blocked/versionchange do tab khác, chỉ đóng các tab đã kiểm tra an toàn rồi thử lại; không đóng trang duy nhất còn giữ dữ liệu trong RAM.

**Sau khi đã gửi mutation:** lỗi lưu trên thiết bị không chứng minh máy chủ hủy thao tác. Giữ UNKNOWN và dùng **Kiểm tra kết quả**. Trong cùng phiên, ứng dụng có thể lưu lại bằng chứng dương tính đã nhận mà không gọi lại HTTP; sau reload cần đối soát status. Nếu ứng dụng thông báo kết quả đã lưu trên thiết bị và yêu cầu tải lại, chỉ làm theo thông báo đó sau khi bảo toàn nội dung cần giữ ở các tab khác.

## 4. Save/Post mất phản hồi hoặc còn UNKNOWN

1. Không Save/Post lại, không tạo bản sao nghiệp vụ mới để thay thế và không xóa bản nháp. Đóng tab, đóng nhóm, reset layout hoặc đăng xuất có admission sẽ không bỏ qua khóa này.
2. Nếu đã reload, mở đúng bản nháp theo mục 2. Trong phiên đang mở, chọn **Đối soát thao tác** hoặc **Bản nháp trên thiết bị**.
3. Ghi lại loại chứng từ, **Mã thao tác**, **Cơ sở dữ liệu** (epoch), thời điểm gặp lỗi và **Mã hỗ trợ** nếu hiển thị. Thông tin ở preview được ghi rõ là chưa xác minh; bản thân mã thao tác không chứng minh đã commit.
4. Chọn **Kiểm tra kết quả**. Đây là đối soát được người dùng yêu cầu; không gửi lại Create/Update/Post. Chờ kết quả và thực hiện theo bảng dưới.

| Kết quả | Xử lý |
|---|---|
| Bằng chứng COMMITTED hợp lệ, đúng intent và đã lưu local thành công | Ứng dụng áp kết quả có thẩm quyền. Create/Update nhận ID/version/line identity gốc; Post thành công giữ Posted chỉ đọc. Không tạo thêm thao tác để “bù”. |
| Không có kết quả, 404, timeout, lỗi mạng/5xx | Giữ UNKNOWN. Có thể chủ động kiểm tra lại khi kết nối ổn định; nếu vẫn chưa rõ, chuyển người phụ trách. Không có dòng status không phải bằng chứng rollback. |
| Hết phiên/401 hoặc mất quyền/403 | Xác thực lại đúng tài khoản khi được yêu cầu; người phụ trách kiểm tra quyền hiện tại. Không đổi sang tài khoản khác để mở bản nháp của người trước. UNKNOWN không tự hết vì đăng nhập lại. |
| Kết quả hết hạn hoặc chỉ còn tombstone, thiếu kết quả gốc/version | Giữ khóa và chuyển người phụ trách. Hết hạn payload không cho tái sử dụng key. Xác nhận nghiệp vụ đã commit không tự cung cấp một version có thể sửa. |
| Sai epoch, fingerprint, operation ID, loại lệnh, target hoặc checkpoint; payload cục bộ bị thiếu/hỏng | Giữ khóa, không áp kết quả hay tự sửa hash/ID. Chuyển người phụ trách theo mục 5. |

Ứng dụng kiểm tra frozen request và tính lại fingerprint, so với danh tính trong status và scope hiện tại trước khi settle. “COMMITTED” từ một thao tác khác không giải quyết thao tác này. Việc tìm thấy chứng từ trong danh sách/Get chỉ hỗ trợ đối chiếu, không thay protected operation status để tự mở khóa.

### Gửi lại cùng key hiện chưa được bật

Candidate hiện tại không có chức năng **Gửi lại đúng thao tác này**. Không dùng curl, DevTools, test fixture hoặc key mới để làm thay. Một tính năng gửi lại có xác nhận chỉ được triển khai sau khi backend đã chứng minh gate crash/Commit, serialization, tombstone/expiry, quyền và epoch; khi đó phải dùng đúng key và immutable payload gốc. Hướng dẫn này không cấp quyền kích hoạt tính năng đó.

## 5. Chuyển người phụ trách đối soát

Gửi qua kênh hỗ trợ nội bộ được phép: mã sự cố của tổ chức, thời điểm và múi giờ, module, Create/Save/Post, mã thao tác/epoch/mã hỗ trợ đang hiển thị, ID chứng từ nếu có, thông báo lỗi và việc đã thử **Kiểm tra kết quả**. Nếu UI không có mã hỗ trợ, người phụ trách cấp mã hồ sơ; không tự coi operation ID là kết luận nghiệp vụ. Không gửi mật khẩu, Bearer token, cookie/refresh, connection string, HAR/trace hay dump toàn bộ IndexedDB. Bản sao raw draft chỉ chia sẻ khi cần và qua kênh được phép.

Người phụ trách theo [B06 operator handoff](https://github.com/chung6a8m/MyDmsVn/blob/7be9ee3b45ac54bc3c7d642038fc77cf794ea944/docs/development/WEB4_OPERATOR_HANDOFF.md): xác minh actor + epoch + fingerprint, quyền hiện tại, journal/tombstone và chứng từ/dòng/version/stock/value/COGS bằng công cụ bảo trì được cấp quyền. Không suy NOT_EXECUTED từ 404, không có journal hoặc việc chưa thấy chứng từ. Chứng cứ chưa đủ thì ghi kết quả **UNKNOWN**, mã hồ sơ, người chịu trách nhiệm và bước đối soát kế tiếp; giữ client khóa.

Hiện không có UI operator unlock hoặc terminal NOT_EXECUTED để tự giải phóng phiên. Một cơ chế đó trong tương lai cần fence độc quyền và tombstone CANCELLED/DO_NOT_EXECUTE durable chặn request đến muộn; không được thay bằng xóa local marker. Không duplicate Post hoặc sửa trực tiếp ledger để giải quyết ticket. Nếu backend đã xác nhận commit nhưng client không thể phục hồi an toàn, hồ sơ phải ghi rõ kết quả nghiệp vụ và trạng thái client vẫn khóa; bàn giao xử lý tiếp, không tuyên bố đã mở khóa.

## 6. Bố cục cũ, database epoch và nâng cấp

Layout chỉ giữ bố cục/tab, không chứa raw draft. Layout v1/v2 chỉ biết actor, có thể chứa ID chứng từ của database khác: WEB4 không tự import chúng. Ứng dụng dùng bố cục mặc định an toàn, giữ bytes cũ và cho mở lại chứng từ từ danh sách có quyền của database hiện tại. Không sao chép ID từ layout cũ hay đổi key để ép khôi phục.

Layout v3 và bản nháp được tách theo epoch + actor. Khi clone, restore/rewind hoặc thay database, operator phải rotate epoch theo [quy trình host](https://github.com/chung6a8m/MyDmsVn/blob/473c6bfc39ca545c945a2387f1c644ff361a2132/src/MyDmsVn.Server.HttpHost/README.md#web4-coordinated-mode-and-migration-procedure) và B06. Restart host thông thường không phải lý do rotate epoch. Bản nháp/UNKNOWN thuộc epoch cũ không được chuyển sang database mới, kể cả cùng URL và numeric userId; việc không còn thấy chúng không chứng minh đã xóa bytes hay đã rollback. Ghi hồ sơ unresolved trước chuyển đổi và để operator xử lý trong đúng scope.

**Đặt lại bố cục** và **Khôi phục bố cục** đều qua admission đóng tài liệu; Cancel giữ dữ liệu, Save cần thành công, Discard chỉ áp khi an toàn. UNKNOWN chặn reset/close. Reset layout không phải reset database bản nháp hay đối soát operation.

Local database hiện là `mydmsvn-drafts-v1`, IndexedDB version 1, record schema v1; đây không phải schema12 của máy chủ. Bản ghi hỏng hoặc phiên bản chưa hỗ trợ bị cách ly, không bulk-delete/normalize. Không có công cụ migration/import bản nháp do người dùng chạy. Nâng cấp sau này phải validate và chuyển atomically theo [policy schema evolution](../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md#102-allowlist-validation-và-schema-evolution), giữ bản gốc khi lỗi. Không hạ phiên bản asset hoặc sửa schemaVersion để đọc cưỡng bức.

## 7. Quyền, version và lỗi riêng từng nghiệp vụ

| Trường hợp | Hành vi và hướng xử lý |
|---|---|
| Create/Update có Write nhưng không có Read | Kết quả gốc được Write cho phép chứa detail/version/server line IDs; status vẫn kiểm tra quyền hiện tại. Không bắt buộc gọi Get để tạo bằng chứng và không coi Get403 là write thất bại. |
| Sales Post | Ack gốc có version; Posted chỉ đọc. Không lấy version từ một chứng từ khác hoặc tự tạo version. |
| Goods Receipt Post | Ack không có version. Posted vẫn chỉ đọc; không gán version trước Post thành version mới và không đổi về Draft vì Get403. |
| Validation khi gửi lần đầu | Sửa field được báo sau khi ứng dụng đã xác nhận rejection và cho phép sửa. Sales có thể lặp Product/Gift; Receipt yêu cầu Product duy nhất. Giữ decimal chính xác và ngày chứng từ, không làm tròn raw text để vượt lỗi. |
| NotFound / ConcurrencyConflict / AlreadyPosted của Update/Post | Xem lại chứng từ bằng quyền được cấp, đối chiếu dữ liệu local/server; không ghi đè version hoặc tạo Post khác. Nếu không có quyền đọc hoặc chưa đủ bằng chứng, chuyển người phụ trách. |
| Lỗi auth, deployment, idempotency hoặc response không hợp lệ sau dispatch | Không coi là business rejection chắc chắn. Khi ứng dụng còn UNKNOWN, quay lại mục 4. Negative status sau một UNKNOWN không được dùng như rejection của lần gửi đầu. |

Quyền do máy chủ quyết định; bản nháp không khôi phục quyền cũ. Logout được admit có thể dọn bản clean; dirty/UNKNOWN không có TTL tự xóa. Nếu cleanup báo lỗi thì bytes có thể còn trên thiết bị dù auth đã bị vô hiệu. Không hứa đăng xuất đã xóa toàn bộ dữ liệu; tài khoản/epoch khác không được thấy preview.

## 8. Bàn giao release và giới hạn nghiệm thu

Operator phối hợp frontend assets với backend chế độ `web4` và schema12 theo B06/host runbook, ghi SHA/hash artifacts và corpus [web4-v1 provenance](../../tests/fixtures/web4-v1/provenance.json). Không trộn client WEB4 với host legacy-web11 hay fallback unkeyed. Chuẩn bị bản sao lưu, danh sách UNKNOWN đang theo dõi, admission/migration/restricted-principal/epoch checks và kế hoạch phục hồi trước một rollout được Owner cho phép riêng. Tài liệu không chạy các bước đó hoặc cho phép deploy.

[F04 evidence](../evidence/web4/20261102-f04-failure-pilot.md) giữ bằng chứng pilot IIS Express HTTPS/SQL và Chromium/Edge đã được chấp nhận. [Pilot runbook](WEB4_PILOT_RUNBOOK.md) chỉ dành cho fixture fresh nonproduction; không dùng làm thao tác hỗ trợ trên database đang chạy. Full IIS/production, real process-crash/Commit, bật same-key resend và attended Telex/VNI/Narrator của candidate vẫn NOT RUN/chưa được chấp thuận. F05 là kiểm tra tài liệu, không tạo runtime PASS mới.

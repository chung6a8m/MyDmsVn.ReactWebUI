# WEB4 — Durable Draft & Operation Recovery design (proposed)

**Owner:** MyDmsVn.ReactWebUI. **Status:** PROPOSED F01/F02/F03 technical baseline, NOT implemented or browser-tested. **Date:** 01/11/2026. [F roadmap](../plans/20261101-002-web4-reliability-web.md); backend owns [atomic journal/HTTP canonical contract](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB4_IDEMPOTENCY_JOURNAL_CONTRACT.md). Đọc cùng [WEB3 Workspace ownership](WEB3_MULTI_MODULE_WORKSPACE.md), [WEB3 Receipt/Inventory](WEB3_GOODS_RECEIPT_INVENTORY_UI.md), [WEB2 auth](WEB2_FRONTEND_INTEGRATION.md) và [WEB4 matrix](../development/WEB4_WEB_ACCEPTANCE.md).

## 1. Ba trạng thái không thể trộn lẫn

1. **User draft (local):** nội dung chưa chắc đã Save lên server, gồm raw text/lookup chưa commit/dirty. IndexedDB chỉ bảo đảm snapshot đã commit vào local database; không chứng minh server đã ghi.
2. **Operation intent (local):** một Create, Update hoặc Post sau Save barrier với immutable operationId/request payload và bản ghi đã persist trước khi dispatch. Intent đang UNKNOWN không phải thất bại, không được tự retry.
3. **Authoritative business result (server):** DTO/ack thực sự nhận được hoặc trạng thái COMMITTED đọc từ backend journal bằng authenticated actor và quyền hiện tại. Chỉ bằng chứng dương tính mới được kết thúc UNKNOWN; Status 404, timeout, 403 hoặc không có connection KHÔNG chứng minh không commit.

Không dùng layout persistence của Dockview để chứa 1–3; Dockview chỉ giữ descriptor/module/recordId. Nếu tab bị remove/readd khi move/split thì feature session và local draft vẫn được sở hữu bởi app.

## 2. Đề xuất IndexedDB v1 — data classification và key

Tên database đề xuất: mydmsvn-drafts-v1, version1. IndexedDB object stores dự kiến:
- drafts: key actorKey + module + stable localDocumentId; version, created/updated, baseline serverId/version/status, sanitized feature draft, rawBuffers, lookupBuffers, clientLineIds, editRevision, localPersistSequence và trạng thái dirty/unknown. Server ID phải giữ dưới dạng string chính xác, không convert qua Number.
- operations: key actorKey + operationId; module, session local ID, method/resourceKey, frozen business request/fingerprint reference, kind, expectedVersion (opaque), dispatch state, original local draft sequence and authoritative result *metadata* when checked. Không lưu JWT, refresh token, SQL credentials, passwords, authorization headers hoặc serialized response vô hạn.
- metadata (optional): schema/migration hints and per-actor cleanup state; không chứa auth snapshot/permissions làm nguồn đáng tin cậy.

**ActorKey bắt buộc lấy từ /me đã được authSession authoritative adoption**, không lấy actor nào trong restored payload. ActorGeneration là fence của runtime hiện tại, không persist rồi tin vào một generation cũ. Hiển thị bản local chỉ sau bootstrap + server capability load; cùng user ở session mới có thể xem preview local nếu policy cho phép, user khác tuyệt đối không được render. Không tạo database cho Lab production nếu chưa được bật trong composition. App offline không được bypass auth để xem protected local draft từ user trước.

## 3. Capture, durability và barrier

Feature adapter xuất một minimal typed draft snapshot; không serialize nguyên Zustand store, functions, DOM nodes, QueryClient, AbortController hoặc Workspaces. Giữ draft line identity bằng clientLineId ổn định, kể cả Sales cho phép Product trùng và Gift, Receipt Update thay server line IDs; raw decimal/text/composition và committed lookup phải giữ đủ để người dùng tiếp tục nhập. Validate schema/version/size/length và clone frozen snapshot khi lưu. Không silent normalize/round decimal hoặc thay đổi documentDate timezone.

Zustand store cập nhật đồng bộ khi gõ; persistence có coalescing/queue bounded và monotonic revision, thực hiện IndexedDB readwrite transaction và chỉ báo "đã lưu bản nháp trên thiết bị" sau transaction complete. Có flush awaited trên các đường close/admission an toàn, trước mutation dispatch, khi explicitly save draft, reset/layout, logout/dispose. On visibilitychange/pagehide flush best-effort; browser crash có thể mất các phím sau transaction cuối. Không hứa write-ahead hoàn hảo của mọi keystroke; đo và thông báo pending/failed persistence.

Khi gửi Create/Save/Post: hoàn tất editor barrier, freeze canonical outbound snapshot, generate GUIDv4 mới theo intent, persist **operation + source draft checkpoint** atomically in ONE IndexedDB transaction; chỉ sau IDB completion mới gọi HTTP. Khi Save/Create response thành công, update journal-local marker và server baseline, rồi thanh lý bản thảo đúng sau positive reconciliation. Nếu IDB unavailable/quota fail trước dispatch thì không gửi mutation trong durable mode và thông báo rõ lý do; người dùng còn có thể xem/edit local memory khi phiên chưa mất, nhưng không được tuyên bố durable.

## 4. Restore state machine và UI hành vi

Proposed local states:
~~~text
EDITOR_ONLY -> DRAFT_DURABLE -> INTENT_DURABLE
INTENT_DURABLE -> DISPATCHED -> ACK_RECEIVED -> SETTLED
                            \-> OUTCOME_UNKNOWN
OUTCOME_UNKNOWN -> STATUS_COMMITTED -> SETTLED
                \-> STATUS_ABSENT/DENIED/UNAVAILABLE -> OUTCOME_UNKNOWN
~~~
State "DISPATCHED" phải được persist trước network call; browser crash giữa persist và actual dispatch là ambiguity thật. Không coi "chưa nhận response" là SQL rollback. Không auto retry even if status 404. Một intent đã bị chỉnh payload/expectedVersion cần operation ID khác, nhưng chỉ sau khi unknown hiện tại được xử lý đúng chính sách.

Sau reload:
1. Bootstrap auth + authoritative /me/capability, fence mọi stale response, lấy đúng actor scope.
2. Enumerate local drafts/operations của actor, validate schema và kiểm tra migration/version; unknown records phải được giữ khóa.
3. Hiển thị review UI: module, document ID nếu biết, last durable timestamp, thay đổi chưa lưu, pending/unknown state; lựa chọn Mở bản nháp, Đối chiếu kết quả, Hủy (chỉ nếu không có pending unknown), không tự bật Save/Post.
4. Với operation UNKNOWN: GET /api/v1/operations/{operationId} bằng bearer; phía server chỉ trả nếu quyền hiện tại đủ và cùng actor. COMMITTED thì consume minimal ack/durable response, respect current Read constraints; nếu unavailable/403/404 giữ unknown và phản hồi dễ hiểu, không tạo version hay re-POST.
5. On known Posted, read-only terminal và invalidate chỉ affected stock queries; nếu Get403 thì không degrade về Draft và không tự fetch bằng quyền không có. On successful Update khi status chỉ có summary nhưng thiếu version thì không mở edit đến khi có authorized detail/positive version; không bịa rowversion.
6. Khi local baseline xung đột server revision, giữ nguyên cả local raw và server state trong review, không tự overwrite/dedup/sort line IDs. User quyết định sau khi được xác nhận quyền, không dùng index làm identity.

Component gợi ý: feature-owned "Local draft recovery" status + scoped dialog/panel dùng Nova/Base UI, accessible keyboard, không tạo theme hoặc generic ERP state framework. Đừng để route/restore bất ngờ bật modal khi đang composing/đóng panel. Toast/Alert chỉ báo kết quả thực, không dùng nhãn "đã gửi lại".

## 5. Cross-tab, actor, permission, lifecycle

- Cùng một user/tab khác: có thể có hai bản local cùng document. Dùng per-document revision/lease (navigator.locks nếu có, IDB compare revision) để tránh silent overwrite, hiển thị conflict. Không coi browser local lock là backend exactly-once; SQL journal là quyết định cuối. Nếu Web Locks không khả dụng, fail-safe review/merge chứ không silent last-writer-wins.
- Actor swap/log out/refresh failure: không render private draft từ actor cũ; cancel pending status/query, clear memory/QueryClient, áp dụng explicit purge/on-device retention policy khi logout. JWT localStorage được xử lý bởi authSession hiện hữu, không sao chép JWT vào IndexedDB. Session mới cùng actor vẫn yêu cầu auth lại trước preview.
- CEX/WinForms khác process không chia sẻ IndexedDB; không giả định desktop sử dụng WEB4 journal nếu Local không có operation metadata. Không đổi desktop schema/admission từ web state.
- Document close/close-all/layout reset: dùng existing shared admission; refuse disposal khi preparation/pending/unknown chưa an toàn. Biết local IDB committed draft không có nghĩa có thể bỏ qua Save/Discard/Cancel. Inventory read-only panel không cần draft/operation và không tự nhận global Save command.
- Query invalidation: giữ logic observeInventoryPosts để cancel outdated read, invalidate/refetch sau committed Post hoặc recovered Posted; không invalidate do status absent. Query key actor/generation phải tách quyền/phiên; giữ filter và source navigation của F05.

## 6. Dữ liệu nhạy cảm, retention và lỗi IndexedDB

Dữ liệu nhập kho/bán hàng có thể chứa thông tin thương mại và khách hàng; local IndexedDB không phải nơi lưu bí mật an toàn trước XSS, extension hoặc user dùng chung Windows profile. Không tự tuyên bố mã hóa local bằng khóa JS là bảo vệ khỏi XSS. Giữ tối thiểu trường cần phục hồi, mô tả rõ lưu trên thiết bị và nút Xóa bản lưu; không ghi secrets, headers, cookies, complete access bearer, unfiltered server response hoặc audit data vào database/log.

Quy tắc đề xuất: bản đã SETTLED và clean được xóa khi safe; stale drafts khác cần user-review/retention policy, còn UNKNOWN tuyệt đối không auto purge chỉ vì cũ. Nếu schema mới unsupported/corrupt: quarantine bản ghi (không render dữ liệu như trusted), báo lỗi/cho xóa có xác nhận, không làm mất mọi records bằng bulk delete. Trường hợp private mode, IDB denied, quota exhausted, IDB transaction abort, page crash, multi-tab invalidation, version upgrade đều có test riêng. Không restore server account/permissions từ snapshot local.

## 7. HTTP integration, strict parsing và no-replay

Backend sở hữu [v1 operation protocol](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB4_IDEMPOTENCY_JOURNAL_CONTRACT.md). Frontend ports chỉ gửi header cho sáu mutation sau F01/B04 pin, query GET readback cho recovery; không gửi idempotency key cho GET bình thường, không trả retry option cho HTTP writes, không cho service worker tái gửi. Dùng crypto.randomUUID() sau xác nhận môi trường HTTPS, không dùng Math.random. Captured payload/hash phải giữ exact str decimal, route ID string, expectedVersion token, Product/line order. Khác một ký tự là intent mới.

Khẳng định status COMMITTED chỉ khi JSON/header đúng canonical schema và current actor generation/session unchanged; return 401 -> existing refresh rules, nhưng refresh replay chỉ **GET status**, không bao giờ tự POST. Server trả 403 khi mất quyền thì dừng và yêu cầu người dùng được cấp quyền để đối soát; unknown vẫn protected.

Không thay silent API/error contract WEB2/WEB3. Không có fake backend success trong production. Unknown operation is a durable review obligation, not a request queue.

## 8. Bằng chứng nghiệm thu theo đúng ranh giới

Unit adapter: monotonic revision, serializer/snapshot, schema migration, corrupt records, quotas, concurrency, status decode and actor fencing. Component: Save barrier latest raw, lookup caret/Tab, duplicate Gift, Receipt no duplicate Product, close admission, inventory refetch. Playwright real IndexedDB: type key-by-key → persist → reload → restore exact buffers; dirty Sales cạnh Receipt unknown; two tabs; logout different actor; explicit readback with controlled responses.

Real pilot after backend B05: Web production build, same-origin TLS, SQL schema12 restricted principal, fresh Chromium/Edge DBs, correct operation status, exactly-once source/ledger/valuation and frozen COGS. Backend SQL oracle độc lập với client computed values. Final approval không bao gồm full IIS/production, audit retention/distributed limiter, current attended Telex/VNI/Narrator. Tất cả test phải ghi thực chạy và candidate.


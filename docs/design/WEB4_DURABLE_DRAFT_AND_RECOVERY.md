# WEB4 — Durable Draft & Operation Recovery design

**Owner:** MyDmsVn.ReactWebUI. **Status:** F01 local boundary và backend wire/fingerprint đã pin tại B01 `1c603c6`; xem provenance ở checkpoint. F02 implemented/verified candidate: [task evidence](../evidence/web4/20261102-f02-durable-drafts.md); F03 selected next, not yet accepted. Historical F01 proposal sections below remain checkpoint context. [F01 source/consumer checkpoint](../development/WEB4_F01_SOURCE_CHECKPOINT.md) ghi source và các gate còn thiếu. **Date:** 01/11/2026. [F roadmap](../plans/20261101-002-web4-reliability-web.md); backend owns [atomic journal/HTTP canonical contract](https://github.com/chung6a8m/MyDmsVn/blob/1c603c6ac57e59a3f7b4bc6ca976b2d531c079aa/docs/design/WEB4_IDEMPOTENCY_JOURNAL_CONTRACT.md). Đọc cùng [WEB3 Workspace ownership](WEB3_MULTI_MODULE_WORKSPACE.md), [WEB3 Receipt/Inventory](WEB3_GOODS_RECEIPT_INVENTORY_UI.md), [WEB2 auth](WEB2_FRONTEND_INTEGRATION.md) và [WEB4 matrix](../development/WEB4_WEB_ACCEPTANCE.md).

## 1. Ba trạng thái không thể trộn lẫn

1. **User draft (local):** nội dung chưa chắc đã Save lên server, gồm raw text/lookup chưa commit/dirty. IndexedDB chỉ bảo đảm snapshot đã commit vào local database; không chứng minh server đã ghi.
2. **Operation intent (local):** một Create, Update hoặc Post sau Save barrier với immutable operationId/request payload và bản ghi đã persist trước khi dispatch. Intent đang UNKNOWN không phải thất bại, không được tự retry.
3. **Authoritative business result (server):** DTO/ack thực sự nhận được hoặc trạng thái COMMITTED đọc từ backend journal bằng authenticated actor và quyền hiện tại. Chỉ bằng chứng dương tính mới được kết thúc UNKNOWN; Status 404, timeout, 403 hoặc không có connection KHÔNG chứng minh không commit.

Không dùng layout persistence của Dockview để chứa 1–3; Dockview chỉ giữ descriptor/module/recordId. **Persisted layout vẫn có server document IDs, nên phải được scope theo deployment epoch thay vì actorKey đơn lẻ.** Nếu tab bị remove/readd khi move/split thì feature session và local draft vẫn được sở hữu bởi app.

## 2. IndexedDB v1 — local data classification và key (F01 checkpoint)

Tên database cho F02: mydmsvn-drafts-v1, database version 1; từng record có schemaVersion 1. Đây là local schema, không phải wire schema B01. IndexedDB object stores:
- drafts: key deploymentEpoch + actorKey + module + stable localDocumentId; version, created/updated, baseline serverId/version/status, sanitized feature draft, rawBuffers, lookupBuffers, clientLineIds, editRevision, localPersistSequence và trạng thái dirty/unknown. Server ID phải giữ dưới dạng string chính xác, không convert qua Number.
- operations: key deploymentEpoch + actorKey + operationId; module, session local ID, **frozen original method, route/resource, request payload, expectedVersion**, canonical fingerprint reference (locally stored digest is NOT authority), kind, dispatch state, original local draft sequence and server-origin result identity *metadata* when checked. Recompute SHA-256 with B01 vectors from original frozen command before readback; validate hash against saved digest and server identity. Không lưu JWT, refresh token, SQL credentials, passwords, authorization headers hoặc serialized response vô hạn.
- metadata (optional): schema/migration hints and per-actor cleanup state; không chứa auth snapshot/permissions làm nguồn đáng tin cậy.

**ActorKey bắt buộc lấy từ /me đã được authSession authoritative adoption và deploymentEpoch từ authenticated `GET /api/v1/operations/context` (B01 pin); bắt buộc `actorUserId` khớp current `/me.userId`, `contractVersion` là `web4-v1` và scope/generation chưa đổi**, không lấy actor/epoch từ restored payload. ActorGeneration là fence của runtime hiện tại, không persist rồi tin vào một generation cũ. Hiển thị bản local chỉ sau bootstrap + server capability load; cùng user ở session mới có thể xem preview local nếu policy cho phép, user khác tuyệt đối không được render. Không tạo database cho Lab production nếu chưa được bật trong composition. App offline không được bypass auth để xem protected local draft từ user trước.

### 2.1 Workspace layout v3 — epoch-aware presentation restore

Current source anchors (not yet implemented): `src/app/workspace/workspaceLayouts.ts` stores `mydmsvn.workspace.layout.v2:<actorKey>`, falls back to `v1:<actorKey>`, and invokes `openRestored` with persisted document server IDs; `layoutPersistenceV2.ts` stores only `scope: {actorKey}` and `layoutPersistence.ts`/documentContracts currently fence actor/generation but not deployment epoch. A safe draft in IndexedDB does not prevent an old layout from opening a same-numbered document in a different database.

F01 selects and F02 must implement an epoch-and-actor-scoped **v3** layout key `mydmsvn.workspace.layout.v3:<encodedDeploymentEpoch>:<encodedActorKey>` and strict envelope with scope epoch+actor and a versioned schema. The in-memory panel registry, close admission, restore, `sameActorScope`, async `openRestored` and HTTP read results must be fenced by **current authenticated deployment epoch + actor/generation**, not userId alone. Obtain epoch from backend after verified auth **before reading any layout or invoking document loads**. If same actorKey but epoch changes, bump effective scope generation, stop applying stale responses and show a safe default layout.

**Legacy actor-only v1/v2 data is not safe to auto-migrate:** it lacks database identity. Never automatically deserialize/re-import old serverId descriptors into epoch-aware v3, and do not silently delete prior layout bytes. Ignore/quarantine old layout and use safe defaults; optional manual reopen must go through a fresh authorized current-database document list, not blind saved IDs. Preserve previous-epoch UNKNOWN records for operator-guided resolution, never send them to the new database. The epoch and header contract is planned WEB4 behavior, not an existing `authSession` implementation. B01/B04 must also validate the epoch against current SQL database for all writes/status GET: local layout fencing alone does not stop a delayed old tab request.

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
State "DISPATCHED" phải được persist trước network call; browser crash giữa persist và actual dispatch là ambiguity thật. Không coi "chưa nhận response" là SQL rollback. Không tự động retry kể cả khi status 404; user-confirmed same-key resend chỉ theo safety contract đã chứng minh, không dùng key mới. Một intent đã bị chỉnh payload/expectedVersion cần operation ID khác, nhưng chỉ sau khi unknown hiện tại được xử lý đúng chính sách.

Sau reload:
1. Bootstrap auth + authoritative /me/capability và **server-authenticated deployment/database epoch**, fence mọi stale response, lấy đúng actor + epoch scope **trước khi đọc IndexedDB và mọi persisted Workspace layout**; khi epoch thay đổi, không restore bất kỳ v1/v2 actor-only document ID.
2. Enumerate local drafts/operations của actor, validate schema và kiểm tra migration/version; unknown records phải được giữ khóa.
3. Hiển thị review UI: module, document ID nếu biết, last durable timestamp, thay đổi chưa lưu, pending/unknown state; lựa chọn Mở bản nháp, Đối chiếu kết quả, Hủy (chỉ nếu không có pending unknown), không tự bật Save/Post.
4. Với UNKNOWN: GET status bằng Bearer và đúng epoch/actor/current permission. COMMITTED phải trả authoritative original Write detail cho Create/Update (version, line IDs), Sales Post acknowledgement **có version**, Receipt Post **không version**; không cần thêm Read để xác nhận kết quả đã được Write/Post cho phép. Nếu unavailable/expired/403/404 giữ UNKNOWN, không bịa version hay tự re-POST; chỉ có user-confirmed same-ID exact-intent resend dưới các SQL/tombstone/permission gates mới được phép.
5. On known Posted, read-only terminal và invalidate chỉ affected stock queries; nếu Get403 thì không degrade về Draft và không tự fetch bằng quyền không có. On successful Update khi status chỉ có summary nhưng thiếu version thì không mở edit đến khi có authorized detail/positive version; không bịa rowversion.
6. Khi local baseline xung đột server revision, giữ nguyên cả local raw và server state trong review, không tự overwrite/dedup/sort line IDs. User quyết định sau khi được xác nhận quyền, không dùng index làm identity.

Component gợi ý: feature-owned "Local draft recovery" status + scoped dialog/panel dùng Nova/Base UI, accessible keyboard, không tạo theme hoặc generic ERP state framework. Đừng để route/restore bất ngờ bật modal khi đang composing/đóng panel. Toast/Alert chỉ báo kết quả thực, không dùng nhãn "đã gửi lại".

## 5. Cross-tab, actor, permission, lifecycle

- Cùng một user/tab khác: có thể có hai bản local cùng document. Dùng per-document revision/lease (navigator.locks nếu có, IDB compare revision) để tránh silent overwrite, hiển thị conflict. Không coi browser local lock là backend exactly-once; SQL journal là quyết định cuối. Nếu Web Locks không khả dụng, fail-safe review/merge chứ không silent last-writer-wins.
- Deployment epoch change / actor swap / log out / refresh failure: không render private draft từ actor cũ; cancel pending status/query, clear memory/QueryClient, áp dụng explicit purge/on-device retention policy khi logout. JWT localStorage được xử lý bởi authSession hiện hữu, không sao chép JWT vào IndexedDB. Session mới cùng actor vẫn yêu cầu auth lại trước preview.
- CEX/WinForms khác process không chia sẻ IndexedDB; không giả định desktop sử dụng WEB4 journal nếu Local không có operation metadata. Không đổi desktop schema/admission từ web state.
- Document close/close-all/layout reset: dùng existing shared admission; refuse disposal khi preparation/pending/unknown chưa an toàn. Biết local IDB committed draft không có nghĩa có thể bỏ qua Save/Discard/Cancel. Inventory read-only panel không cần draft/operation và không tự nhận global Save command.
- Query invalidation: giữ logic observeInventoryPosts để cancel outdated read, invalidate/refetch sau committed Post hoặc recovered Posted; không invalidate do status absent. Query key actor/generation phải tách quyền/phiên; giữ filter và source navigation của F05.

## 6. Dữ liệu nhạy cảm, retention và lỗi IndexedDB

Dữ liệu nhập kho/bán hàng có thể chứa thông tin thương mại và khách hàng; local IndexedDB không phải nơi lưu bí mật an toàn trước XSS, extension hoặc user dùng chung Windows profile. Không tự tuyên bố mã hóa local bằng khóa JS là bảo vệ khỏi XSS. Giữ tối thiểu trường cần phục hồi, mô tả rõ lưu trên thiết bị và nút Xóa bản lưu; không ghi secrets, headers, cookies, complete access bearer, unfiltered server response hoặc audit data vào database/log.

Quy tắc đề xuất: bản đã SETTLED và clean được xóa khi safe; stale drafts khác cần user-review/retention policy, còn UNKNOWN tuyệt đối không auto purge chỉ vì cũ. Nếu schema mới unsupported/corrupt: quarantine bản ghi (không render dữ liệu như trusted), báo lỗi; chỉ cho xóa draft không có unresolved operation với xác nhận theo §10.4, không làm mất mọi records bằng bulk delete. Trường hợp private mode, IDB denied, quota exhausted, IDB transaction abort, page crash, multi-tab invalidation, version upgrade đều có test riêng. Không restore server account/permissions từ snapshot local.

## 7. HTTP integration, strict parsing và no-replay

Backend sở hữu [v1 operation protocol](https://github.com/chung6a8m/MyDmsVn/blob/1c603c6ac57e59a3f7b4bc6ca976b2d531c079aa/docs/design/WEB4_IDEMPOTENCY_JOURNAL_CONTRACT.md). Frontend ports gửi `Idempotency-Key` + `X-MyDmsVn-Deployment-Epoch` cho sáu mutation theo B01/B04 pin; GET status dùng `X-MyDmsVn-Deployment-Epoch` + `X-MyDmsVn-Operation-Fingerprint` (rehash từ frozen command, **không** dùng idempotency key trên GET). Backend xác minh epoch theo current SQL DB trước khi mutation/status; chỉ có frontend actor/epoch matching không đủ chống stale tab. Không auto retry HTTP writes hoặc service worker submit. Dùng crypto.randomUUID() sau xác nhận môi trường HTTPS, không dùng Math.random. Captured payload/hash phải giữ exact str decimal, route ID string, expectedVersion token, Product/line order. Hash phân biệt mọi semantic change theo B01 normalization. Whitespace/object-key order/decimal lexeme tương đương có thể cùng hash; omitted note = null nhưng khác empty. Không thay frozen original payload kể cả hash tương đương, không tái dựng intent từ UI-mapped baseline.

Khẳng định status COMMITTED chỉ khi JSON/header đúng canonical schema, server-owned `operationId/kind/method/routeScope/originalRequestTargetId/fingerprint/epoch` (originalRequestTargetId is null for Create; created document ID only in the outcome) **khớp frozen intent vừa rehash** và current actor generation/session/epoch unchanged; return 401 -> existing refresh rules, nhưng refresh replay chỉ **GET status**, không bao giờ tự POST. Server trả 403 khi mất quyền thì dừng và yêu cầu người dùng được cấp quyền để đối soát; unknown vẫn protected.

Không thay silent API/error contract WEB2/WEB3. Không có fake backend success trong production. Unknown operation is a durable review obligation, not a request queue.

## 8. Review corrections — deployment namespace, absent operation, storage failure

**Deployment namespace.** Browser origin does not uniquely identify a SQL database. Numeric userId is not a cross-database identifier. Backend B01/B03 must issue an authenticated, opaque deployment/database epoch stored in Web schema12, stable across app workers/restarts and privileged-rotated after database clone into another deployment, replacement or history rewind/restore. IndexedDB keys include epoch + authoritative actor. If server epoch differs from the saved record, never render/submit that record; hold or quarantine it for explicit operator-guided disposal. Do not derive epoch from database name, connection string or localStorage.

**Crash before dispatch.** Persisting intent into IndexedDB before HTTP creates a real ambiguity: server status 404 might mean never sent, rolled back or another worker still committing. 404 is NOT rollback proof. Default is UNKNOWN. Once backend B03/B04 passes transactional same-key serialization, delayed original vs second request, key-tombstone expiry, current auth/epoch proof, UI may offer a separate **user-confirmed 'Gửi lại đúng thao tác này'** with identical operationId and immutable original request; never a newly generated key, automatic request, background timer or service-worker replay. If safety prerequisites are missing, status expired/tombstoned, permissions revoked or payload unavailable, keep UNKNOWN and provide an operator-assisted reconciliation path.

**Original result matters.** Create and Update status must recover the original authorized Write result with correct version and server line identities, even if document Read is absent. Sales Post returns its original version; Goods Receipt Post has no version. An expired/minimal status does not make an editable document safe: show a bounded confirmation and require further authorized/operator reconciliation, never synthesize a rowversion or post-commit Get.

**Product storage-failure policy.** If IndexedDB is denied, at quota, aborts or is unavailable **before** Save/Post dispatch, block the mutation; permit RAM editing and read-only views with explicit visible error, retry local persistence action, quota/cleanup guidance and a user-initiated copy of selected content with commercial-data warning. Never silently downgrade to memory-only writes. If IDB fails after dispatch, do not erase or claim settled unknown operations; use known ID for readback/operator reconciliation, not automatic replay. Tests must cover pre-dispatch error, mid-flight failure and failed logout purge separately.

**Operator-assisted reconciliation UI.** Nếu status expired/tombstoned, mất quyền hoặc full Create/Update result/version không còn, UI phải tiếp tục khóa mutation/Edit và hiển thị operation ID + support correlation ID đã làm sạch, loại chứng từ và deployment epoch (không lộ secret). Operator được ủy quyền phải đối chiếu current actor/epoch/fingerprint, journal/tombstone, nguồn chứng từ, ledger, valuation, cost và in-flight/lock state theo backend B06. Chỉ positive authorized result mới cho settle; status 404, không có dòng journal hoặc người dùng tự xóa draft không đủ để giải khóa. Trường hợp result đã committed nhưng thiếu version, UI có thể xác nhận trạng thái đã commit nhưng không mở Edit khi chưa có version authoritative; không tự viết mới.

**Protected status proof.** A successful GET response is not automatically the result of the currently open draft. (1) Validate frozen original method/route/resource/body/version; (2) recompute SHA-256 with backend-pinned canonical wire corpus (don't trust stored hash); (3) reject a corrupted local hash; (4) send the rederived expected fingerprint and current deployment epoch in headers; (5) strict-parse server-owned operationId/kind/method/routeScope/**original requestTargetId** (null for Create)/fingerprint/epoch and keep resultDocumentId separate and compare all fields with local frozen intent; (6) recheck current actor/generation/epoch and document editRevision before SETTLED or inventory invalidation. Missing payload, mismatched or stale metadata, failed epoch header, wrong document, corrupted local digest or late status => remain UNKNOWN, no new write, no unlock. F01 consumes the authoritative B01 corpus rather than inventing a TS interpretation.


**Pilot staging.** B05-A backend fixture/oracle after B04, F04-A browser specs after F03 using B05-A contract, then B05-B/F04-B jointly run final browser+SQL acceptance on exact candidate commits. These checkpoints do not create new task status owners.

## 9. Bằng chứng nghiệm thu theo đúng ranh giới

Unit adapter: monotonic revision, serializer/snapshot, **strict layout v3 epoch scope and v1/v2 non-migration**, corrupt records, quotas, concurrency, protected status digest/metadata decode and actor+epoch fencing. Component: Save barrier latest raw, lookup caret/Tab, duplicate Gift, Receipt no duplicate Product, close admission, inventory refetch. Playwright real IndexedDB: type key-by-key → persist → reload → restore exact buffers; dirty Sales cạnh Receipt unknown; two tabs; logout different actor; explicit readback with controlled responses.

Real pilot after backend B05: Web production build, same-origin TLS, SQL schema12 restricted principal, fresh Chromium/Edge DBs, correct operation status, exactly-once source/ledger/valuation and frozen COGS. Backend SQL oracle độc lập với client computed values. Final approval không bao gồm full IIS/production, audit retention/distributed limiter, current attended Telex/VNI/Narrator. Tất cả test phải ghi thực chạy và candidate.

## 10. Quyết định local lifecycle tại F01 (chưa triển khai)

Phần này chốt lựa chọn phía Web trong phạm vi đã chọn; consume protocol backend đã pin và không tự triển khai F02. Source mapping và codec proposal nằm ở [F01 checkpoint](../development/WEB4_F01_SOURCE_CHECKPOINT.md), kết quả kiểm tra nằm ở [F01 evidence](../evidence/web4/20261101-web4-01-contract.md).

### 10.1 Identity và record ownership

| Identity | Nguồn, thời hạn và cách sử dụng |
|---|---|
| deploymentEpoch | Backend authoritative context sau auth; không phải biến `epoch` nội bộ của authSession hiện nay, JWT sid, origin hoặc database name. Ổn định qua host restart; operator rotate khi clone/replace/rewind. B01 chốt `GET /api/v1/operations/context`, lowercase nonnil GUID và server `actorUserId`/`contractVersion`; B04 implementation chưa có. |
| actorKey | Numeric userId đã được server `/me` xác nhận, chỉ có nghĩa trong epoch đó. Không đọc actor từ local record rồi nhận làm current user. |
| localDocumentId / documentSessionId | Identity ứng dụng ổn định cho một local draft, độc lập server ID và panel renderer. Restore giữ liên hệ với localDocumentId; chỉ có một live session nhận record đó trong một runtime. Generation/request counters được cấp mới bởi runtime, không nạp lại từ record. Dockview có thể remap panel ID mà không đổi owner draft. |
| clientLineId | Identity dòng ổn định trong local snapshot/raw/lookup; độc lập Product ID, index và server line ID. Sales cho phép Product trùng/Gift; Receipt validation vẫn cấm Product trùng. |
| operationId | GUIDv4 một lần cho logical intent sau barrier; giữ nguyên qua reload và user-confirmed resend. Định dạng wire chính xác theo B01; local document ID không thay operationId. |

Dùng compound key arrays của IndexedDB, không nối chuỗi mơ hồ: drafts `[deploymentEpoch, actorKey, feature, localDocumentId]`; operations `[deploymentEpoch, actorKey, operationId]`. Draft lưu `localPersistSequence` tăng đơn điệu và `editRevision`; operations giữ reference tới đúng draft checkpoint/sequence. Không dùng timestamp làm điều kiện thắng race. Baseline là dữ liệu server từng được xác nhận (ID/version/status/saved lines), không đồng nghĩa với current server truth sau reload; draft/raw là phần người dùng sửa riêng. ExpectedVersion được giữ nguyên, không tự nâng theo một GET khác.

### 10.2 Allowlist, validation và schema evolution

Record chỉ lưu typed feature snapshot tối thiểu, baseline cần cho so sánh, ordered client/server line identity, raw/lookup text và confirmed selection, dirty/checkpoint metadata, timestamp, immutable operation reference. Không serialize nguyên `SalesSession`/`GoodsReceiptSession`. Bỏ capabilities, auth snapshot, session/request/recovery generation, pending Promise, AbortController, error/response tùy ý, QueryClient, grid state và Dockview tree. Tên/nhãn lookup là dữ liệu thương mại không đáng tin; render như text, xác minh lại reference/permission trước hành động.

Decoder local có hai tầng: envelope/namespace/shape/giới hạn tài nguyên hợp lệ trước preview; business validation khi prepare Save/Post. Raw invalid decimal, ngày hoặc lookup chưa chọn vẫn được giữ nguyên văn trong tầng local, không parse/round/trim để làm record hợp lệ. Baseline/canonical field dùng exact int64/decimal/date/version validators tương ứng; draft chưa hợp lệ dùng quy tắc feature hiện có, không áp wire success schema lên raw. `composing` được ghi như dấu hiệu dữ liệu chưa hoàn tất; reload không khởi tạo lại một native IME session hoặc tự coi selection đã confirmed. Chỉ thao tác chỉnh sửa/commit mới của người dùng mới hoàn tất trạng thái này.

Giới hạn local ban đầu cho F02: tối đa 200 dòng/feature; tối đa 16,384 UTF-16 code units cho mỗi raw/query/display text và 2 MiB UTF-8 cho một draft envelope. Đây là giới hạn bảo vệ bộ nhớ, không phải wire/business limit mới. Vượt giới hạn phải báo persistence failed và giữ RAM nguyên vẹn, tuyệt đối không cắt text hoặc dispatch write. F02 phải exercise 200 dòng và biên độ dài bằng tests trước khi coi decoder được nghiệm thu. Operation request constraints theo corpus B01, không lấy HTTP size từ local limits. Original replay result có cap 1 MiB UTF-8 trước Commit và availability 7 ngày, sau đó key tombstone không được reuse; đây là policy backend bounded, không phải TTL tự xóa local UNKNOWN.

Unsupported version, malformed record, foreign key/scope, invalid canonical baseline hoặc operation thiếu payload/hash: cách ly đúng record và báo lỗi, không bulk-delete/reset database. Không enumerate/render nội dung actor/epoch khác để giải thích lỗi. Không migration tự động từ schema tương lai; migration local sau này chỉ copy/validate rồi commit atomically, giữ record cũ khi thất bại. Versionchange/upgrade bị tab khác giữ phải báo blocked, đóng connection lỗi khi thích hợp và cho Retry local persistence; không bypass dispatch.

### 10.3 Cross-tab và dispatch fence

IDB readwrite transaction thực hiện compare-and-swap `localPersistSequence` của đúng document owner trước khi thay snapshot; stale writer nhận conflict và giữ RAM, không last-writer-wins. Hai localDocumentId khác nhau cùng server document phải được phát hiện qua namespace + feature + serverId, hiển thị hai bản cần review, không tự merge/ghi đè. Web Locks/BroadcastChannel chỉ tối ưu thông báo/điều phối, không phải authority; correctness phải đứng vững bằng transaction/revision khi chúng không có. Backend expectedVersion/journal vẫn là authority giữa thiết bị/process.

Sau barrier, F03 freeze **wire command riêng**; `mutationSnapshot` hiện có không đủ vì mapper vẫn biến đổi snapshot thành request và Post chỉ gửi target/version. Transaction chứa draft checkpoint + immutable operation phải complete trước network dispatch. Capture epoch/actor/session/generation/editRevision trước mỗi await; sau IDB complete kiểm tra lại scope/revision/capability trước send. Một record có thể đã durable nhưng chưa send khi crash, nên reload vẫn UNKNOWN, không tự khẳng định rollback. IDB lỗi sau dispatch hoặc sau response không được xóa intent; retry chỉ việc lưu local, không retry HTTP.

### 10.4 Close, logout, retention và clear

| Sự kiện | Chính sách local bắt buộc cho F02/F03 |
|---|---|
| Close/close-all/reset/restore layout | Đi qua admission chung. Cancel giữ phiên/raw và không discard dữ liệu; autosave local đã xếp hàng vẫn có thể hoàn tất. Save đợi barrier + local transaction + server outcome và latest identity. Discard chỉ xóa draft an toàn theo CAS sau user choice; lỗi xóa không báo đã discard, giữ phiên để Retry. Pending/preparing/unknown chặn finalise, kể cả draft đã durable. |
| Reload/pagehide/crash | Chỉ phục hồi snapshot đã transaction-complete. pagehide là best effort, không làm gate dispatch hoặc lời hứa giữ phím cuối. Không restore layout trước authoritative epoch. |
| Logout chủ động | Giữ close admission hiện tại; unknown chưa xử lý vẫn chặn luồng logout có admission. Khi đã được admit, cố gắng purge các bản clean/được user discard trong đúng namespace, không xóa pending/unknown. Không thêm quyền từ local dữ liệu. |
| Expiry/revocation/actor hoặc epoch đổi | Hủy/fence reads, ẩn preview và clear memory/cache ngay; không chờ purge để vô hiệu hóa auth. Giữ bytes dirty/unknown cách ly cho lần auth đúng scope hoặc operator xử lý. Không chuyển chúng sang epoch mới. |
| Purge thất bại | Hiển thị dữ liệu trên thiết bị chưa được xóa; không báo clear thành công. Logout/revocation vẫn phải vô hiệu auth, không giữ token để cố dọn IDB; lần login đúng scope cho retry cleanup. Actor khác không được thấy preview. |
| Retention | Không TTL tự xóa dirty/unknown. Clean SETTLED chỉ cleanup sau positive result đã lưu local thành công và CAS chứng minh không có edit mới/operation mới. Người dùng có thể clear draft không có unresolved operation với xác nhận; old v1/v2 layout bytes được giữ, không auto-import. |

Xóa bytes không phải xác nhận SQL rollback hoặc quyền tạo intent mới. UNKNOWN/corrupt-operation chỉ được xử lý qua positive authorized outcome hoặc backend operator disposition đã kiểm chứng. Đường operator `CONFIRMED_NOT_EXECUTED` cần exclusive key fence **và durable terminal tombstone cùng key lock** chặn late original request theo backend contract; khi B01/B03/B04/B06 chưa chứng minh được thì không expose unlock/delete-to-retry. Receipt Posted ack vẫn terminal read-only khi không có Read/version; không dựng lại version từ baseline trước Post.


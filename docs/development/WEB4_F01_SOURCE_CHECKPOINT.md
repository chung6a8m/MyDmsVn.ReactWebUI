# WEB4-01 — Source checkpoint và pinned consumer contract

**Ngày:** 01/11/2026. **Phạm vi:** F01 của [owning plan](../plans/20261101-002-web4-reliability-web.md). **Trạng thái:** **DONE (bounded contract; Owner acceptance/merge pending)**. Source/local boundary đã chốt; corpus và test-only oracle được mirror nguyên bytes. Không có production runtime change, HTTP mới hoặc IndexedDB adapter. [Evidence và lệnh thực chạy](../evidence/web4/20261101-web4-01-contract.md).

## 1. Source pins và mức độ xác nhận

| Nguồn | Revision đã kiểm tra | Điều được chứng minh |
|---|---|---|
| ReactWebUI main sau PR #18 | `609247737f5b6a312b40f8ea4fc353da5b1125e4` | Source mapping bên dưới; dependency pins trong package-lock; không có durable draft/operation API |
| MyDmsVn main sau PR #79 | `48e9cd7ae096ecadd184e6ea6a372306d77f41b1` | Runtime baseline trước B01; source sáu handler hiện hành không đổi |
| Backend B01 canonical corpus | `1c603c6ac57e59a3f7b4bc6ca976b2d531c079aa` | [48 committed blobs](../../tests/fixtures/web4-v1/README.md), manifest SHA-256 `0acab190e7fe126d53c13c0510a1958365e5a6e1fda78a4321da78297e0b3f1a`; 38 fixtures, 24 independent hash vectors, strict oracle |
| Backend B04 implementation | **NOT AVAILABLE** | Không dùng TS frontend để suy operation route/envelope/permission/canonicalization |

Remote main của cả hai repo đã đối chiếu bằng `git ls-remote`. Source links/line numbers dưới đây gắn với các SHA này, không cam kết đúng ở HEAD tương lai. Backend [B01 source checkpoint](https://github.com/chung6a8m/MyDmsVn/blob/1c603c6ac57e59a3f7b4bc6ca976b2d531c079aa/docs/design/WEB4_B01_SOURCE_CHECKPOINT.md) và [canonical contract](https://github.com/chung6a8m/MyDmsVn/blob/1c603c6ac57e59a3f7b4bc6ca976b2d531c079aa/docs/contracts/web4-v1/README.md) chốt protocol/source seams; chúng không phải API hoặc SQL implementation. Initial blocked checkpoint tại frontend `29b082fee32539b691d500c0f588864368ff5dbc` được giữ trong evidence như lịch sử.

## 2. Source → snapshot → mutation → recovery → mất dữ liệu

Đường dẫn trong bảng tương đối từ root repo ReactWebUI. Giữ feature stores/barriers/validation riêng; file giống tên không đủ lý do trích abstraction.

| Boundary | Sales | Goods Receipt | Mất dữ liệu / điểm nối F02–F03 |
|---|---|---|---|
| Session owner | `src/features/sales/salesSessionStore.ts:15` | `src/features/goodsReceipt/goodsReceiptSessionStore.ts:12` | Cả hai giữ baseline, draft, raw/lookup, editRevision, mutationKind/snapshot, recovery trong Zustand RAM. Reload mất tất cả; F02 xuất allowlisted snapshot, không serialize store. |
| Raw và lookup | `src/features/sales/salesWorkspaceAdapter.ts:260`, `src/features/sales/sessionEditing.ts:10`, `src/shared/lookup/sessionLookup.ts:9` | `src/features/goodsReceipt/sessionEditing.ts:12`, `:44`, `src/features/goodsReceipt/GoodsReceiptEditors.tsx:12` | Sales mirror lookup query/composition vào raw; Receipt có lookup buffer riêng. Chỉ persist canonical draft sẽ mất invalid/unconfirmed input. |
| Dirty/edit admission | `src/features/sales/salesSessionStore.ts:80` | `src/features/goodsReceipt/goodsReceiptSessionStore.ts:83` | Dirty gồm raw/composition/lookup; pending/preparing/unknown khóa edit. Durable không đồng nghĩa clean hoặc được discard. |
| Save barrier | `src/shared/grid/editorBarrier.ts:119` | `src/features/goodsReceipt/goodsReceiptEditorBarrier.ts:43` | Clone/freeze snapshot mới nhất sau identity/revision checks. Sales normalize/validate trước và sau flush; Receipt flush rồi normalize. F02/F03 giữ thứ tự feature, await local transaction trước dispatch. |
| Command/snapshot | `src/features/sales/salesCommands.ts:206` | `src/features/goodsReceipt/goodsReceiptCommands.ts:107` | Pending Map coalesce cùng command trong RAM; không phải durable key/idempotency. Unknown giữ frozen snapshot và khóa ghi; reload mất obligation này. |
| Snapshot → actual wire | `src/infrastructure/http/salesHttpPort.ts:21`, `:33` | `src/infrastructure/http/goodsReceiptHttpPort.ts:23`, `:39` | Port clone rồi mapper mới tạo JSON. Create POST root, Update PUT `/{id}/draft`, Post gửi expectedVersion tới `/{id}/post`. `mutationSnapshot` không chứa immutable method/route/body nên không phải fingerprint input. |
| Response/adoption | `src/features/sales/salesCommands.ts:145`, `:309` | `src/features/goodsReceipt/goodsReceiptCommands.ts:62`, `:196` | Identity/scope checks trước accept; uncertain response giữ unknown. Save kết quả thay baseline/draft rồi clear raw; local persisted checkpoint sau này phải cùng sequence để không cleanup edit mới. |
| Unknown/readback | `src/features/sales/salesCommands.ts:92`, `:371` | `src/features/goodsReceipt/goodsReceiptRecovery.ts:16`, `:80` | Hiện dùng public Get và user-confirmed content comparison; Create cần candidate ID. Đây không phải original-operation journal proof và cần Read. F03 thêm operation reconciliation riêng, không đổi tên public read thành journal. |
| Close/finalise | `src/features/sales/salesCloseAdapter.ts:36`, `src/features/sales/salesWorkspaceAdapter.ts:286` | `src/features/goodsReceipt/goodsReceiptCloseAdapter.ts:37`, `src/features/goodsReceipt/goodsReceiptWorkspaceAdapter.ts:291` | Admitted finalise xóa session RAM. F02 thêm awaited safe flush/clear với CAS trước finalise, giữ unknown/preparing protection. |

### Khác biệt không được làm phẳng

- Sales có customer, Gift và Product lặp; Receipt có quantity/unitCost và Product unique. ClientLineId khác server line ID/Product; Receipt Update thay server line IDs, reconciliation phải bảo toàn client identity theo đúng sent order (`goodsReceiptReconciliation.ts:49`).
- Sales Post dùng clean persisted baseline và cố ý không chạy Save editor barrier (`salesCommands.ts:223–265`). Receipt Post chạy `preparePost`, flush rồi từ chối dirty kể cả Post-only (`goodsReceiptEditorBarrier.ts:49–64`). F03 cần immutable Post intent ở cả hai đường, không biến Post thành auto-Save.
- Sales Post ack có version (`salesCommands.ts:322`); Receipt ack chỉ receiptId/status/postedAtUtc, reject version thêm (`goodsReceiptCommands.ts:208`). Cả hai giữ Posted read-only khi Get sau đó thất bại; Receipt không dùng version trước Post để tiếp tục Edit.
- Receipt accept dựng committed lookup labels/fallback (`goodsReceiptReconciliation.ts:36`); Sales accept clear lookup buffers (`salesCommands.ts:145`). Persist/restore không được giả định cùng cấu trúc label.
- Receipt recovery source capture editRevision (`goodsReceiptRecovery.ts:16`); Sales unknown-recovery source hiện không có field đó (`salesCommands.ts:92`), mặc dù ordinary reload confirmation có kiểm tra revision. F03 settlement phải kiểm tra revision rõ ràng cho cả hai, không kế thừa thiếu sót từ một source type.
- Runtime generation không là durable identity: Sales new session generation 1; Receipt có counter theo session ID (`salesWorkspaceAdapter.ts:194`, `goodsReceiptWorkspaceAdapter.ts:103`). Restore tạo current generation mới; không tin generation lấy từ storage.

### HTTP/auth và Inventory

`src/infrastructure/http/writeBoundary.ts:8–23` phân biệt chưa dispatch với đã dispatch. Chỉ valid known business 400/403/404/409 mới được map thành failure chắc chắn theo contract hiện hành; malformed response/error, transport loss, post-dispatch 401 hoặc stale actor giữ unknown. **Đừng áp quy tắc business-write rejection này cho status GET:** 404/403/timeout ở status không chứng minh rollback.

`src/infrastructure/http/httpTransport.ts:8–39` giữ same-origin, token/scope/abort preflight, callback ngay trước fetch, deadline 30 giây; chỉ GET/HEAD được refresh/replay một lần. `readBoundary.ts:12` và transport hiện chỉ so actor/generation, chưa có deployment epoch. Không có keyed write, fingerprint header hoặc status port. F03 không bật generic retry cho mutation.

`src/infrastructure/http/authSession.ts:43–58` adopt actorKey từ authoritative `/me.userId` sau capability read. Biến `epoch` ở dòng 27 là async cancellation counter nội bộ, **không phải deployment/database epoch**. F02/F03 phải đọc authenticated `GET /api/v1/operations/context`, kiểm `actorUserId` khớp authoritative `/me.userId` ở current generation và `contractVersion` đúng `web4-v1` trước discover draft/layout. B01 không thêm field vào `/me`; B04 phải triển khai context này.

`src/app/runtime/createProductionRuntime.tsx:50–74` tắt Query retries/mutation retries, clear/fence private queries khi actor hoặc quyền đổi, đăng ký Inventory observer cho cả hai feature. `src/features/inventory/inventoryInvalidation.ts:15–39` chỉ phản ứng positive Post ack/Posted baseline ở current scope: chọn stock keys từ baseline, cancel đọc cũ, invalidate/refetch active. F03 chỉ publish positive transition sau identity/fingerprint settlement đầy đủ; absent/mismatch/unknown không invalidate và không refetch đè draft module khác.

## 3. Layout, close và deployment namespace

| Source | Thực tế tại pin | Quyết định F01 |
|---|---|---|
| `src/app/workspace/documentContracts.ts:1`, `:40` | ActorScope/sameActorScope chỉ actorKey + actorGeneration | F02 thêm epoch vào toàn bộ ownership/fence; không chỉ đổi IDB key. |
| `src/app/workspace/workspaceLayouts.ts:7–10` | Storage key v2/v1 chỉ actorKey | Chuyển sang v3 key epoch+actor theo [design §2.1](../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md#21-workspace-layout-v3--epoch-aware-presentation-restore). |
| `src/app/workspace/layoutPersistence.ts:126`, `src/app/workspace/layoutPersistenceV2.ts:98–110` | Persist scope actor-only; v2 document descriptor có serverId | Strict v3 envelope phải có epoch+actor; raw/lookup/draft/operation không vào layout. |
| `workspaceLayouts.ts:140–185`, `panelRegistry.ts:142` | Tự fallback/migrate v1; remap session UUID rồi openRestored bằng saved serverId | Không auto-import v1/v2 khi có epoch; giữ blob cũ, safe default, chỉ reopen từ current authorized list. |
| `src/app/workspace/panelRegistry.ts:149` | Dockview remove do move không dispose session | Persistence owner là app local document, không phải component instance. |
| `src/app/workspace/workspaceController.ts:33–174` | Common admission; capture/recheck identity trước finalise nhiều document | Flush/clear phải nối trong admission, không thêm đường remove/reset bypass. |
| `workspaceLayouts.ts:227–232` | Beforeunload chỉ cảnh báo dirty/blocked; pagehide chỉ save layout | Không có draft durability hiện tại; F02 pagehide flush vẫn best effort. |

Cùng origin và numeric userId sau database replacement có thể vượt qua guard hiện tại rồi GET một serverId trùng ở database khác. Sanitize layout không chứng minh database provenance. Vì vậy v3 epoch fence phải bao gồm registry, live panels, close, restore, async reads, cache và status/write headers; không được tuyên bố an toàn bằng cách chỉ scope IndexedDB.

Local schema/classification, năm identity, fail-closed quota, cross-tab CAS, retention/logout/clear và không phục hồi generation cũ được sở hữu tại [design §10](../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md#10-quyết-định-local-lifecycle-tại-f01-chưa-triển-khai), không nhân bản schema trong tài liệu này.

## 4. Consumer codec proposal — chưa là implementation

Giữ một pure strict decoder cho protected operation envelope dùng module-specific existing detail/ack codecs; không tạo generic ERP state framework. Tách các bước sau để có thể kiểm tra với B01 corpus; tên dưới đây là trách nhiệm nội bộ, **wire casing/enum/endpoint lấy từ backend B01 pin, không từ TS frontend**:

1. **Frozen command validation:** method + canonical route/resource + operation kind + original requestTargetId + exact body/expectedVersion/order. Create có request target null; resultDocumentId riêng. Không hash clientLineId, token, capability hoặc toàn store. Các quy tắc property order, whitespace, missing/null, decimal lexeme/precision và escaping phải lấy từ B01 vectors; không dùng `JSON.stringify(snapshot)` làm canonical mặc định.
2. **Fingerprint derivation:** rederive SHA-256 bằng B01 algorithm từ frozen command; so stored digest, không tin stored digest thay payload. Missing/corrupt/mismatch giữ UNKNOWN trước khi gửi status. Không tự sửa hash hoặc cấp operationId mới.
3. **Transport input:** sáu writes cần Idempotency-Key + X-MyDmsVn-Deployment-Epoch; status GET cần epoch + X-MyDmsVn-Operation-Fingerprint vừa rehash. B01 pin chốt exact route/duplicate-header/denial semantics; B04 chưa triển khai. Không cho unkeyed fallback.
4. **Protected envelope validation:** strict parse server-owned operationId, operationKind, method, routeScope, original requestTargetId, requestFingerprint, deploymentEpoch cùng command-specific result theo pinned corpus. Không thêm request actor lấy từ client để làm authorization. Unknown/additional/missing fields xử lý theo strict canonical schema đã publish, không đoán envelope bằng existing TS interfaces.
5. **Settlement fence:** khớp toàn bộ metadata với local immutable intent; recheck current authenticated epoch/actor/generation, session/document identity, editRevision và operation reference sau await. Đúng Create result ID không phải lý do bỏ qua null request target. Mismatch không accept result, unlock hoặc invalidate Inventory.
6. **Local settlement:** lưu validated outcome/baseline và disposition bằng current-sequence transaction trước cleanup. Không sửa phiên bằng stale result. Nếu authoritative result không còn đủ version/line identity, giữ bounded committed confirmation/read-only hoặc UNKNOWN theo B01 outcome, không synthesize phiên editable.

| Command | Original authorized result phải khôi phục | Không được thay bằng |
|---|---|---|
| Sales Create / Update | Full Write detail gồm version, ordered server line IDs và đúng field set original result | ID-only, current GET hoặc version tự dựng |
| Receipt Create / Update | Full Write detail/version và replacement server line IDs đúng original result | Giữ server line IDs cũ hoặc current GET cần Read |
| Sales Post | Original Posted ack với version | Receipt-shaped ack không version |
| Receipt Post | Original Posted ack không version | Dùng baseline pre-Post version hoặc thêm version bịa |

Write/Post-without-Read vẫn phải nhận original result khi current corresponding grant cho phép; quyền đã thu hồi/absent/expired/unavailable không cho tiếp tục Edit. Public Get không thay proof original operation. Retry HTTP tự động luôn cấm; manual SAME-ID resend chỉ sau B03/B04 chứng minh serialization/tombstone/permission/epoch. Operator negative disposition cần durable terminal tombstone theo [design §10.4](../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md#104-close-logout-retention-và-clear).

## 5. B01 đã chốt và các implementation gate còn lại

Backend source pin cho thấy mỗi handler tự sở hữu transaction; thêm journal ở controller sau Commit sẽ không atomic:

| Handler dưới `src/MyDmsVn.Server.Application/` | BeginTransaction / Commit |
|---|---|
| `Sales/SalesReceiptFeatures.cs` Create | 156 / 174 |
| `Sales/SalesReceiptFeatures.cs` Update | 212 / 246 |
| `Sales/PostSalesReceipt.cs` | 49 / 102 |
| `Inventory/GoodsReceiptFeatures.cs` Create | 267 / 284 |
| `Inventory/GoodsReceiptFeatures.cs` Update | 355 / 406 |
| `Inventory/GoodsReceiptFeatures.cs` Post | 435 / 501 |

Sales Post dựng versioned result trước Commit (dòng 101); Receipt Post dựng unversioned result sau Commit/audit (501–512). B01 đã chốt capture original result **trong cùng UoW trước Commit**, bao gồm chuyển Receipt Post construction; journal/context chỉ đi qua optional Web metadata, Local không truy cập Web store. [Source checkpoint backend](https://github.com/chung6a8m/MyDmsVn/blob/1c603c6ac57e59a3f7b4bc6ca976b2d531c079aa/docs/design/WEB4_B01_SOURCE_CHECKPOINT.md) sở hữu representation/retention và exact11→12 schema/admission; Web không suy transaction proof từ contract test. Source inspection không phải SQL verification.

| Gate | Disposition |
|---|---|
| Canonical corpus / manifest / hash | Published B01 commit ở §1, exact Git bytes mirror + provenance; không sửa canonical files tại frontend |
| Authenticated epoch wire | `GET /api/v1/operations/context`, strict `{data:{deploymentEpoch,actorUserId,contractVersion}}`; actor phải khớp `/me` trước preview; B04 runtime pending |
| Canonical hash | `web4-v1`: recursively ASCII-sorted compact UTF-8 JSON; arrays giữ order, exact decimals normalize 4 places, omitted note = null (khác empty), Sales parsed Base64 normalize; expected vectors do Python độc lập sinh, JS oracle kiểm |
| Original response / transaction | Backend source review sáu handler, precommit codec + same-UoW epoch/key/authority fences; Write/Post grant hiện tại, không thêm Read. Replay full allowlist tối đa 1 MiB, 7 ngày rồi giữ permanent key tombstone; B03/B04 phải chứng minh SQL |
| Runtime idempotency / status / storage | B03/B04 và F02/F03 chưa triển khai; contract completion không thay các gate này |

Frozen wire intent phải lưu riêng với UI snapshot: Sales mapper biến note null thành empty string, vì vậy map lại baseline không được dùng để tái dựng hash hoặc resend. Canonical-equivalent formatting không cho phép thay frozen payload; user-confirmed resend dùng đúng original command. Backend oracle strict kiểm outcome đủ identity/version, kể cả labels null/active true mặc định của Receipt Write; ordinary Get codec rộng hơn không tự thay protected result decoder.

Consumer tests W4-CON-01/02 ở `tests/unit/http/web4ContractCheckpoint.test.ts` dùng backend oracle cùng production schemas/mappers hiện hành. W4-CON-02 chứng minh differing fingerprints và conflict/error schema, không phải same-key SQL concurrency hoặc runtime settlement. Actor/generation/editRevision/local-CAS settlement và Inventory effect là gate F03; chỉ test status schema/hash không chứng minh chúng.

F01 đã đạt pin + consumer tests + independent review: DONE (bounded contract), Owner acceptance/merge pending. F02–F05 giữ PLANNED và cần task riêng; không mở lại WEB1–03 hoặc CEX.

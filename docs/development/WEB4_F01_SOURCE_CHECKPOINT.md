# WEB4-01 — Source checkpoint và đề xuất consumer codec

**Ngày:** 01/11/2026. **Phạm vi:** F01 của [owning plan](../plans/20261101-002-web4-reliability-web.md). **Trạng thái:** source/local boundary đã khảo sát; **BLOCKED — backend B01 chưa publish**, chưa đạt exit F01. Không có runtime change, HTTP mới, IndexedDB adapter hoặc canonical WEB4 fixture trong checkpoint này. [Evidence và lệnh thực chạy](../evidence/web4/20261101-web4-01-contract.md).

## 1. Source pins và mức độ xác nhận

| Nguồn | Revision đã kiểm tra | Điều được chứng minh |
|---|---|---|
| ReactWebUI main sau PR #18 | `609247737f5b6a312b40f8ea4fc353da5b1125e4` | Source mapping bên dưới; dependency pins trong package-lock; không có durable draft/operation API |
| MyDmsVn main sau PR #79 | `48e9cd7ae096ecadd184e6ea6a372306d77f41b1` | Backend WEB4 chỉ docs activation; B01 vẫn PLANNED; source sáu handler hiện hành |
| Backend B01 canonical corpus | **ABSENT / NOT PINNED** | `git ls-tree` chỉ có `docs/contracts/web2-v1` và `web3-v1`; chưa có manifest/hash/vectors WEB4 |
| Backend B04 implementation | **NOT AVAILABLE** | Không dùng TS frontend để suy operation route/envelope/permission/canonicalization |

Remote main của cả hai repo đã đối chiếu bằng `git ls-remote`. Source links/line numbers dưới đây gắn với các SHA này, không cam kết đúng ở HEAD tương lai. Backend [proposed design tại source pin](https://github.com/chung6a8m/MyDmsVn/blob/48e9cd7ae096ecadd184e6ea6a372306d77f41b1/docs/design/WEB4_IDEMPOTENCY_JOURNAL_CONTRACT.md) là yêu cầu cần B01 chốt, không phải corpus hoặc API được triển khai. Không tạo `tests/fixtures/web4-v1` trống/giả và không tính WEB2/WEB3 corpus là WEB4 PASS.

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

`src/infrastructure/http/authSession.ts:43–58` adopt actorKey từ authoritative `/me.userId` sau capability read. Biến `epoch` ở dòng 27 là async cancellation counter nội bộ, **không phải deployment/database epoch**. F02/F03 cần authenticated epoch từ backend trước discover draft/layout; F01 không tự thêm một field vào `/me`.

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

Giữ một pure strict decoder cho protected operation envelope dùng module-specific existing detail/ack codecs; không tạo generic ERP state framework. Tách các bước sau để có thể kiểm tra với B01 corpus; tên dưới đây là trách nhiệm nội bộ, **không đóng đinh TS type, JSON field casing, enum hay endpoint mới**:

1. **Frozen command validation:** method + canonical route/resource + operation kind + original requestTargetId + exact body/expectedVersion/order. Create có request target null; resultDocumentId riêng. Không hash clientLineId, token, capability hoặc toàn store. Các quy tắc property order, whitespace, missing/null, decimal lexeme/precision và escaping phải lấy từ B01 vectors; không dùng `JSON.stringify(snapshot)` làm canonical mặc định.
2. **Fingerprint derivation:** rederive SHA-256 bằng B01 algorithm từ frozen command; so stored digest, không tin stored digest thay payload. Missing/corrupt/mismatch giữ UNKNOWN trước khi gửi status. Không tự sửa hash hoặc cấp operationId mới.
3. **Transport input:** sáu writes cần Idempotency-Key + X-MyDmsVn-Deployment-Epoch; status GET cần epoch + X-MyDmsVn-Operation-Fingerprint vừa rehash. Exact route/duplicate-header/denial semantics vẫn chờ B01/B04; không cho unkeyed fallback.
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

## 5. Backend B01 còn thiếu và cách tiếp tục

Backend source pin cho thấy mỗi handler tự sở hữu transaction; thêm journal ở controller sau Commit sẽ không atomic:

| Handler dưới `src/MyDmsVn.Server.Application/` | BeginTransaction / Commit |
|---|---|
| `Sales/SalesReceiptFeatures.cs` Create | 156 / 174 |
| `Sales/SalesReceiptFeatures.cs` Update | 212 / 246 |
| `Sales/PostSalesReceipt.cs` | 49 / 102 |
| `Inventory/GoodsReceiptFeatures.cs` Create | 267 / 284 |
| `Inventory/GoodsReceiptFeatures.cs` Update | 355 / 406 |
| `Inventory/GoodsReceiptFeatures.cs` Post | 435 / 501 |

Sales Post dựng versioned result trước Commit (dòng 101); Receipt Post dựng unversioned result sau Commit/audit (501–512). Backend B01 phải chốt điểm capture original result **trong cùng UoW**, representation/retention và schema/admission; Web không sửa backend hoặc suy transaction proof từ fake test. Source inspection không phải SQL verification.

| Gap | Owner / điều kiện gỡ gate |
|---|---|
| Không có canonical corpus/manifest/hash | B01 publish commit và provenance: canonical six requests, original outcomes, status/denial/expiry/header cases, algorithm/vectors và validator |
| Chưa có authenticated epoch wire | B01 chốt acquisition, grammar/rotation và response binding; F01 cập nhật proposal từ exact corpus, F02 không hard-code `/me` field |
| Canonical hash chưa chốt | B01 vectors cho order/whitespace/null/missing/string precision/Gift/version/route/target/1–200 lines; F01 dùng cùng oracle, không fork JSON |
| Transaction/result capture/schema chưa source-reviewed B01 | Backend xuất source map sáu handler và exact11→12 admission/disposition; Web chỉ pin và ghi accepted contract |
| Runtime idempotency/status chưa có | B03/B04; không cần hoàn tất runtime để publish F01 contract, nhưng F03 không được nối sớm |

Khi B01 publish: lấy committed bytes theo SHA, mirror canonical files vào `tests/fixtures/web4-v1`, ghi revision/sourceBaseline/manifest SHA-256 và từng file hash vào frontend provenance. Dùng oracle/validator backend trực tiếp như mô hình WEB3; mutation negative cases chỉ tạo từ clone, không sửa corpus gốc. Bổ sung consumer tests W4-CON-01/02 với exact expected vectors, kiểm đủ wrong/missing epoch/fingerprint, wrong kind/route/target, Create null target, six command outcomes và Write/Post-without-Read. Ghi số fixture/vector riêng số test runnable. B01 local contract tests không chứng minh SQL same-key concurrency; việc đó thuộc B03/B04/B05.

F01 chỉ được đổi DONE sau pin + consumer tests + review. F02–F05 giữ PLANNED; checkpoint này không tự mở F02, không mở lại WEB1–03 hoặc CEX.

# Roadmap 04 — Web Reliability & Delivery Foundation (ReactWebUI)

**Owner lựa chọn:** 01/11/2026. **Trạng thái:** ACTIVE ROADMAP, tất cả F01–F05 PLANNED / NOT RUN. **Repository:** chung6a8m/MyDmsVn.ReactWebUI. **Baseline:** main@177edad9340a11279f08993d50bfe4acc9e15364. Tài liệu này chỉ kích hoạt kế hoạch, không thay đổi source/test và không tạo bằng chứng build/CI/SQL/browser. Codex phải đọc lại main hiện hành trước mỗi task.

**Backend companion:** https://github.com/chung6a8m/MyDmsVn/blob/codex/activate-web4-reliability/docs/plans/20261101-003-web4-reliability-server.md sở hữu B01–B06 và canonical wire/SQL. Web không tạo một bản journal/status spec cạnh tranh. [Thiết kế local draft/recovery](../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md) · [Test matrix Web](../development/WEB4_WEB_ACCEPTANCE.md) · [Codex handoff](../development/WEB4_CODEX_HANDOFF.md) · [Evidence mới](../evidence/web4/README.md). Đây là nguồn duy nhất sở hữu trạng thái F01–F05.

## 0. Mục tiêu, bất biến, phạm vi không triển khai

Sau WEB1/WEB2/WEB3 (đã ARCHIVED/COMPLETED bounded), hiện có Sales, Goods Receipt, Inventory Balances/Card qua HTTPS/net48/SQL non-production. Các thao tác Save/Post không tự retry, nhưng draft và unknown mutation chưa sống sót đầy đủ sau reload/crash. Mục tiêu WEB4: **khả năng giữ draft an toàn, định danh một intent bất biến, xác minh kết quả mutation đã commit bằng backend journal và tiếp tục phiên trên trình duyệt**; cùng backend cung cấp hosted Windows CI và pilot tích hợp có SQL oracle.

**Giữ nguyên:** React/TypeScript/Vite, shadcn Nova/Base UI/Tailwind v4 mặc định, Zustand feature stores, AG Grid Community, Dockview multi-panel, Floating UI lookup, TanStack Query, server-authoritative permissions, actor/generation fencing, Save barrier, line client identity, receipt unique Product, Sales có thể lặp Product/gift, int64/decimal string, ngày chứng từ yyyy-MM-dd và bản ghi Posted immutable. JWT access trong localStorage theo quyết định Owner (rủi ro XSS vẫn còn), refresh GUID HttpOnly cookie; không ghi token/cookie vào draft. Dockview lưu layout descriptor an toàn, KHÔNG lưu raw draft ở layout. App Lab/fake ports không được lọt production artifact.

**Ngoài phạm vi:** thay UI design/theme, font 14px Business Compact, WinFormsKit, AG Grid Enterprise, in ấn, chuyển kho/điều chỉnh/trả hàng/thanh toán, thuật toán giá vốn, offline-first queue/sync background, service worker auto-submit, thay model auth/session/stack, full IIS/production rollout, cấu hình audit retention/distributed limiter production, candidate-specific attended Telex/VNI/Narrator (ghi NOT RUN). Không chuyển nghĩa WEB2 full-IIS ngoại lệ thành PASS.

## 1. Milestone và dependency

| Milestone | Frontend sở hữu | Backend phụ thuộc / trách nhiệm | Gate |
|---|---|---|---|
| WEB4-01 Contract | F01 source/actor/draft boundary & consume contract | B01 chốt canonical operation/status, transaction journal và schema | Không đoán JSON/permission từ kiểu TS |
| WEB4-02 CI | Giữ frontend hosted CI, bổ sung test theo thay đổi (không có F CI mới) | B02 Windows net48 SQL-free CI | GitHub hosted backend không phải local shell |
| WEB4-03 Journal | F03 đợi B04 API ổn định | B03 schema/journal; B04 sáu mutation + status | Backend same-UoW atomic, không auto replay |
| WEB4-04 Durable Web recovery | F02 IndexedDB store + F03 operation UX/ports | B04 authoritative status | Không lưu JWT/refresh; không phục hồi wrong actor |
| WEB4-05 Failure pilot | F04 real browser/reload/cross-tab/IME-automation | B05 SQL/fixture/oracle | Separate Chromium+Edge fresh DB, backend owns source/ledger |
| WEB4-06 Handoff | F05 docs/acceptance/closeout | B06 operation runbook | Scope Owner accepted; NOT production |

**Thứ tự:** Merge docs activation vào main trên cả hai repo → B01 canonical source checkpoint và F01 consumer/source review → backend B02 có thể chạy song song B03 → F02 local persistence sau F01 → B03/B04 giao API → F03 HTTP/recovery trên candidate đã pin → F04+B05 pilot → F05+B06 acceptance và archive. Tách PR theo task, không đưa toàn bộ roadmap vào một nhánh runtime duy nhất. Không yêu cầu Owner phê duyệt lại các lựa chọn đã chốt trong phạm vi; chỉ hỏi khi thay đổi semantics/security/phạm vi.

## 2. F01 — Source checkpoint và consumer contract (PLANNED)

**Đọc code hiện có:** src/infrastructure/http/{authSession.ts,httpTransport.ts,readBoundary.ts,writeBoundary.ts,salesHttpPort.ts,goodsReceiptHttpPort.ts}, src/app/runtime/createProductionRuntime.tsx, src/app/workspace/{panelRegistry.ts,workspaceController.ts,layoutPersistenceV2.ts,documentContracts.ts}, src/features/sales/{salesCommands.ts,salesSessionStore.ts}, src/features/goodsReceipt/{goodsReceiptCommands.ts,goodsReceiptSessionStore.ts,goodsReceiptRecovery.ts,goodsReceiptEditorBarrier.ts}, src/features/inventory/inventoryInvalidation.ts và các tests hiện hành.

1. Lập bảng source→session/editRevision/mutationSnapshot/port → unknown/readback/reload → nơi dữ liệu có thể bị mất; so sánh Sales và Receipt, không trích abstraction chỉ vì tên file giống.
2. Chốt bốn identity: authenticated actorKey (server-derived), document/sessionId, clientLineId, immutable operationId GUIDv4. session generation sau reload là NEW, không persist/reuse số generation cũ. Tách layout descriptor với payload draft, và tách local draft với authoritative server baseline.
3. Backend B01 sở hữu hợp đồng: sáu mutation có Idempotency-Key, GET operation status actor-scoped, cùng key+same fingerprint trả kết quả đã commit sau kiểm tra quyền hiện tại; 404/403/timeout không xác nhận rollback. Chỉ consume backend canonical corpus/manifest/hash vào tests/fixtures WEB4 sau khi backend publish, không fork JSON fixture authoritative.
4. Chốt local data classification, schema/version, storage errors, quota, cross-tab conflict, retention/clear và cách kiểm tra user đang signed-in trước khi show preview. Tài liệu thiết kế dưới đây là proposed baseline; F01 xác nhận thông qua tests/prototypes SQL-free khi cần.
5. Ghi source SHA của cả hai repos và wire corpus trong evidence F01. Không thêm runtime write hoặc tuyên bố live SQL/IndexedDB success từ việc chỉ viết docs.

**Exit:** mapping, consumer codec proposal, key/actor/persistence lifecycle được review, backend B01 contract pin; không có runtime gates mặc nhiên PASS.

## 3. F02 — Durable draft repository và snapshot lifecycle (PLANNED)

**Prerequisite:** F01. **Phạm vi source dự kiến:** src/infrastructure/drafts/* (narrow typed IndexedDB adapter), src/features/sales/* và src/features/goodsReceipt/* (những điểm capture/apply snapshot), createProductionRuntime.tsx, Workspace close admission và focused unit/browser tests. Không thêm dependency fake IndexedDB nếu chưa kiểm tra lockfile/hợp đồng test; ưu tiên dependency-injected adapter, dùng Chromium IndexedDB thật cho kiểm thử browser.

1. Data model v1: actor-scoped envelope, feature+record or new-session id, schemaVersion, saved baseline/version, durable business draft and raw/lookup buffers with confirmed identity, editRevision, clientLineIds, dirty flags, timestamps và optional immutable pending operation reference. **Không** persist access JWT, refresh cookie, password, auth snapshot, SQL secret, browser trace, full Docview tree, uncontrolled server payload.
2. Quá trình save: hook Zustand feature stores vào persistence mà không làm store thành async; coalesce writes nhưng phải có observed durable transaction/ack before mutation dispatch; close Save/Discard/Cancel và logout/actor switch phải chờ flush/clear boundary khi thích hợp. Pagehide/visibilitychange chỉ best effort; không hứa khôi phục phím chưa commit thành công xuống IndexedDB sau crash.
3. Restore: sau khi auth bootstrap + current user/capabilities authoritative; query namespace actor này, validate schema/shape/ID/decimal/length và không tin stored status/permissions. Không tự tạo Server document hay tự post. Preview danh sách draft riêng, chỉ apply sau user review; nhập raw không hợp lệ phải hiển thị nguyên văn, không silently normalize/clear.
4. Pending/unknown marker chỉ bị xóa sau xác minh positive committed hoặc người dùng xử lý đúng policy. Reset layout/close/refresh chưa có bằng chứng không được silently discard protected unknown. Server result mới hơn local baseline phải hiển thị conflict/review thay vì overwrite.
5. Tab race/duplicated panel/recreated renderer: stable document session id cho persisted draft, không gắn state vào Dockview component instance; per-actor and per-document revision fencing. Logout có clear policy và UI thông báo; user khác không thể đọc/render bản người trước, kể cả khi trình duyệt vẫn giữ local bytes.
6. Khi IndexedDB bị chặn/quota/full: fail closed đối với promise durable trước mutation; thông báo rõ không thể bảo đảm phục hồi, không nói "đã lưu tạm" sai sự thật. Read-only vẫn hoạt động; explicit discard/copy nội dung để người dùng quyết định. Không automatic degraded unjournaled write.

**Exit:** unit/component + browser Chromium (IndexedDB thật) đi qua raw, lookup, 200 lines, reload/new session, actor/logout/quota/corruption/close admission, mỗi case có actual test count; bảo đảm phần đã commit IndexedDB được phục hồi, không tuyên bố dữ liệu chưa durable không thể mất.

## 4. F03 — Intent, keyed HTTP và recovery UI (PLANNED)

**Prerequisite:** backend B04 canonical implementation/fixtures; F02 durable adapter.

1. Mỗi **logical user intent** sau Save barrier có immutable snapshot/operationId; persist operation reference và exact request intent trong IndexedDB transaction BEFORE dispatch. Key phải ổn định xuyên reload và chỉ gắn với đúng method/route/version/payload; mutate draft sau dispatch là intent mới, không sửa operation cũ.
2. Extend existing Sales/Receipt HTTP ports with Idempotency-Key; không thêm silent fallback/unkeyed WEB4 mode, không thay đổi auth storage. GET operation status là **read-only reconciliation**, không phải re-POST. Dùng backend canonical status/denial schema/actor constraints; convert fail 401/403/404/5xx/timeouts thành trạng thái rõ ràng, không tự giải khóa unknown.
3. Khi response Create/Save/Post hợp lệ: reconcile server detail hoặc Post ack theo semantics hiện hữu. Khi response mất/timeout/cancel sau dispatch: giữ session outcome-unknown + durable intent; on startup/render offer "Kiểm tra kết quả" (user-initiated, hoặc read-only status probe khi chính sách cho phép), không gọi lại mutation. Status COMMITTED là positive evidence, nhưng không tự bịa version/line IDs; nếu Write/Post-without-Read nhận Post ack thì thể hiện Posted/read-only, Get403 vẫn không biến thành Draft.
4. Không replay khi lost acknowledgement, refresh JWT giữa request, HMR, logout, route switch, double click, multi-tab, Tab Enter. Tách OperationJournal reconciliation khỏi existing read/Get recovery; âm tính/absence không chứng minh SQL rollback. Giữ mutation lock đến khi có positive status hoặc quy trình đối soát bằng quyền phù hợp.
5. Invalidate Inventory scope sau committed Post hoặc recovered Posted đúng stock key, cancel pre-Post in-flight query như hiện tại; không refetch thay đổi dirty Sales/Receipt khác. Giữ comment/label/focus/ARIA, Nova/Base UI defaults và Dockview close admission.
6. Thêm strict response codec, module-specific error shapes và actor/generation fencing. Status từ actor cũ/async read muộn không áp vào actor mới; runtime disposal cancel reads nhưng không suy server rollback.

**Exit:** fake/error-injection regression + actual port integration with backend test server; no frontend automatic write retry, correct status/ack permission, no regression in Sales/Receipt/Inventory. Live SQL acceptance belongs F04+B05.

## 5. F04 — Live cross-module failure/reload/Edge acceptance (PLANNED)

**Prerequisite:** F03 implementation, B05 backend-owned SQL fixture/oracle ready. Run frontend typecheck/build, full unit/component, Chromium real AG Grid/Dockview/lookup tests, production artifact isolation and new focused Edge regression. Hosted frontend CI is already present at WEB3 final head, preserve it and extend relevant cases with no credentials or SQL.

Extend existing tests/pilot under versioned new selector web4-recovery (proposed, validate names), using exact production React assets + Web net48 IIS Express HTTPS + real nonproduction SQL schema12, fresh separate owned DB for Chromium and Edge. No Vite/fake API for claimed SQL proof. Add scenarios: Create commit then response lost/reload → operation lookup returns one doc; Post lost ack → exactly one ledger/value and frozen COGS; Save/Update stable version and line identity; unknown/no-row/403 remains locked; cross-tab shared actor race; actor logout/login isolation; IndexedDB quota/corrupt/old schema; dirty other module preserved; Inventories refetch only after positive Post; strict CSP/refresh/Origin regression.

Backend B05 owns SQL physical oracle, source/valuation, resources/cleanup; Web F04 owns browser DOM, keyboard focus, storage, no replay and screenshot/observable UX. Test three classes of evidence separately: hosted secret-free fake tests, local actual IndexedDB browser, and IIS Express/SQL Chromium/Edge live. Screenshots may assist but are not attended Telex/VNI/Narrator.

**Exit:** published candidate + fresh real Chromium and Edge run with accurate executed counts, independent SQL oracle and cleanup for each, no open P1/P2 finding; bounded Owner acceptance pending explicit merge/review. Full IIS remains outside gate.

## 6. F05 — Operator UX handoff, docs and closeout (PLANNED)

Document end-user recovery steps, IndexedDB/quota/privacy and cleanup policies, schema version migration, feature-specific errors, coordinated deployment with Web12 journal and backend release runbook. Preserve existing policy/preview/test fixture provenance, updated AGENTS/README/roadmap and bounded status. Archive execution plan only after Owner acceptance and PR merge, preserve legacy links and original evidence. No new runtime PASS from a documentation-only closeout.

## 7. Non-negotiable gates and task status

- Every task PR: exact source before/after, counterpart backend SHA and corpus manifest, tests real commands and discovered/executed PASS/FAIL/SKIP (no zero-test PASS), user-visible screenshots only if behavior acceptance requires, secret hygiene, cleanup and outstanding NOT RUN.
- No SQL migration/HTTP implementation from Web-only fake tests; no UI feedback labelled "đã lưu" before durable DB transaction/SQL positive evidence.
- Never alter canonical WEB2/WEB3 fixtures, existing auth storage choice or previous Owner acceptance by creating a new WEB4 spec.
- CEX WinForms remains ACTIVE independently in backend; Web4 docs do not retarget any CEX task.
- All F tasks currently **PLANNED**. Select and run task from current main, review separate PR and update owning plan/evidence. Docs activation is not implementation.


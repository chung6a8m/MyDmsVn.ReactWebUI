# Codex handoff — Roadmap 04 ReactWebUI

**Owner đã chọn WEB4-01/F01; B01 đã publish/pin `1c603c6`; F01 DONE (bounded contract; Owner accepted; PR #19 merged 2026-11-01). WEB4-04/F02+F03 DONE (bounded; Owner accepted; PR #20 merged 2026-11-02); WEB4-05/F04 selected 2026-11-02 (DONE (bounded); Owner accepted; PR #21/backend #84 merged 2026-11-02); F05 IN PROGRESS (WEB4-06 docs selected; acceptance pending).** [Checkpoint và corpus pin](WEB4_F01_SOURCE_CHECKPOINT.md) · [evidence](../evidence/web4/20261101-web4-01-contract.md). [F02 checkpoint evidence](../evidence/web4/20261102-f02-durable-drafts.md) records verified local runtime. [F03 acceptance evidence](../evidence/web4/20261102-f03-operation-recovery.md) pins core `3a34fd9`, final UI `e44b1bb`, B04 runtime `bd871518fd162927d938babd5535a2ddf91c2ad5` and backend test/evidence head `b225bee`. WEB4-04 is DONE (bounded; Owner accepted and merged 2026-11-02) through [frontend PR #20](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/20), with [backend PR #83](https://github.com/chung6a8m/MyDmsVn/pull/83). F04 and its B05 fixture prerequisite are DONE (bounded); WEB4-06/F05+B06 is selected for documentation handoff; acceptance/merge/archive remain pending. Production writes require durable keyed intents; same-key resend remains disabled; bounded live pilot acceptance is recorded in F04 evidence. Đọc: [AGENTS](../../AGENTS.md) → [roadmap selector](../plans/README.md) → [F-owning plan](../plans/20261101-002-web4-reliability-web.md) → [draft/recovery design](../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md) → [acceptance matrix](WEB4_WEB_ACCEPTANCE.md) → [TEST_POLICY](../TEST_POLICY.md). Backend counterpart [B-owning plan](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/plans/20261101-003-web4-reliability-server.md) và [wire journal contract](https://github.com/chung6a8m/MyDmsVn/blob/1c603c6ac57e59a3f7b4bc6ca976b2d531c079aa/docs/design/WEB4_IDEMPOTENCY_JOURNAL_CONTRACT.md).

**Lịch sử activation hai repo (F01 checkpoint):** Frontend main `609247737f5b6a312b40f8ea4fc353da5b1125e4` đã merge PR #18; backend main `48e9cd7ae096ecadd184e6ea6a372306d77f41b1` đã merge PR #79. Docs activation đã có trên main. B01 contract mới được pin bằng immutable SHA `1c603c6ac57e59a3f7b4bc6ca976b2d531c079aa`; task branches chưa merge. Không dùng backend main activation thay pin này. Không xóa branch remote trong task này. Không chỉnh sửa historical WEB1–03 hoặc xem docs-only là runtime PASS.

## Nguyên tắc giao task

- Trước mỗi task đọc current main/PR đã merge, actual src + tests + package versions, không lấy một nhánh WEB3 lịch sử làm base. Tạo branch mới theo task được chọn, evidence riêng với lệnh và số test thực chạy. WEB4-04 đã được triển khai bằng commit/evidence F02 và F03 riêng, giao chung PR #20 vì checkpoint F02 cố ý khóa production writes.
- Backend B01 đã chốt exact canonical request/status và source UoW seams; [frontend corpus pin](../../tests/fixtures/web4-v1/README.md) sở hữu provenance. Không suy SQL transaction proof từ source/Node oracle, không implement fake-shaped API từ TS. F01/F02 có thể viết test storage độc lập nhưng F03 HTTP phải pin B04 implementation.
- Giữ Zustand feature stores, Dockview ownership và existing close admission/barrier; không tạo một generic ERP form/state framework. Auth session vẫn lưu JWT access localStorage và refresh HttpOnly, nhưng IndexedDB không lưu chúng.
- Khi API write đã dispatch và mất response, backend có thể đã commit. GET status có thể cho positive COMMITTED; GET 404/403/timeout không chứng minh rollback. **Không tự POST/PUT lại** hay sinh operationId mới trong background.
- Mọi testcase mô phỏng keyboard dùng key-by-key cho lookup/Enter/Tab/focus nếu mục tiêu là hành vi; không dùng fill() để chứng minh IME. Browser thật cần Dockview+AG Grid+Floating UI và IndexedDB, không chỉ mock DOM.
- Frontend production artifact không được có Lab/fake actor. Giữ Nova/Base UI mặc định, không bắt buộc Business Compact/WinForms/14px; không đổi packages ngoài scope được kiểm chứng.

## Phạm vi theo task (F01–F04 là checkpoint đã chấp nhận; F05 IN PROGRESS (WEB4-06 docs selected; acceptance pending))

**F01 — Contract consumer checkpoint:** Freeze backend B01 original per-command results (Create/Update full authorized Write detail/version, Sales Post with version, Receipt Post without), explicit user-confirmed same-key resend policy, and server deployment/database epoch before IndexedDB reads. Inventory source owners: src/app/runtime/createProductionRuntime.tsx; feature Sales/Receipt commands/session/buffer/recovery; authSession/httpTransport/writeBoundary; panelRegistry, **layoutPersistence.ts/layoutPersistenceV2.ts, workspaceLayouts.ts, documentContracts.ts** (actor-only storage v1/v2, auto-restore of document IDs). F01 must freeze epoch-aware v3 layout scope/non-migration and WEB4 epoch+expected-fingerprint headers/status metadata before implementation. Đọc source B01 canonical contract/fixtures, tạo mirror pinned manifest (không sửa backend corpus), consumer codec/test vectors và bản đồ draft/unknown/actor/close. F01 chỉ documentation/tests contract; không tuyên bố IndexedDB/HTTP mới đã chạy. Viết source+contract SHA và gap dispositions.

**F02 — IndexedDB durable adapter:** Tạo typed narrow adapter trong src/infrastructure/drafts/* với namespace backend-authenticated epoch + actor + module/doc; các feature adapters hỗ trợ freeze/capture/restore, session revision. Hook awaited flush đúng admission và trước mutation, deferred write coalescing không overwrite revision mới. Actor scope/authenticated preview, schema version/validation, quota/private/corruption/test thật. Giữ raw buffers và clientLineId; clear/purge chỉ theo policy, unknown không silently clear. Product policy: IDB quota/denied/abort **before dispatch blocks mutation** with user-visible retry local save and quota guidance; RAM editing/read-only allowed, no silent bypass. Add same-origin userId/different database epoch for **both IndexedDB and Dockview layout v1/v2/v3**, no actor-only layout auto-import, panel/late read fencing and failed purge tests. Test RED→GREEN khi có bug, Chrome/Edge focused IndexedDB + existing Sales/Receipt Grid/workspace regressions.

**F03 — Idempotent client and recovery UI:** B04 API contract đã pin. Sau editor Save barrier freeze payload, sinh GUIDv4 duy nhất cho user intent, persist operation record trước network dispatch; gửi `Idempotency-Key` + `X-MyDmsVn-Deployment-Epoch` cho sáu writes; GET status gửi `X-MyDmsVn-Deployment-Epoch` + `X-MyDmsVn-Operation-Fingerprint` từ **rehash** của frozen payload (không tin stored digest). Require server status identity operationId/kind/method/route/resource/fingerprint/epoch match and current actor/generation before SETTLED. Status GET chỉ đối soát, không auto resend; 401/403/404/timeout giữ safe state. User-confirmed SAME-ID/immutable-payload resend after absent status is conditional on backend B03/B04 SQL transaction serialization, tombstone, current authority and epoch; no automatic retry/new key. Expired/unavailable => operator-assisted reconciliation. Auth actor/generation fencing, Post ack/Get403 không tự invent version, IndexedDB operation marker, invalidate Inventory sau positive Posted. Controlled negative tests + browser UI recovery, giữ keyboard/focus/grants. Không mở rộng auth/JWT hay request retry policy.

**F04 — Integrated acceptance:** Tách nội bộ F04-A prepare browser specs against B05-A backend-owned fixture/SQL oracle; sau đó F04-B cùng B05-B chạy final pilot trên exact pins. Không đợi toàn bộ B05 đã DONE trước khi bắt đầu F04-A. Phối hợp backend B05 fixture + real physical SQL oracle. Dùng Playwright selector `web4-recovery` theo [pilot runbook](WEB4_PILOT_RUNBOOK.md) (giữ web3 and web2 selector), test reload/new tab, response lost after real commit, conflict/permissions, two-warehouse moving-average and dirty adjacent Sales; add switched DB epoch with same actor ID, stale actor-only layout and delayed POST/status, corrupted local fingerprint and valid-looking wrong COMMITTED metadata. Mỗi Chromium/Edge chạy fresh owned database và published React build; backend owns fixture/SQL cleanup, Web owns browser IndexedDB/UX/assertions. Final hosted PR/push CI (fake) và separate real HTTPS/SQL evidence. Không tuyên bố full IIS/production/attended.

**F05 — Product/operator handoff:** Document user-confirmed same-key resend/operator handling of UNKNOWN, command-specific outcomes with Write-without-Read, deployment epoch rotation, fail-closed IndexedDB/quota UX, secure per-actor draft clearance and existing production blockers. No secrets or automatic retry. Update plan/evidence after Owner acceptance only; archive execution plan and preserve historical evidence/links. Mọi docs-only check không tính thành runtime PASS.

## Test commands/ownership

~~~powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:unit
npm.cmd run test:e2e -- --project=chromium
npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1
~~~

Test focused theo behavior trước rồi full affected suites tại milestone cuối. Backend B02 CI chạy Windows .NET SQL-free; Web CI Linux sẵn có và không chứa SQL secrets. SQL real chạy theo backend owned Security.Tests nonproduction fixture; không tự tạo/chạy SQL runner từ Web.

## Báo cáo sau mỗi PR

~~~text
Task Fxx; baseline main Web/backend; pinned B01/B04 canonical corpus:
Mục tiêu/changed boundaries; source diff và existing invariants:
Commands/actual discovery; PASS/FAIL/SKIP; runner Browser/Node:
Browser real IndexedDB vs controlled fake vs real HTTPS/SQL:
Case lost response/unknown/revocation/recovery/dirty other document:
Clean-up, redaction, screenshot/ARTIFACT, mismatch/corrections:
Known limitations NOT RUN, PR review, next dependency:
~~~

Không lặp lại xin phê duyệt đối với quyết định nằm trong plan/contract đã được Owner chốt. Khi phát hiện thay đổi bản chất bảo mật, SQL schema, scope production hoặc runtime contract, chỉ báo cáo và xin lựa chọn cụ thể cho phạm vi mới.

## Historical handoff at WEB4-04 closeout

Frontend PR #20 merged at `604c02e3cd1e959fd976fb80d194371c9ceec42b`; backend PR #83 merged at `59ca21d16f7839c6d7c553395a367e465591652b`. F02/F03 and prerequisite B04 are accepted in their recorded bounded scope. No WEB4-04 implementation is left queued. At that closeout checkpoint, F04/F05 and backend B05/B06 were PLANNED and required separate selection; preserve the disabled same-key resend gate and production limits in [acceptance evidence](../evidence/web4/20261102-f03-operation-recovery.md#owner-acceptance-and-merge--2026-11-02).

## Historical handoff — WEB4-05 accepted 2026-11-02

Owner authorized F04 plus the B05 test fixture and fresh nonproduction SQL/IIS Express pilot. The accepted checkpoint is recorded in [F04 evidence](../evidence/web4/20261102-f04-failure-pilot.md); use the [WEB4 pilot runbook](WEB4_PILOT_RUNBOOK.md) for the versioned selector and backend-owned execution. Paired Chromium/Edge HTTPS/SQL verification, independent oracle and cleanup passed on separate fresh databases; Owner accepted; PR #21 and backend PR #84 merged 2026-11-02. F05/B06 remain PLANNED; same-key resend stays disabled, and full IIS/production plus attended candidate Telex/VNI/Narrator remain outside this acceptance.

## Current handoff — WEB4-06 selected 2026-11-02

Owner selected F05 and its B06 documentation companion. Read the [user recovery guide](WEB4_USER_RECOVERY_GUIDE.md) and [F05 evidence](../evidence/web4/20261102-f05-operator-handoff.md). Finish source/label/policy review and documentation checks, then submit the paired candidate for Owner acceptance. Keep this roadmap active until acceptance and PR merge are recorded; only then archive the execution plan with compatibility links and original evidence intact. Same-key resend, operator unlock and production remain unapproved; no runtime feature or SQL operation is selected by this handoff.

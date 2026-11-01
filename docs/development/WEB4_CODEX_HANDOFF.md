# Codex handoff — Roadmap 04 ReactWebUI

**Owner đã chọn WEB4-01/F01; local source/design checkpoint đã ghi, F01 BLOCKED — chờ B01 corpus. F02–F05 PLANNED / NOT RUN.** [Checkpoint và bước tiếp tục](WEB4_F01_SOURCE_CHECKPOINT.md) · [evidence](../evidence/web4/20261101-web4-01-contract.md). Chưa có WEB4 runtime implementation; không chạy F02 trước khi hoàn tất F01. Đọc: [AGENTS](../../AGENTS.md) → [roadmap selector](../plans/README.md) → [F-owning plan](../plans/20261101-002-web4-reliability-web.md) → [draft/recovery design](../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md) → [acceptance matrix](WEB4_WEB_ACCEPTANCE.md) → [TEST_POLICY](../TEST_POLICY.md). Backend counterpart [B-owning plan](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/plans/20261101-003-web4-reliability-server.md) và [wire journal contract](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB4_IDEMPOTENCY_JOURNAL_CONTRACT.md).

**Vòng đời liên kết hai repo:** Frontend main `609247737f5b6a312b40f8ea4fc353da5b1125e4` đã merge PR #18; backend main `48e9cd7ae096ecadd184e6ea6a372306d77f41b1` đã merge PR #79. Các tài liệu WEB4 được liên kết đã có trong committed main, nên liên kết active được đổi sang `/blob/main/`. Không xóa branch remote trong task này. Không chỉnh sửa historical WEB1–03 hoặc xem docs-only là runtime PASS.

## Nguyên tắc giao task

- Trước mỗi task đọc current main/PR đã merge, actual src + tests + package versions, không lấy một nhánh WEB3 lịch sử làm base. Tạo branch mới, một task/PR tập trung, evidence riêng với lệnh và số test thực chạy.
- Backend B01 phải chốt exact canonical request/status và proof transaction UoW. Không implement fake-shaped API từ TS trước khi backend publish corpus. F01/F02 có thể viết test storage độc lập nhưng F03 HTTP phải pin B04 implementation.
- Giữ Zustand feature stores, Dockview ownership và existing close admission/barrier; không tạo một generic ERP form/state framework. Auth session vẫn lưu JWT access localStorage và refresh HttpOnly, nhưng IndexedDB không lưu chúng.
- Khi API write đã dispatch và mất response, backend có thể đã commit. GET status có thể cho positive COMMITTED; GET 404/403/timeout không chứng minh rollback. **Không tự POST/PUT lại** hay sinh operationId mới trong background.
- Mọi testcase mô phỏng keyboard dùng key-by-key cho lookup/Enter/Tab/focus nếu mục tiêu là hành vi; không dùng fill() để chứng minh IME. Browser thật cần Dockview+AG Grid+Floating UI và IndexedDB, không chỉ mock DOM.
- Frontend production artifact không được có Lab/fake actor. Giữ Nova/Base UI mặc định, không bắt buộc Business Compact/WinForms/14px; không đổi packages ngoài scope được kiểm chứng.

## PR flow Codex đề nghị

**F01 — Contract consumer checkpoint:** Freeze backend B01 original per-command results (Create/Update full authorized Write detail/version, Sales Post with version, Receipt Post without), explicit user-confirmed same-key resend policy, and server deployment/database epoch before IndexedDB reads. Inventory source owners: src/app/runtime/createProductionRuntime.tsx; feature Sales/Receipt commands/session/buffer/recovery; authSession/httpTransport/writeBoundary; panelRegistry, **layoutPersistence.ts/layoutPersistenceV2.ts, workspaceLayouts.ts, documentContracts.ts** (actor-only storage v1/v2, auto-restore of document IDs). F01 must freeze epoch-aware v3 layout scope/non-migration and WEB4 epoch+expected-fingerprint headers/status metadata before implementation. Đọc source B01 canonical contract/fixtures, tạo mirror pinned manifest (không sửa backend corpus), consumer codec/test vectors và bản đồ draft/unknown/actor/close. F01 chỉ documentation/tests contract; không tuyên bố IndexedDB/HTTP mới đã chạy. Viết source+contract SHA và gap dispositions.

**F02 — IndexedDB durable adapter:** Tạo typed narrow adapter trong src/infrastructure/drafts/* với namespace backend-authenticated epoch + actor + module/doc; các feature adapters hỗ trợ freeze/capture/restore, session revision. Hook awaited flush đúng admission và trước mutation, deferred write coalescing không overwrite revision mới. Actor scope/authenticated preview, schema version/validation, quota/private/corruption/test thật. Giữ raw buffers và clientLineId; clear/purge chỉ theo policy, unknown không silently clear. Product policy: IDB quota/denied/abort **before dispatch blocks mutation** with user-visible retry local save and quota guidance; RAM editing/read-only allowed, no silent bypass. Add same-origin userId/different database epoch for **both IndexedDB and Dockview layout v1/v2/v3**, no actor-only layout auto-import, panel/late read fencing and failed purge tests. Test RED→GREEN khi có bug, Chrome/Edge focused IndexedDB + existing Sales/Receipt Grid/workspace regressions.

**F03 — Idempotent client and recovery UI:** B04 API contract đã pin. Sau editor Save barrier freeze payload, sinh GUIDv4 duy nhất cho user intent, persist operation record trước network dispatch; gửi `Idempotency-Key` + `X-MyDmsVn-Deployment-Epoch` cho sáu writes; GET status gửi `X-MyDmsVn-Deployment-Epoch` + `X-MyDmsVn-Operation-Fingerprint` từ **rehash** của frozen payload (không tin stored digest). Require server status identity operationId/kind/method/route/resource/fingerprint/epoch match and current actor/generation before SETTLED. Status GET chỉ đối soát, không auto resend; 401/403/404/timeout giữ safe state. User-confirmed SAME-ID/immutable-payload resend after absent status is conditional on backend B03/B04 SQL transaction serialization, tombstone, current authority and epoch; no automatic retry/new key. Expired/unavailable => operator-assisted reconciliation. Auth actor/generation fencing, Post ack/Get403 không tự invent version, IndexedDB operation marker, invalidate Inventory sau positive Posted. Controlled negative tests + browser UI recovery, giữ keyboard/focus/grants. Không mở rộng auth/JWT hay request retry policy.

**F04 — Integrated acceptance:** Tách nội bộ F04-A prepare browser specs against B05-A backend-owned fixture/SQL oracle; sau đó F04-B cùng B05-B chạy final pilot trên exact pins. Không đợi toàn bộ B05 đã DONE trước khi bắt đầu F04-A. Phối hợp backend B05 fixture + real physical SQL oracle. Tạo Playwright web4 mode (giữ web3 and web2 selector), test reload/new tab, response lost after real commit, conflict/permissions, two-warehouse moving-average and dirty adjacent Sales; add switched DB epoch with same actor ID, stale actor-only layout and delayed POST/status, corrupted local fingerprint and valid-looking wrong COMMITTED metadata. Mỗi Chromium/Edge chạy fresh owned database và published React build; backend owns fixture/SQL cleanup, Web owns browser IndexedDB/UX/assertions. Final hosted PR/push CI (fake) và separate real HTTPS/SQL evidence. Không tuyên bố full IIS/production/attended.

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


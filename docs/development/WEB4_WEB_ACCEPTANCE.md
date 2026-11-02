# WEB4 — Frontend acceptance matrix (F01–F05)

**Tại docs activation:** tất cả scenario PLANNED / NOT RUN; cập nhật F01 contract được ghi bên dưới. Current bounded F02/F03 runtime verification is recorded in [F02 evidence](../evidence/web4/20261102-f02-durable-drafts.md), [F03 evidence](../evidence/web4/20261102-f03-operation-recovery.md) and historical section 5 below. WEB4-05/F04 is DONE (bounded); [F04 evidence](../evidence/web4/20261102-f04-failure-pilot.md) owns current results and remaining gates, including passed paired Chromium/Edge HTTPS/SQL, independent oracle and cleanup on separate fresh databases; Owner accepted; PR #21 and backend PR #84 merged 2026-11-02. F05 remains PLANNED. [Frontend plan](../plans/20261101-002-web4-reliability-web.md) sở hữu F task state, [thiết kế local draft](../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md) sở hữu IndexedDB/lifecycle. Backend sở hữu journal canonical HTTP/SQL và [B matrix](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/development/WEB4_BACKEND_ACCEPTANCE.md). Tên ID dưới đây là yêu cầu nghiệm thu, KHÔNG mặc nhiên là tên test runnable.

## 1. Level bằng chứng

**F01 checkpoint 01/11/2026:** [evidence](../evidence/web4/20261101-web4-01-contract.md) ghi existing frontend regression và local boundary review. B01 đã publish/pin; W4-CON-01/02 **PASS (contract)** qua 14 consumer cases trong final suite 777/777 PASS; chưa phải SQL/runtime settlement. W4-LAY-01 mới chốt design, v3 runtime **NOT RUN**. Không scenario WEB4 runtime nào được suy PASS từ regression WEB2/WEB3 hoặc contract oracle.

| Level | Runner | Chứng minh | Không chứng minh |
|---|---|---|---|
| Unit/component | Vitest/Testing Library, injected draft/port | snapshot, schema validator, intent, state, errors | browser IndexedDB crash behavior, SQL |
| Browser frontend | Playwright Chromium/Edge với Dockview/AG Grid/IndexedDB thật, HTTP controlled | focus, keyboard, lifecycle, local durable restore, UI reconciliation | real server commit/valuation |
| Backend SQL | MyDmsVn Security/Inventory/Migrations | transaction/journal, permission, physical balances | Web UX, IndexedDB |
| Live pilot | Published React + IIS Express HTTPS net48 + SQL + Chromium/Edge | Browser→HTTP→SQL, independent physical ledger/COGS | full IIS/production, attended IME |
| Attended | Người vận hành thật | Telex/VNI/Narrator/Edge behavior | Không tự kế thừa từ WEB1 hoặc Chrome fake |

## 2. Matrix theo boundary

| ID | Người sở hữu | Bước chạy → điều phải khẳng định |
|---|---|---|
| W4-CON-01 | F01 | Pinned B01 canonical corpus, decimal strings, int64, expectedVersion, method/route/lines; 0 drift và hash manifest đúng |
| W4-CON-02 | F01 | Contract-only: payload/route/version khác sinh fingerprint khác, status identity mismatch bị từ chối và canonical conflict envelope hợp lệ; real same-key serialization/conflict vẫn thuộc B03/B04/B05 |
| W4-DRAFT-01 | F02 | Gõ raw invalid decimal từng phím, confirmed lookup, re-sort grid, persisting revision; reload giữ đúng raw và clientLineId |
| W4-DRAFT-02 | F02 | Sales hai dòng cùng Product/Gift và Receipt unique Product; 200 dòng; preserve order/identity, không dedup/round |
| W4-DRAFT-03 | F02 | Browser reload sau IndexedDB transaction hoàn tất: phục hồi snapshot chính xác, chưa commit record cuối không được tuyên bố durable |
| W4-DRAFT-04 | F02 | Debounced out-of-order writes/close flush/rapid edit: revision mới thắng; no stale write clobber |
| W4-DRAFT-05 | F02 | Quota fail, IDB transaction abort, private/denied, schema corrupted/version unsupported: visible error, no claim durable or implicit write |
| W4-DRAFT-06 | F02 | Logout/another actor/refresh failure: draft cũ không render, memory/cache fenced, no tokens/cookies stored |
| W4-DRAFT-07 | F02 | Move/split/remount Dockview, close-all Cancel/Discard/Save, pending/unknown: existing admission preserved |
| W4-DRAFT-08 | F02 | Cùng actor và hai tabs cùng document, conflict revision; không silently last-writer-wins |
| W4-LAY-01 | F01/F02 | Old actor-only v1/v2 layout with document server IDs is not auto-restored/imported on WEB4; default safe v3 layout keyed and enveloped by epoch+actor, legacy bytes preserved for user disposition |
| W4-LAY-02 | F02 | Same origin and numeric userId, switched DB/epoch: v3 layout, panel ownership and pending document reads fenced; no old document ID opened even if ID exists in new DB |
| W4-OP-01 | F03 | Stable UUIDv4 generated once after Save barrier and persisted with frozen payload before HTTP, no mutation dispatched before durable ack |
| W4-OP-02 | F03 | Create committed but response lost → reload → GET status COMMITTED → exactly one source, correct ID; no replay |
| W4-OP-03 | F03 | Update response lost → receipt/sales lines remain stable, version only accepted when authoritative; no extra Save |
| W4-OP-04 | F03 | Post ack lost → operation status proves Posted, never invent rowversion or require Read for minimal ack |
| W4-OP-05 | F03 | 403/404/5xx/timeout from status: UNKNOWN remains locked; no POST even after refresh, HMR, remount or tab switch |
| W4-OP-06 | F03 | Current permission revoked/actor changed while readback pending: result not applied or leaked |
| W4-OP-07 | F03 | Explicit user changes intent payload/expectedVersion: new op only when allowed; no mutable key reuse |
| W4-OP-08 | F03 | Double click/Enter/Tab/cross-tab action while pending: one immutable intent, no new unsafe network write |
| W4-OP-09 | F03 | Intent persisted, crash before HTTP dispatch, status absent; user-confirmed resend SAME UUIDv4 and immutable payload only under backend proof, no new ID |
| W4-OP-10 | F03 | Delayed original request races same-key user-confirmed resend; backend SQL journal produces one business effect |
| W4-OP-11 | F03 | Expired/tombstone, revoked grant, corrupted intent, changed deployment epoch or unavailable journal => resend blocked, UNKNOWN/operator reconciliation |
| W4-OP-12 | F03 | Read denied but Write allowed: Create/Update recover original full authoritative result/version/line IDs; Sales Post version retained, Receipt Post lacks version |
| W4-DRAFT-09 | F02 | Same-origin/same-userId different server-issued deployment epoch => no cross-database draft/operation preview |
| W4-DRAFT-10 | F02 | Quota/IDB denied/transaction abort before dispatch blocks Save/Post with retry local save + warning; RAM edit and read-only remain; after-dispatch failure preserves UNKNOWN |
| W4-OP-14 | F01/F03 | Original frozen method/route/resource/body/version rehashed using B01 canonical corpus; local hash corruption/missing payload never issues SETTLED status |
| W4-OP-15 | F03 | Server status identity operationId/kind/method/routeScope/**original requestTargetId** (null for Create)/fingerprint/epoch must match frozen local intent, with resulting document ID separately verified inside the authoritative Create outcome and current actor/generation; valid-looking mismatched COMMITTED remains UNKNOWN and does not invalidate stock |
| W4-OP-16 | F03 | Six writes + status GET carry current epoch header; status GET carries fresh expected fingerprint; missing/wrong/stale header rejected by backend before write/readback, no old-tab cross-database effect |
| W4-INV-01 | F03 | Positive Post or recovered Posted cancels stale reads before invalidating matching inventory keys; does not mutate other dirty tab |
| W4-LIVE-01 | F04+B05 | Real SQL Create commit response lost/reload: same operation committed once, frontend sees correct UX |
| W4-LIVE-02 | F04+B05 | Real SQL Update then Post with lost ack: ledger/valuation only one operation each; Q/V/COGS frozen |
| W4-LIVE-03 | F04+B05 | Real SQL same key concurrent attempts and key mismatch: zero duplicate effects, deterministic status |
| W4-LIVE-04 | F04+B05 | Receipt → Sales → backdated Receipt same stock key and separate warehouse; oracle physical SQL Q/V/COGS |
| W4-LIVE-05 | F04+B05 | New/old actor and permission revocation, Read denied, server errors, CSP/Origin/refresh/no-secret guard |
| W4-LIVE-06 | F04+B05 | Independent fresh Chromium/Edge DB; real browser cases+separate .NET wrapper+cleanup; no overlapping accounts |
| W4-OP-13 | F03/F05 | Expired/missing journal outcome requires operator correlation/positive SQL evidence, no Edit unlock without authorized version and no retry under changed actor/epoch |
| W4-LIVE-07 | B05-A / F04-A / B05-B+F04-B | Backend test-only fixture and physical SQL oracle prepared before frontend final spec; final paired Chromium/Edge nonproduction acceptance after both A checkpoints, no circular dependency |
| W4-LIVE-08 | F04+B05 | Same-origin same-userId DB epoch switch with old tab delayed POST/status + stale actor-only v2 layout: no new DB write, no stale document open/COMMITTED applied |
| W4-DOC-01 | F05 | End-user recovery/status and technical runbooks complete; historical archives untouched |

## 3. Lệnh và gates đề xuất (xác nhận actual project trước chạy)

~~~powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:unit
npm.cmd run test:e2e -- --project=chromium --workers=2
npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1
~~~

Kiểm thử Edge focused theo playwright.edge.config.ts; native browser IndexedDB phải kiểm tra trên production build hoặc actual dev browser context được sở hữu, không chỉ jsdom double. Live pilot chạy từ backend-owned IIS Express fixture bằng selector `web4-recovery` theo [WEB4 pilot runbook](WEB4_PILOT_RUNBOOK.md); không tự gọi Vite stub là SQL. Cuối F04 chạy hosted frontend PR/push CI trên final head và các SQL/HTTPS browser local đúng candidate, backend B05 xác nhận independent oracle. Không cộng các lần chạy lặp thành test case mới.

## 4. Quy tắc evidence và chấp nhận

Mỗi case thực thi phải ghi exact source/frontend/backend SHA, browser/node/OS/SQL và phiên bản fixture, lệnh, discovered/executed counts, PASS/FAIL/SKIP, những lỗi trước sửa, đúng phạm vi test, cleanup, video/trace/HAR secrets không commit. RED/green regression tập trung nếu tìm lỗi thật. Test thiếu/skipped không PASS. Fake browser không thay SQL; hosted CI Linux không thay native Windows; Chromium/Edge automated không thay attended Telex/VNI/Narrator. WEB4 closeout chỉ sau Owner acceptance và không bao gồm full IIS/production.

## 5. Historical WEB4-04 bounded acceptance — 2026-11-02

Owner accepted WEB4-04/F02+F03 and authorized the merged PRs on 2026-11-02; see [closeout evidence](../evidence/web4/20261102-f03-operation-recovery.md#owner-acceptance-and-merge--2026-11-02). The following table preserves the status at that WEB4-04 checkpoint. These are coverage mappings, not a blanket PASS for every live scenario or subcondition. The dated evidence owns commands, actual case counts and source pins.

| Requirement group | Verified boundary / outstanding gate |
|---|---|
| W4-DRAFT-01–10, W4-LAY-01–02 | F02 typed snapshot/queue/layout unit tests and native Chromium/Edge IndexedDB plus production-component controlled HTTP browser checks; F03 extends atomic intent/CAS/terminal cleanup. Physical browser process crash and live SQL epoch-switch pilot remain F04/B05. |
| W4-OP-01, 07–08, 14–16 | F03 strict canonical codec, immutable prepared intent, actor/epoch/revision/grant fences, two-store transaction completion and cross-tab CAS; malformed/corrupt/mismatched metadata cannot settle or dispatch. Unit/native browser checks and actual port/OWIN/SQL checks have separate evidence. |
| W4-OP-02–04, 12 | Six production-component reload/status cases on Chromium and Edge with controlled HTTP and denied Read. Separately, actual TypeScript ports through TestServer/SQL recover six commands and verify original IDs/versions plus SQL effects. This is not production React + IIS Express + SQL browser acceptance. |
| W4-OP-05–06, 11, 13 | Negative status, expired result, wrong identity, corrupt intent, late scope and storage failures remain locked. Operator metadata remains visible; no automatic replay or public Get settlement. Authorized human operator disposition/runbook remains F05/B06. |
| W4-OP-09–10 | Product same-key resend remains disabled pending real OS process-crash/Commit proof. Explicit replay/races in backend tests and the actual-port bridge are narrower evidence, not completion of these browser acceptance gates. |
| W4-INV-01 | Unit and controlled HTTP browser regressions preserve positive Posted invalidation, stale-read cancellation and dirty adjacent Sales. Real ledger/valuation browser pilot remains F04/B05. |
| W4-LIVE-01–08, W4-DOC-01 | NOT RUN / not selected in WEB4-04. F04+B05 and F05+B06 remain PLANNED; full IIS/production and attended candidate IME/Narrator are not approved. |

The first direct business rejection path and terminal payload cleanup are additionally verified as described in [design §11](../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md#11-f03--implemented-local-operation-lifecycle-2026-11-02); neither changes the rule that an older UNKNOWN requires positive authorized reconciliation.

## 6. WEB4-05 verified candidate — 2026-11-02

Owner selected F04 and authorized the B05 fixture with fresh nonproduction HTTPS/SQL runs. [F04 evidence](../evidence/web4/20261102-f04-failure-pilot.md) records frontend regressions separately from live browser cases, backend wrapper/oracle and cleanup; it owns exact pins, counts, earlier failures and outstanding gates. Paired Chromium/Edge HTTPS/SQL verification, independent oracle and cleanup passed on separate fresh databases; Owner accepted; PR #21 and backend PR #84 merged 2026-11-02. This selection does not complete F05/W4-DOC-01, enable same-key resend, or approve full IIS/production or attended IME/Narrator.

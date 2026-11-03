# WEB6 frontend acceptance — one-shot original resend and paired nonproduction quality

**2026-11-03: PLANNED / NO WEB6 RUNTIME TEST HAS EXECUTED.** [Own plan](../plans/20261103-001-web6-recovery-quality-web.md) · [UX/durable design](../design/WEB6_MANUAL_RESEND_AND_RECOVERY_UX.md) · [Codex handoff](WEB6_CODEX_HANDOFF.md) · [backend acceptance](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/development/WEB6_BACKEND_ACCEPTANCE.md). Existing WEB5 1,397 frontend unit, 275 full Chromium, 125 focused Edge and actual SQL-bridge runs are historical pinned evidence, not current WEB6 PASS.

## 1. Mandatory gate register

| ID | Owner | Observed result required | Current |
|---|---|---|---|
| F6-CON-01 | F01 | Source tree/contract/draft/operation/permissions map, unchanged original frozen WEB4 48 blobs and WEB5 40 resolution files | NOT RUN |
| F6-CON-02 | F01 | Backend B01 trusted expiry/eligibility and six-command policy; exact developer/user consent wording; flag default OFF | NOT RUN |
| F6-RES-01 | F02 | Original frozen ID/key, fingerprint, HTTP route/method/target/body and expectedVersion identical; strict Zod/hash; no fresh GUID | NOT RUN |
| F6-RES-02 | F02 | Atomic IDB persisted one-shot claim before dispatch, current draft+operation CAS, 2 tab contenders/1 winner, loser zero HTTP | NOT RUN |
| F6-RES-03 | F02 | Claim collision, quota/transaction abort, IndexedDB versionchange/blocked upgrade, corrupt record and permission change do not create unsafe send or discard raw draft | NOT RUN |
| F6-RES-04 | F02 | Claim persists across reload/crash, no auto resend on rehydration/offline→online, bounded GET-only recovery | NOT RUN |
| F6-RES-05 | F02 | Actor/epoch/session/grant/generation/document/editRevision fences before and after awaits; stale result cannot mutate another store | NOT RUN |
| F6-RES-06 | F02/F03 | COMMITTED GET settlement; COMMITTED result unavailable/expired stays locked; NTE only new intent; 404/timeout/wrong host never authorizes by itself | NOT RUN |
| F6-RES-07 | F03 | Real UI explicit consent, accessible modal, correct possible business effect warning, no hidden Enter/Tab/Escape/double-click dispatch | NOT RUN |
| F6-RES-08 | F03 | Six Create/Update/Post Sales/Receipt original intents through native Chromium and focused Edge + backend B04 actual SQL, at most one HTTP transmission per consent and one business effect | NOT RUN |
| F6-RES-09 | F02/F03 | No mutation auto retry on 401/refresh/timeout/5xx/reconnect; `retryLocalResult` remains no-HTTP and protected; safe GET allowed | NOT RUN |
| F6-RES-10 | F03 | Real IndexedDB 2-tabs, close/reopen, actor switch, revoked original Write/Post, ordinary Read denied original Write/Post allowed readback, old negative lineage | NOT RUN |
| F6-BRW-01 | F03 | Unit/component/typecheck/build/artifact isolation, full Chromium and focused Edge selected counts 0 skipped at exact source; native IDB/AG Grid/Dockview/Floating UI behavior | NOT RUN |
| F6-BRW-02 | F03 | Windows attended Telex/VNI/100%+125% if possible; unperformed Narrator explicitly NOT RUN with Owner-scoped exception, not PASS | NOT RUN |
| F6-PAIR-01 | F04 | Matched backend/net48 + frontend compiled SHA/hash, locked deps, schema13/`web5`/separate runtime-operator grants, full six-command + original/negative SQL oracle | NOT RUN |
| F6-PAIR-02 | F04 | Owned IIS Express HTTPS and real two browsers, JWT/refresh/cookie/CSRF/Origin/CSP, SQL/HTTP.sys host identity proof, cleanup of only new disposable fixtures | NOT RUN |
| F6-COMP-01 | F04 | Old cached WEB4 tab/new compatible host, new frontend/old host no resend feature, pending UNKNOWN, same epoch code deploy, matched rollback without unsafe schema downgrade | NOT RUN |
| F6-LOAD-01 | F04 | Real-world mixed actor/browser/api workload with per-kind count, p50/p95/p99, errors/timeout, journal/SQL/worker effect and known sample size; no fake SLA | NOT RUN |
| F6-REC-01 | F04 | Operator support case/positive COMMITTED-unavailable, true service restore RPO/RTO and UNKNOWN age from actual candidate; not inferred from backup seconds | NOT RUN |
| F6-REL-01 | F05 | User/support guide differentiates GET, manual same-key, terminal negative/new intent and business-case support closure | NOT RUN |
| F6-REL-02 | F05 | Exact candidate targets vs measured results, source+artifact/CI provenance and explicit Owner decision: pilot-enable vs staging vs production | NOT RUN |

## 2. Required native scenario sets

### Resend and terminal outcome (each of 6 command kinds)

1. Fresh first write made UNKNOWN by deliberate response suppression while SQL COMMITTED: **protected original GET recovers**, UI sends no extra POST/PUT when result available.
2. Same original frozen request manually resent after explicit review where allowed: **exact same ID/key/header/body/route**. If original already COMMITTED, get original response and no double business effect; if original never committed, only one first effect can occur.
3. Concurrent original writer and resend contender; operator-first terminal and original-first operator-fence: control signaled SQL barriers; one effect maximum and correct NTE suppression. No arbitrary sleeps as sole race proof.
4. COMMITTED but expired/unavailable result and true NOT_EXECUTED: old key never resent, keep protection or require NEW separately reviewed intent, preserve editable baseline constraints.
5. Denied/stale/actor/epoch/generation/permission/old host/expired retention/invalid fingerprint/format: button disabled and zero HTTP writes; no information leakage.
6. IDB/quota/blocked/two tabs/reload/late original response: one durable claim, no unsolicited network, no raw-line mutation or stale CAS settlement.

### Browser and interoperability

- Verify actual Sales duplicate Product and Gift behavior, Receipt unique Product, stable clientLineIds, correct Unit/Qty/Price decimals and specific Post ack (Sales version vs Receipt without version). Keep original results and server valuation authoritative.
- Verify React focus, keyboard Enter/Tab/Escape and IME composition in AG Grid/Floating UI, Dockview close, restored tab and active dialog. The confirmation modal must never fire automatically via focus restoration.
- Native Chromium full project regression and focused Windows Edge after changing runtime, not just mounted component tests. Chromium Linux hosted CI does **not** certify Windows Edge/Telex/VNI/Narrator.
- Actual port/SQL wrapper and browser runners need independent journal/source/stock/ledger/COGS oracle plus cleanup count and exact candidate ownership.
- Production bundle must contain no test-only fake runtime/Lab artifacts and no token/SQL credential embedded.

## 3. Wire and trust boundaries

Original `web4-v1` frozen request is the only manual resend payload. It must pass `decodeFrozenWeb4Operation`, canonical rehash, original operation kind permission and server authority, current actor/epoch and draft C(A)S. A status/eligibility read is not a reservation. Do not let the frontend re-hydrate a different actor's operation, infer a negative from `Operation.NotObserved` or choose a new GUID when retrying.

The browser stores only durable draft/frozen operation/claim and sanitized support IDs; **never** JWT, refresh cookie, raw operator audit, SQL credential or permissions in IndexedDB. Access token remains in localStorage per prior Owner decision; CSP/XSS risk stays explicit. A temporary feature flag is a UI gate, not an authentication claim.

## 4. Execution proof and error accounting

For each candidate log selected browser project/OS/Playwright version, test source+artifact hashes, expected/discovered/executed/pass/fail/skip/retries, durations, UI trace/screenshots with redaction, native IDB proof, SQL wrapper outcome, physical oracle and owned teardown. A case inside a grouped browser test is **not** another browser-test count. A local browser PASS never implies hosted SQL or full IIS. Use `PASS` only when run and correct; otherwise `NOT RUN`, `FAIL`, `BLOCKED` or justified `NOT_APPLICABLE`. Report transient failures and subsequent reruns, not only final green count.

## 5. Release and stop rules

- **No pilot enable** before backend B04 and frontend F02/F03 actual SQL/native-browser acceptance, explicit Owner approval and current candidate-bound feature flag. A development branch may contain gated code OFF.
- **No production GO** before backend B06/F05 target-versus-measured signoff, stable operator workflow and all mandatory environment/runtime policy gates. Full IIS and unperformed Narrator are Owner-accepted NOT RUN for the bounded nonproduction topology only.
- **Immediate STOP** on any automatic HTTP mutation resend, new UUID replacing original for manual consent, persisted-claim race with two requests from one consent, second SQL business effect, action after revoked grant/epoch, fake terminal negative, unknown host/SQL ownership or unredacted support export.
- Historical WEB5 quarantine and CEX are untouched. A bounded WEB6 closeout may document unverified production gates without relabeling them PASS.

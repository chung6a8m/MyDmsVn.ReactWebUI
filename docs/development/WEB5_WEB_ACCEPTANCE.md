# WEB5 frontend acceptance matrix — recovery and production stage

**Owner selected 2026-11-02; F01–F05 PLANNED / NOT RUN.** These IDs are **acceptance requirements, not actual Playwright/Vitest test names or PASS evidence**. [Owning plan](../plans/20261102-001-web5-operational-safety-web.md) · [UX design](../design/WEB5_RECOVERY_AND_RELEASE_BOUNDARIES.md) · [Codex handoff](WEB5_CODEX_HANDOFF.md) · [WEB4 historical acceptance](WEB4_WEB_ACCEPTANCE.md).

## 1. Test levels and required separation

| Level | Runner | Establishes | Does NOT establish |
|---|---|---|---|
| Unit/Component | Vitest + Testing Library/injected repo | Codec, state/CAS/permissions, error transitions | Native IDB persistence, SQL |
| Native frontend browser | Playwright Chromium/Edge, real IndexedDB/Dockview/AG Grid, controlled HTTP | Actual UI, reload, focus, race and local durability | Real SQL Commit/full IIS |
| Bridge | Production TypeScript ports → TestServer → SQL | Actual original command headers + protected response + physical SQL | Full IIS/browser UX |
| Real IIS stage | Published React + backend full IIS + separate fresh SQL + Chromium/Edge | End-to-end auth/proxy/replay/stock and staging | Human IME/Narrator without attendance |
| Attended | Human Windows/Edge Telex/VNI/Narrator and keyboard | Typed input, announcements and focus on exact candidate | Automatic rollback/prod operations |

F02 cannot consume invented B02 response; actual backend versioned corpus/hash must be pinned. B01 and B04-A can proceed in parallel; B02 code needs B04-A protected SQL CI PASS, and B04-B must prove B02 exact candidate BEFORE backend B02 acceptance. Frontend mock/runtime tests do not substitute for B04-A/B. If B01/B02 safety proof absent, product resend remains disabled even if simulated HTTP tests pass. Browser result and .NET wrapper count are two different quantities.

## 2. Acceptance scenarios by owning task

| ID | Owner | Required result |
|---|---|---|
| F5-CON-01 | F01 | Inventory actual WEB4 frozen code and operation identity; no drift of 48 canonical corpus blob hashes |
| F5-CON-02 | F01 | Account/epoch/generation/draft/operation/session/layout ownership and local editRevision/capability boundary mapped |
| F5-CON-03 | F01 | Crash before dispatch vs Commit uncertainty vs response loss explicitly distinguished; status404 never unlocks |
| F5-CON-04 | F01 | Proposed new authoritative B02 result contract agreed before any F02 fetch/decoder implementation |
| F5-RES-01 | F02 | Six commands positive original COMMITTED after reload, exact ID/version/line binding and Post ack differences |
| F5-RES-02 | F02 | COMMITTED without original result/version and EXPIRED stay protected, no fabricated edit baseline |
| F5-RES-03 | F02 | Durable terminal NOT_EXECUTED with exact actor/epoch/fingerprint/intent/authorization releases only its own pending lock after local CAS |
| F5-RES-04 | F02 | Missing/invalid/mismatched/late operator certificate, malicious actor/epoch swap, permission revoke, 403/404/5xx remain UNKNOWN |
| F5-RES-05 | F02 | Negative certificate storage abort/quota/versionchange retains lock and retries **local-only**, no HTTP resend |
| F5-RES-06 | F02 | After terminal negative, fresh authorized baseline and user explicit edit/reintent needed; no auto-Post or fake rowversion |
| F5-RES-07 | F02 | User-confirmed SAME-key resend remains **disabled** absent B01+B02+Owner gate; if enabled, original bytes/key sent only once per consent and not on reload/timer |
| F5-RES-08 | F02 | Two-tab same record/operation CAS conflict preserves both raw buffers; only one optional allowed resend, no stale scope effect |
| F5-RES-09 | F02 | Restore invalid raw/lookup, stable clientLineId, Sales duplicate Product/gift and Receipt unique Product; int64/decimal unchanged |
| F5-RES-10 | F02 | Read denied/Write allowed resolves original authorized detail without public Get, Post never invents version |
| F5-RES-11 | F02 | Error/UNKNOWN/support UI keyboard accessible; corrupt record shows **unverified** correlation only and never issues HTTP |
| F5-BRW-01 | F03 | Native Chromium+Edge IndexedDB transactional completion, reload/close/denied/quota and wrong-version isolation |
| F5-BRW-02 | F03 | Actual Dockview/AG Grid/Floating UI, close admission, rapid Enter/Tab, arrows, composition, focus and feedback |
| F5-BRW-03 | F03 | Actor/DB epoch change, v3 layout and stale Promise cancellation prevent cross-database document/stock |
| F5-BRW-04 | F03 | Current PR hosted secret-free CI passes unit/Chromium/typecheck/build/artifact; focused Edge separately runs on Windows |
| F5-BRW-05 | F03 | Actual backend SQL bridge and independent journal/ledger oracle PASS only when real SQL runner is invoked and owned |
| F5-IIS-01 | F04 | True W3SVC/WAS full IIS with matched published assets, CSP nonce and authenticated HTTP, not IIS Express |
| F5-IIS-02 | F04 | Distinct fresh Chromium/Edge real HTTPS/SQL pilot with six commands, negative, late-original/race, oracle and cleanup |
| F5-IIS-03 | F04 | Forged headers/Origin, cookie/refresh/CSRF/revocation, wrong mode/key/epoch and multiworker abuse controls |
| F5-AT-01 | F04 | Attended Telex and VNI key-by-key lookup/grid/raw/caret, keyboard navigation and composition |
| F5-AT-02 | F04 | Attended Narrator ARIA and focus through recovery dialog, screen reader and keyboard-only flow |
| F5-AT-03 | F04 | Attended actual 100%/125% Windows scaling and Light/Dark at 1280×720/1440×900; no obstructed actions |
| F5-REL-01 | F05 | Updated accurate user guide and operator correlation/negative/resend distinctions |
| F5-REL-02 | F05 | Paired exact frontend/backend SHA/hash/CI/SQL/IIS/AT dossier and risks |
| F5-REL-03 | F05 | Owner signed explicit PRODUCTION GO/NO-GO or DEFERRED, no implicit promotion or unsupported archive |

### Extended review gates (2026-11-02)

| ID | Owner | Required result |
|---|---|---|
| F5-RES-12 | F02/F05 | SQL COMMITTED but original result expired/unavailable: business support ticket may close, local operation remains PROTECTED; no fake version/line ID/new-key retry |
| F5-RES-13 | F02/F05 (conditional) | User-approved case/draft archival retains minimal durable support linkage and raw data policy, preserves journal/tombstone, never mutates/reopens old intent; quota/CAS/another tab failures stay protected |
| F5-COMP-01 | F01/F02 | Consume backend B02 ADR additive WEB4 compatibility OR strict server-enforced version fence on EVERY mutation/status, not only /context |
| F5-COMP-02 | F04 | Old cached bundle/live authenticated tab→new full IIS host, new client→old host, pending UNKNOWN, refresh/logout and rollback; verify no mixed-version unsafe writes |
| F5-IIS-04 | F04 | Exact client/host/mode/schema compatibility matrix and SQL oracle for old/new tab + cutover; epoch reserved for database, never bundle version |
| F5-IIS-05 | F04 | Real IIS representative load p50/p95/p99, error/timeout, throughput, resource/journal impact and actual backup/alert/RPO/RTO; proposed numeric thresholds before acceptance |
| F5-REL-04 | F05 | User guidance distinguishes COMMITTED-result-unavailable BUSINESS case closure from client edit recovery and seven-day escalation |
| F5-REL-05 | F05 | Paired Owner-approved threshold-vs-measured register with IIS load, error, RPO/RTO, alerts, UNKNOWN age and explicit exceptions/NO-GO |

## 3. Actual commands (after task code exists)

~~~powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:unit
npm.cmd run test:e2e -- --project=chromium --workers=2 --forbid-only
npm.cmd run test:e2e -- --config playwright.edge.config.ts tests/e2e/web4RecoveryWorkspace.spec.ts tests/e2e/web4OperationRepository.spec.ts tests/e2e/durableDraftWorkspace.spec.ts --workers=2 --forbid-only
npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1 --forbid-only
~~~

These are existing runner examples, **not** commands executed in the documentation-only activation. Newly added WEB5 specs/paths are task-owned and must be checked after implementation. Do not claim Edge full-suite from a focused selection. Native browser checks may use controlled HTTP for UI but cannot claim SQL correctness; coordinate live full IIS/SQL cases via backend-owned fixtures. No `ignoreHTTPSErrors`, Browser plugin dependency, fake production ports, test secrets or public unredacted traces/HAR.

## 4. Evidence criteria

For each task save dated `docs/evidence/web5/YYYYMMDD-fxx-...md`: exact source/frontend/backend SHA, original frozen B01 hash and new B02 contract hash, Node/npm/browser/OS/IIS/SQL versions, discovered/executed/pass/fail/skip, fixture ownership/cleanup, intentionally failed attempts and corrections, screenshots reviewed without secrets, attended operator details and remaining NOT RUN gates. No reusing WEB4 candidate or earlier main CI as a newly executed WEB5 run. Plan owns status; acceptance table does not itself mark PASS.

**B01/B02/B04 block:** Real OS process crash is a backend requirement; HTTP mocks cannot prove Commit. B04-A protected SQL must precede B02 runtime work, B04-B must pass the six-command terminal/compatibility tests on B02 exact candidate before accepting the versioned client contract. A durable negative tombstone cannot be fabricated by UI. Keep same-key resend disabled unless all explicit gates and Owner authorization hold. BUSINESS_COMMITTED_RESULT_UNAVAILABLE allows support-case closure only; the browser intent remains protected, no fabricated result, retry or Post. F04 old/new client cutover and B05/F04 measurable load/recovery targets require actual full IIS and Owner-approved thresholds before release. Missing tests are NOT RUN, never PASS.

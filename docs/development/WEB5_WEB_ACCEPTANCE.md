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

F02 cannot consume invented B02 response; actual backend versioned corpus/hash must be pinned. If B01/B02 safety proof absent, product resend remains disabled even if simulated HTTP tests pass. Browser result and .NET wrapper count are two different quantities.

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

**B01/B02 block:** A real process crash is a backend requirement and cannot be resolved with HTTP mock. A durable negative tombstone cannot be fabricated by a UI label or local marker. When missing, keep same-key resend disabled, keep UNKNOWN locked, and label task BLOCKED/NOT APPROVED (not complete).

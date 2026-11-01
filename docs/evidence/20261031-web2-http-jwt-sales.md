# WEB2 evidence — HTTP/JWT/Sales

**Created:** 2026-10-31. **Final disposition (Owner, 2026-11-01): COMPLETED WITH OWNER_ACCEPTED_EXCEPTION.** WEB2-01–09 DONE (bounded); WEB2-10 DONE for tested IIS Express HTTPS/SQL/Chromium/Edge scope. **Full IIS acceptance remains NOT RUN and is the sole Owner-accepted exception, not PASS or production approval.** The 2026-10-31 checkpoint sections below remain unchanged, including their then-IN_PROGRESS/BLOCKED statements; see the final Owner decision at the end.

## Baseline frozen for planning (NOT execution verification)

- Web main `90ef55c7408c25a6107310199890d809bc329adb`, backend main `5b9f960ee4048581f107e9ee6350e1dfad462b53`. Revalidate actual HEAD for each implementation PR.
- Existing WEB-01..WEB-08 automated fake scope evidence remains [historical](20261031-web-foundation.md), not proof of HTTP/IIS/SQL.
- Signed design: short Bearer JWT in localStorage (XSS residual), opaque refresh GUID in HttpOnly host-only Secure Strict cookie; SQL hashed refresh rotation and replay revoke; net48/IIS, wire DTO strings for int64/decimal.
- **Do not mark PASS for code/runtime from docs-only PR**. Record source review separately from tests, screenshots and attended interaction.

## Task evidence register

| ID | Commit/web PR | Server commit/PR | Tests and environment actually run | Result | Open findings/limits |
|---|---|---|---|---|---|
| WEB2-01 | This documentation candidate, base `3faa0a5` | `350358ae9f8519efd54d46d61b80d3b7887c1dcd` | Node 22.14.0: 59 corpus checks; Windows/net48: 24 probe rows; docs checks | PASS / DONE (bounded) | No HTTP host, live auth, IIS, SQL or browser acceptance |
| WEB2-02 | Status-only companion | `55ea4fd8b4aa567bdef0c723fd08b552b7b11269` | 63 HTTP/DI/JWT rows + 1 real IIS Express/SQL smoke | PASS / DONE (bounded) | Full IIS, auth/Sales endpoints and browser pending |
| WEB2-03 | Status-only companion | `36c528acc932b73c8d93e2fd54089c0856fd919b` | 25 store, 25 migration, 5 principal, 15 reset rows | PASS / DONE (bounded) | Nonproduction schema11; no production or desktop coexistence |
| WEB2-04 | Status-only companion | `a0770ac082505fec1f1db52a2469a5aa392a69f4` | 147 HTTP + 33 session/SQL + 1 IIS Express | DONE (bounded) | Full IIS/browser/Sales pending |
| WEB2-05 | Status-only companion | `3cd853df4b6d9aa6716533d891229debe5746289` | 257 HTTP + 14 SQL + 1 IIS Express; 59 corpus checks | DONE (bounded) | Full IIS/browser pending |
| WEB2-06 | `b398c5814f5a232cc264635f064cf3c77f605293` | No backend change | 148 unit/component + 82 Chromium + 1 production-artifact; typecheck/build | DONE (bounded) | No frontend auth/HTTP or full IIS/browser pilot |
| WEB2-07 | `708a7c3`, `6a4b81f`; final fixes below | Backend unchanged | Auth unit/component + two-tab/actor browser harness | DONE (bounded) | Real HTTPS cookie/CSRF/IIS acceptance remains WEB2-10 |
| WEB2-08 | `aba4b88` | Backend unchanged | Exact codec/read tests; canonical fixture parity; browser reads/rights | DONE (bounded) | Live IIS/SQL browser Gate A remains open |
| WEB2-09 | `166bd23`, `a6b7ed1`; final fixes below | Backend unchanged | Writes/ack/recovery unit + HTTP browser; full Lab regression | DONE (bounded) | Real SQL lost-response/stock/pilot acceptance remains WEB2-10 |
| WEB2-10 | `36c1bca` (runtime `d75abb2`) | `9480d1b` | 8 Chromium + 8 Edge real HTTPS/SQL; independent SQL oracle | IN_PROGRESS / full IIS BLOCKED | Automated IIS Express pilot verified; full IIS/operational acceptance remains open |

## Per-PR evidence template (append, never erase historical records)

### WEB2-XX — candidate SHA / date / actual machine

- Scope, source/target SHA and PR links (both repos when relevant).
- Runtime: Windows/OS, `net48` IIS/OWIN, SQL/version/schema/principal, Node/npm/browser/HTTPS origin (omit secrets).
- Commands run and exact test count/pass/fail/skipped/retry; distinguish UNIT/MSW/HTTP/IIS/SQL/attended.
- Behavioral traces: negative auth/CSRF, exact JSON precision, normal + lost-ack write, actor fencing, cookie attribute capture with cookie value redacted.
- Decision PASS/FAIL/BLOCKED, screenshots/log sanitized, limitations and follow-up owner.

## WEB2-01 — contract/preflight, 2026-10-31

**Baseline:** web `3faa0a54c97de6b42cf80fd693fb05a68640c331`, backend `e657d8ddfc6dd4cf8a146ea04325a4dc9f8bd02d`. Backend artifact/probe candidate: `350358ae9f8519efd54d46d61b80d3b7887c1dcd`; web changes are documentation only in the commit containing this record. Both branches are `codex/web2-01-contract`; no push/PR/merge/deployment was performed. Runtime source and npm lockfile are unchanged; historical WEB-01–08 evidence is unchanged.

Deliverables: [cross-repo checklist/source inventory](../development/WEB2_CODEX_HANDOFF.md#checklist-thực-thi-và-bàn-giao-web2-01--2026-10-31), backend [ADR 0012](https://github.com/chung6a8m/MyDmsVn/blob/350358ae9f8519efd54d46d61b80d3b7887c1dcd/docs/adr/0012-web2-net48-host-preflight.md), [canonical v1 corpus](https://github.com/chung6a8m/MyDmsVn/tree/350358ae9f8519efd54d46d61b80d3b7887c1dcd/docs/contracts/web2-v1), [isolated probe](https://github.com/chung6a8m/MyDmsVn/tree/350358ae9f8519efd54d46d61b80d3b7887c1dcd/tools/Web2.HostPreflight). These candidate links identify local candidate paths until published. Backend owns fields/examples and dependency/schema gates; web links to that revision, without copying specs/fixtures.

Owner explicitly selected **`https://web2.mydmsvn.test` as the local origin template**. This did not provision DNS, a certificate or an IIS binding. Access JWT remains localStorage; GUID refresh remains HttpOnly/Secure/Strict host-only cookie. Exact browser CSRF header is `X-Requested-With: XMLHttpRequest`; browser supplies Origin. No production auth bypass, write retry or UI change was introduced.

### Commands and observed results

Machine: Windows 11 Home Single Language x64, OS build `10.0.26300`; Node `22.14.0`, npm `11.6.0`, .NET SDK `8.0.427`, MSBuild `17.11.69`, .NET Framework registry `4.8.10008` / Release `534296`. Browser/IIS/SQL versions: **NOT RUN / no candidate deployed**. The backend commands below ran from its isolated worktree, not the web repo.

| Command / check | Actual result | Scope |
|---|---|---|
| `node --test scripts/check-web2-wire-fixtures.mjs` | **59 tests, 59 PASS, 0 FAIL, 0 SKIP** | JSON/BigInt corpus; exact long/decimal, fields/errors, duplicate/gift/inactive labels, terminal page and opaque cursor vectors, ordered 200-line expansion, negative examples |
| `dotnet restore tools/Web2.HostPreflight/Web2.HostPreflight.csproj --locked-mode` | PASS | Isolated candidate lock only |
| `dotnet build tools/Web2.HostPreflight/Web2.HostPreflight.csproj -c Release -f net48 --no-restore` | PASS, 0 warnings/errors | Candidate assemblies; no shipped project changed |
| `dotnet test tools/Web2.HostPreflight/Web2.HostPreflight.csproj -c Release -f net48 --no-restore --no-build --logger 'trx;LogFileName=host-preflight-final.trx' --results-directory TestResults/web2-01-preflight` | **24 executed, 24 PASS, 0 FAIL, 0 notExecuted**, verified from TRX counters | 14 package/in-memory HTTP/JWT/cookie cases + 10 CLR/JSON numeric vectors |
| `git diff --check`; changed-file UTF-8/BOM/EOL/JSON and local/companion Markdown path checks | PASS | Web LF/no BOM; backend follows its CRLF working-tree and C# BOM rules; remote publication not tested |
| Source-boundary diff (`src`, existing `tests`, deployment, global pins/solutions; web npm lock and historical evidence) | No changes | No business/migration/runtime implementation |
| Web typecheck/build/unit/browser; real IIS/SQL/attended tests | **NOT RUN** | No frontend behavior change; runtime gates belong to later WEB2 tasks |

Raw synthetic probe TRX and Node TAP remain local/ignored under backend `TestResults/web2-01-preflight`. Initial exploratory probe had two 14-row runs with 11 PASS / 3 FAIL caused by shared mutable test-key metadata and append/delete cookie fixture indexing; corrected test fixtures passed before adding the 10 numeric rows. No product fix or skipped test hides those failures. Review corrected an impossible max-ID/pageSize25 one-row cursor example and aligned display labels with actual source; the final 59-test corpus contains a terminal page plus independent opaque cursor vectors.

Review độc lập đã đối chiếu source, lock/assets, TRX và tài liệu cuối; không còn finding cần sửa. ADR đã được sửa theo generated config thực tế: probe không sinh IdentityModel/JWT redirect; kiểm chứng redirect của host tích hợp vẫn thuộc WEB2-02.

### Go/no-go and limits

**GO for the next planned implementation tasks WEB2-02, WEB2-03 and WEB2-06**, using the pinned candidate and checklist; this task does not start them. **NO-GO for Gate A–D, deployment or production readiness.** The scoped tests establish package/API compatibility and coherent golden data, not real authentication, production codec, SQL transactions, HTTP rejection of negative cases, browser storage/cookies or UI acceptance.

Katana's cookie API lacks `Max-Age`; ADR 0012 selects a narrow host-owned cookie writer for WEB2-04 and requires actual IIS/browser header/persistence/deletion tests. Schema11 needs a frozen exact10 admission validator, separate web role/profile, auth-aware reset and fail-closed legacy desktop handling in WEB2-03. Those implementations and all SQL/IIS/browser gates remain **NOT RUN / PLANNED**, not waived.

## WEB2-02/03 — backend implementation, 2026-10-31

Backend code: WEB2-03 `36c528acc932b73c8d93e2fd54089c0856fd919b`, WEB2-02 `55ea4fd8b4aa567bdef0c723fd08b552b7b11269`, branch `codex/web2-02-03` based on contract/evidence `1c6514ee4976a8217d1666618dfda75c1c8aee85`. This web branch `codex/web2-02-03-status` starts from `d3a6b0b58ed3ad1f693c07d4f3f6912a7b8ffe87` and changes documentation only. The earlier Owner-requested contract branches have [web PR5](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/5) / [server PR68](https://github.com/chung6a8m/MyDmsVn/pull/68); this follow-up is local and stacked, with no new push/PR/merge/deployment.

Backend owns [source, exact commands and failure history](https://github.com/chung6a8m/MyDmsVn/blob/58f3dc9729becff1449e36fd6ecdebd3a5909ba0/docs/evidence/web2/20261031-http-jwt-sales.md) and [host operations](https://github.com/chung6a8m/MyDmsVn/blob/58f3dc9729becff1449e36fd6ecdebd3a5909ba0/src/MyDmsVn.Server.HttpHost/README.md). Backend documentation checkpoint is `58f3dc9729becff1449e36fd6ecdebd3a5909ba0`; these links identify the local candidate until published. Final observed counters total **134 executed / 134 PASS / 0 FAIL / 0 SKIP**: 63 SQL-free OWIN/JWT/DI rows; 25 store rows (16 real SQL/9 pure); 25 migration; 5 principal; 15 reset; 1 published IIS Express/SQL smoke. Tests ran on Windows11 `10.0.26300`, net48 Framework4.8.10008, SDK8.0.427, IIS Express10.0.26013.1000 and SQL Server14.0.2140.2 Developer64/compatibility140. Independent review has no remaining P1/P2 finding.

The real smoke used `https://localhost:44321`, an existing certificate pinned only by the test, exact schema11 in an owned disposable DB, and a temporary restricted SQL login. Health200, missing/invalid JWT401 JSON without redirect, valid JWT/SQL session→unknown API404, then revoke→401, HTTP400, Origin403 and marker SPA fallback were checked. Worker/login/database drained and cleaned; no production DNS/IIS/SQL config was changed. This proves the host/session boundary, not login or Sales HTTP. The first smoke failed because its harness wrongly expected serialized `isSuccess`; ApiResponse correctly emits `data`. Corrected harness passed; both attempts cleaned their allocations.

Full IIS is absent on the test machine; full IIS/browser/attended pilot remains NOT RUN. Owner's `https://web2.mydmsvn.test` remains an origin template; browser certificate trust/DNS were not provisioned. Backend wwwroot is a publish marker, not this React app. Auth endpoints/cookie/CSRF/rate limits, Sales/Catalog endpoints, frontend runtime/auth/wire/read/write and Gate A–D remain WEB2-04–10. Browser access storage stays localStorage by Owner choice; refresh remains future HttpOnly Secure Strict consumption.

Web verification is Markdown diff/link/status/UTF-8 LF checking only. No `src`, tests, package/lock or historical WEB-01–08 fake evidence changed; npm/browser tests were not run for this status-only update. Do not use the backend counts as frontend acceptance. Desktop/default schema10 and separate web schema11 must not be treated as an admitted mixed-writer deployment.

## WEB2-04 — backend auth endpoints, 2026-10-31

**DONE (bounded backend scope).** Backend source/test commit `a0770ac082505fec1f1db52a2469a5aa392a69f4` on `codex/web2-04-auth`, based on merged `4290220`. Web status-only branch `codex/web2-04-status` starts from `60e5210`; frontend source remains unchanged. [Backend evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web2-04-auth/docs/evidence/web2/20261031-http-jwt-sales.md#web2-04--2026-10-31-auth-endpoints) owns commands, failure history and limits; [host runbook](https://github.com/chung6a8m/MyDmsVn/blob/a0770ac082505fec1f1db52a2469a5aa392a69f4/src/MyDmsVn.Server.HttpHost/README.md) owns operator configuration. These are local candidate references until published; no push/PR/merge was performed.

Implemented login/refresh/logout/me/capabilities with existing LoginCommand/password/permission policy, HS256 active/previous key validation, authoritative SQL account/session, bounded TTL configuration, strict cookie/Origin/CSRF/body validation, bounded account/token/IP throttling and sanitized audit. Refresh remains GUID in `__Host-mydmsvn-rt` with HttpOnly/Secure/SameSite=Strict/Path=/, no Domain and Max-Age; it is absent from JSON. Logout revokes already-issued JWTs. Access storage for the future browser lifecycle remains localStorage by Owner choice.

Final actual counters: **181 executed / 181 PASS / 0 FAIL / 0 SKIP**:147 SQL-free HTTP/auth/config rows;33 session/store rows (24 real SQL,9 pure);1 published IIS Express HTTPS auth smoke. Runtime rechecked: Windows11 `10.0.26300.0`, Framework4.8.10008/Release534296, SDK8.0.427, IIS Express10.0.26013.1000, SQL14.0.2140.2 Developer64. Published build has0 warnings/errors,13 redirects and0 Desktop DLLs. Tests prove real BCrypt rehash, independent live permissions, concurrent rotation/replay, disable/logout denial, TTL clamp and committed-refresh audit failure; tests model loss of the rotated cookie by retrying the old cookie, without claiming physical network loss.

Real IIS smoke at `https://localhost:44321` uses the existing certificate pinned only by the test and a disposable schema11 database/restricted login. Login→me→refresh→logout, actual cookie creation/deletion flags, missing/cross Origin rejection and unexpired JWT revocation passed. All owned workers/logins/databases cleaned; no listeners remained on44321/18081. Full IIS and browser enforcement were not tested. Independent review's route-case/trailing-slash/HTTP-method CSRF and limiter-cache exhaustion findings were reproduced, corrected and passed focused regressions; final review has no unresolved actionable finding.

Web checks are changed Markdown links/status/diff and UTF-8 without BOM/LF only; npm/build/browser tests **NOT RUN** because no web behavior changed. Historical WEB-01–08 evidence, fake Lab, `src`, tests and package lock remain unchanged. WEB2-05–10, actual browser auth/Sales integration, full IIS and Gate A–D/production acceptance remain planned/open. Per-worker rate limits reset on recycle; multi-worker abuse policy and operator audit retention still require deployment validation.

## WEB2-05 — backend Sales/Catalog endpoints, 2026-10-31

**DONE (bounded).** Backend source/test `3cd853df4b6d9aa6716533d891229debe5746289` on `codex/web2-05-sales`, stacked on verified local WEB2-04 `f563d32` (main remains `4290220`). Web branch `codex/web2-05-status` starts at `bb83abb`, documentation only. [Backend evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web2-05-sales/docs/evidence/web2/20261031-http-jwt-sales.md#web2-05--2026-10-31-salescatalog-endpoints) owns commands, source and failure history; local references become available after publication. No push/PR/merge performed.

Sales List/Get/Create/Update/Post and four Catalog lookups call existing MediatR handlers with independent permissions. Exact int64/decimal strings, strict JSON/query/date parsing, ordered line issues and inactive labels follow the canonical corpus; Post returns only acknowledgement. No Application/business DTO, SQL schema/grant, automatic retry or frontend runtime change.

Final results: **272/272 .NET rows PASS** (257 SQL-free HTTP,14 real SQL HTTP,1 published IIS Express HTTPS) plus **59/59 Node corpus checks PASS**; zero failures/skips. SQL covers Local parity, 200 duplicate rows, int64 max, exact maximum gift values, COGS/stock, keyset Product Any/all-line totals, independent rights and rollback without replay. Published smoke exercises real login/Catalog/Create/Get/Update/Post with stock oracle. Build0 warnings/errors; owned allocations/login/worker cleaned. Independent source review has no unresolved P1/P2.

Environment: Windows11 10.0.26300, net48 Framework4.8.10008, SDK8.0.427, SQL14.0.2140.2 Developer64, IIS Express10.0.26013.1000, existing localhost44321 TLS pin. Browser/full IIS and frontend tests NOT RUN; frontend source/lock/fake evidence unchanged. Web verification is Markdown links/status/UTF-8 LF/diff only. WEB2-06–10 and full browser/pilot acceptance remain open.

## WEB2-06 — frontend runtime injection and Lab isolation (2026-10-31)

**Source:** `b398c5814f5a232cc264635f064cf3c77f605293`, branch `codex/web2-06-runtime`, isolated existing web worktree. Base `09fe435942f72ea482f040b7120104ffd33bed22` carries approved local WEB2-04/05 status; main remains `60e5210`. No push/PR/merge. Backend untouched. Package versions/lockfile and historical WEB-01–08 evidence unchanged.

**Implemented:** required Sales/Catalog/Auth/today/storage dependencies; header/grid consume the injected Catalog; new documents use supplied business date. Observer connect/cleanup handles StrictMode/remount without releasing sessions, and actor/generation mismatch denies UI capabilities. Zustand raw/draft/dirty, editor barrier, stable line identity and common close admission remain intact. Lab alone composes fake adapters, scenario controls, sample buttons and lookup harness around the same production Sales components. It owns a separate QueryClient and page-lifetime sessions, including beforeunload protection when its host is unmounted. See [owning design](../design/WEB2_FRONTEND_INTEGRATION.md#2-runtime-composition-và-fake-isolation--web2-06).

`/` explicitly reports disconnected; auth/token/HTTP frontend remains WEB2-07–09. `/lab/sales` and `/lab/components` are DEV-only; Vite removes their dynamic-import graph from production. A production build guard checks emitted module IDs and rejects any Lab/fake module. Direct production requests for Lab routes render not-found and no workspace, fixture grid or fake actor controls.

**Environment:** Windows 11 10.0.26300, Node22.14.0, npm11.6.0, Vite8.3.5, Vitest5.0.5, Playwright1.64.1, bundled Chromium156.0.8078.4. Browser plugin not available; repository Playwright used. Dev `http://127.0.0.1:5173`, production preview `http://127.0.0.1:5174`. Automated desktop includes 1280×720,1440×900 plus existing layout/zoom cases; extra visual capture uses 1440×900 Lab and 390×844 disconnected entry. Mobile capture is not mobile Sales acceptance.

| Verification | Actual result |
|---|---|
| `npm.cmd ci` | PASS; pinned lockfile unchanged |
| `npm.cmd run test:unit -- tests/unit/workspace/runtimeDependencies.test.ts` before implementation | RED:9 failing runtime dependency cases; no false GREEN from default fake |
| `npm.cmd run test:unit` final | **148/148 PASS**,18 files,4.97s;10 new unit +3 real Provider/Header component cases |
| `npm.cmd run typecheck` / `npm.cmd run build` | PASS; final build after review fix:188 modules, no fake/Lab output; no package change |
| `npm.cmd run test:e2e -- --project=chromium --workers=2` final | **82/82 PASS**,1.4m,0 fail/skip/retry |
| `npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1` | **1/1 PASS**,7.1s; `/` and both direct Lab paths checked against built artifact |
| Build guard negative probe | PASS: in-memory Vite transform deliberately imported/used fake scenario controller; guard rejected module. `write:false`, no source/artifact writes |
| Source review | One P2 found and fixed; final independent review has no actionable findings |
| UTF-8/no BOM/LF, Markdown links and `git diff --check` | PASS |

**Browser flow and proof:** `/lab/sales` → open document → lookup keyboard selection/editing,200 lines,Save/Post and recovery → Dockview split/move/remount → close/admission assertions. New flow edits raw note → `/` → reload → dismiss actual beforeunload dialog → Lab returns same session/raw text. Clean admitted close permits reload without warning; pending/unknown still warn and return locked. Production `/` → theme switch and Lab deep links has correct title/content, no grid/fake controls, no Vite overlay and no console/page errors. Extra screenshot script confirmed title/URL,200-line text, no overlay/errors and no horizontal overflow on mobile entry; files `web2-06-lab.png` and `web2-06-entry-mobile.png` are outside repo in the task visualization folder and were visually inspected.

**Failure history:** typecheck first exposed an untyped deferred test Promise; explicit result type fixed it. Real Provider component import exposed missing `@` alias in standalone Vitest config; aligned with existing Vite alias, then3/3 component cases PASS. Review reproduced missing beforeunload after navigation home (1 failing browser test); moved protection to persistent Lab owner. The first cancellation regression incorrectly awaited a dismissed `page.reload()` navigation and timed out3 cases; it now triggers browser reload and asserts the actual dialog, without waiting for a navigation the user canceled. Focused3/3 then full82/82 PASS. Initial pre-review full80 PASS is superseded by final82; counts above do not sum repeated runs.

**Limits:** these are injected/fake frontend and production-isolation checks, not authenticated HTTP or full IIS pilot acceptance. No SQL/.NET/backend tests run for WEB2-06. No new attended Edge/Telex/VNI/Narrator run; synthetic composition and keyboard automation do not claim attended IME. WEB2-07–10 remain PLANNED; no production deployment or auth bypass added.

## WEB2-07–09 — frontend HTTP candidate, 2026-10-31

**Base:** web `4010b15a59a04e9a73a6b3835dc898cdc1b493ff`, backend inspected read-only `de6a00c6ccbcfe30b8cc114bc4408ee60294c478`. Branch `codex/web2-07-09`; no backend modification, push, merge or deployment. Package/lock versions and historical WEB-01–08 evidence unchanged. Implementation checklist: [WEB2-07–09](../development/WEB2_07_09_CHECKLIST.md).

Auth commits `708a7c3` and `6a4b81f` implement access localStorage, cookie-only refresh requests, authoritative me/capabilities, single-flight/Web Locks, BroadcastChannel/storage synchronization, per-session generation, logout admission and private page-lifetime document retention. Review reproduced and corrected two races: replacement token left old protected view active while me was pending; queued login cleared shared access before taking the lock, allowing an older refresh to republish. Focused regression after fixes: **13/13 PASS**.

Read/codec commit `aba4b88` implements exact Zod DTO validation, historical references, signed profit/eight-place unit cost, actor-fenced Sales/Catalog ports, permission-aware workspace and isolated query cache. Default business calendar is explicitly `Asia/Ho_Chi_Minh`, called per new document. Independent review matched all **24** normalized immutable fixture mirrors/hashes to backend source. Focused auth/read/component tests at this point: **54/54 PASS** (41 WEB2-08 cases plus 13 auth cases), typecheck/build PASS.

**Verification mechanism:** deterministic injected fetch unit tests and Playwright route-level HTTP harness, using real production auth/transport/codec/commands/components. These replace adding MSW to the pinned toolchain; no test is described as MSW, SQL or a live IIS result. The fixture mirror remains test-only with backend revision/hash provenance; fault variants mutate clones. Browser plugin not available; repository Playwright used. Dev origin `http://127.0.0.1:5173`, static production preview `http://127.0.0.1:5174`; these are not the pilot HTTPS origin.

**Initial failure history:** baseline148 unit/component PASS. Initial auth/codec test imports were RED because modules did not exist (0 executed; not counted as runtime evidence). Four initial HTTP browser cases reached login then failed at absent Sales composition. Later read smoke had2 PASS/1 test locator failure because Dockview also provides an alert live region; scoping to Sales list fixed it, then3/3 PASS. Static production preview returned404 for auth refresh (no backend in preview); isolation test now explicitly supplies401 and ignores only that expected browser network diagnostic, then1/1 PASS. Separate browser owner-switch test passed: cross-tab logout hides dirty document, different actor receives a fresh workspace, and private retained draft still raises actual beforeunload.

### Final candidate and bounded result

**Source:** write/ack/recovery `166bd2379d3230a85be545fe7bb035a5787ef2f1`, browser harness `a6b7ed10953aa3b9bb9561dd0bb5b12f67b30cb7`, final auth/dispatch correction `fa0fcbc7766e8a45f4a8df746fe233949b0732c6`; final documentation/browser assertion commit contains this evidence. **WEB2-07–09 DONE in bounded frontend automated HTTP scope; WEB2-10 remains PLANNED.** Independent task/source review and scoped final rereview approved, no unresolved actionable finding.

Post returns an acknowledgement and immediately locks the document as Posted. The subsequent Get may fail/403 or return stale Draft without undoing that acknowledgement; costs stay unavailable until authoritative Posted detail. Create/Update preserve ordered duplicate rows and client identities, map server issues through the sent snapshot and retain raw data on conflict. Lost Create/Update/Post responses require explicit reconciliation, never replay. Deadlines cover headers and response body (auth15s/business30s); caller abort after dispatch is unknown. A preflight failure with proof that Sales fetch never ran releases pending/sent snapshot while keeping the original owner's draft private.

Final review found and reproduced two more paths before approval: refresh's shared-token optimization could adopt a foreign sid without immediately hiding the old actor; Save/Post marked dispatch before token preflight. `fa0fcbc` centralizes adoption fencing and reports dispatch at the actual fetch boundary. Six regressions were first RED, eight added cases cover failed/stale adoption, same-user/new-sid, preflight cancellation and private command state; final suite is244 tests.

| Command / observation | Actual result and scope |
|---|---|
| `npm.cmd run test:unit` | **244/244 PASS**,26 files, final source `fa0fcbc`; no skipped tests |
| `npm.cmd run test:unit -- tests/unit/http tests/unit/sales tests/unit/workspace` | **212/212 PASS**,20 files, after final review fixes |
| `npm.cmd run typecheck`; `npm.cmd run build` | PASS; production module guard excludes Lab/fake. Vite reports the large bundle chunk warning; no dependency upgrade performed |
| `npm.cmd run test:e2e -- --project=chromium --workers=2` | **91/91 PASS**,1.8min, after Lab snapshot fix and before deadline/final auth-dispatch fixes;82 foundation regressions +9 HTTP browser scenarios |
| `npm.cmd run test:e2e -- tests/e2e/web2-http.spec.ts --project=chromium --workers=2` | **9/9 PASS**,16.1s on final source, including final numeric keystroke through real AG Grid Save barrier |
| `npm.cmd run test:e2e -- tests/e2e/web2-http.spec.ts --config playwright.edge.config.ts --workers=2` | **9/9 PASS** on final source; automated Edge, not attended IME |
| `npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1` | **1/1 PASS**,5.4s on final build; login fail-closed, theme, direct Lab routes absent, no fake workspace |
| Changed-file local Markdown links, UTF-8/no BOM/LF, `git diff --check`; historical evidence/package lock diff | PASS; historical WEB-01–08 evidence and dependency pins unchanged |
| Real IIS/HTTPS/SQL/Security Gate A–D, stock/COGS and attended Edge/Telex/VNI/Narrator | **NOT RUN** here; still WEB2-10, not inferred from deterministic HTTP harness |

**Environment:** Windows11 `10.0.26300.0`, Node22.14.0/npm11.6.0, Vitest5.0.5/Vite8.3.5/Playwright1.64.1, Chromium156.0.8078.4, Edge156.0.4314.56. Browser harness used standard desktop plus1440×900 Post-ack capture; existing full suite covers1280×720/1440×900, Light/Dark, resizing and native Chromium125%/200% zoom. Final screenshot `web2-09-post-ack-get-denied.png` was inspected in the task visualization folder: Posted/read-only, unavailable costs and unblocked review action are visible; no clipping/overlay at1440×900. No new mobile Sales or attended input acceptance claimed.

**Additional failure history:** first full browser run was stopped after two foundation failures exposed a real Lab render loop: the new React auth subscription read fresh object snapshots each time. Stable actor/generation/capability snapshots fixed it; focused regression then full91 PASS. Deadline regressions initially timed out before implementation; they now prove hung headers/body reach unknown and no write replay. Counts above are separate runs, not additive totals. Full91 was not needlessly repeated after the narrowly scoped final transport/auth fixes; focused HTTP Chromium/Edge, unit/component and artifact checks were rerun.

**Limits:** same-origin HTTPS host deployment, real cookie Secure/HttpOnly/SameSite enforcement, Origin/CSRF/CSP/XSS security acceptance and real SQL pilot remain unverified by this candidate. Access localStorage retains the Owner-accepted XSS risk. Refresh/logout expiry isolates old dirty/unknown documents in RAM; no automatic attachment to a new login, no durable recovery after reload. No backend edits, SQL/.NET test runs, push, merge or deployment in this work.

## WEB2-10 — automated HTTPS/SQL/browser pilot và handoff, 2026-10-31

**Trạng thái: IN_PROGRESS / full IIS acceptance BLOCKED.** Phần triển khai runner, sửa lỗi integration và automated pilot IIS Express đã kiểm chứng. Máy không có W3SVC/WAS hoặc `System32/inetsrv/appcmd.exe`; không cài/configure full IIS, thay binding hay trust store của máy. Gate D full IIS/operational acceptance chưa đạt, roadmap không được chuyển DONE/archive. Đây không phải production release acceptance.

**Candidate:** web base `9b3acd7bd161263c5faf05cf380dab0b1d86828d`, runtime fix `d75abb2`, source/tests `36c1bca80e02ea3f42ecf08578072d68ddd6e6de` trên `codex/web2-10-acceptance`; backend base `de6a00c6ccbcfe30b8cc114bc4408ee60294c478`, source/tests `9480d1b79c012b50aff725612989c7dc861b2973` trên `codex/web2-10-server`. Các commit documentation sau đó chỉ ghi lại evidence. Không push/PR/merge. Hai main checkout giữ nguyên; package-lock, fixture mirrors và lịch sử WEB-01–08 không thay đổi.

**Thay đổi:** published IIS cần managed handler nhận cả asset requests: mapping extensionless cũ trả JS404 dù file tồn tại trong `wwwroot`, khiến browser trắng. Backend sửa app-local mapping, kiểm tra bytes/MIME JS/CSS/woff2 cùng các đường missing/config/bin bị từ chối. Host sinh nonce style CSPRNG32 bytes mới cho từng HTML, đặt cùng giá trị vào CSP/meta và no-store. Frontend đưa nonce vào cả hai AG Grid và Dockview; giữ nguyên Nova/Quartz/theme. Zod4.6.7 được cấu hình `jitless` trước schema construction để không chạy eval capability probe. Script policy vẫn `'self'`, không thêm unsafe-inline/unsafe-eval. Không đổi storage JWT, quyền, business handlers, schema/grants hoặc retry semantics.

**Cơ chế pilot:** [runbook](../development/WEB2_PILOT_RUNBOOK.md), `playwright.pilot.config.ts` và `tests/pilot/web2-live.spec.ts` chạy production build `assets/index-CGfe5Nou.js` trong host net48 thật, trên `https://localhost:44321`. Backend fixture tạo database schema11, restricted login, ba actor/quyền độc lập, catalog và stock dùng riêng; Windows Job quản lý child Node/browser, host được drain trước SQL cleanup. Manifest credentials test-only và public certificate PEM là file tạm, được xóa sau lượt chạy. Browser dùng TLS trust bình thường; Node security probes dùng public certificate của đúng binding đã pin và đã kiểm OS chain, qua child-only `NODE_EXTRA_CA_CERTS`. Không `ignoreHTTPSErrors`, TLS callback trong frontend, proxy Origin hoặc fake success.

Mỗi browser dùng fixture mới riêng để không vượt limiter login thật. Lost Create/Update/Post dùng `route.fetch({maxRetries:0})`, đợi backend200 sau commit rồi drop response về browser. Tests xác nhận unknown lock, không replay mutation, explicit matching read/reconciliation. Đây là fault injection tại HTTP response boundary, không giả SQL commit và không phải mất mạng vật lý. Không có test hook trong production host.

### Lệnh và kết quả thực chạy

| Lệnh / observation | Kết quả và phạm vi |
|---|---|
| `npm.cmd ci --no-audit --no-fund` | PASS; pinned lockfile unchanged |
| `npm.cmd run test:unit -- tests/unit/http/cspSchemas.test.ts` trước sửa Zod | **RED 1/1**: đã thử eval1 lần; yêu cầu0 |
| `npm.cmd run test:unit` sau sửa | **245/245 PASS**,27 files; auth/wire vẫn reject sai type khi dùng parser không JIT |
| `npm.cmd run typecheck`; `npm.cmd run build` | PASS;2511 modules; production guard loại Lab/fake; large-chunk warning vẫn có |
| `npm.cmd run test:e2e -- tests/e2e/web2-http.spec.ts --project=chromium --workers=2` baseline | **9/9 PASS**,17.8s; deterministic HTTP harness riêng |
| `npm.cmd run test:e2e -- --project=chromium --workers=2 --output test-results/final-regression` | **91/91 PASS**,1.7m,0 fail/skip/retry, source/tests `36c1bca`; repo writes frozen during run |
| `npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1 --output test-results/production-final` | **1/1 PASS**,5.4s; login fail-closed/theme/direct Lab absence on built artifact |
| Backend HttpHost focused suite | **264/264 PASS**,0 fail/skip; nonce regression trước sửa **1 FAIL/6 PASS**, sau đó green; xem backend evidence cho command/filter |
| Backend security selection `WebAuthSession|WebAuthHttpSql|WebSalesHttpSql|WebPrincipalProvisioning` | **45/45 PASS**,0 fail/skip:36 real SQL +9 pure store rows; không gọi45 rows đều là real SQL |
| Backend `WebAuthMigrationTests` | **13/13 PASS**,0 fail/skip,1m10s: fresh11/noop, restricted exact10 upgrade, schema9/desktop/drift/history refusal, partial011 rollback, lock/CLI |
| Published SystemWeb smoke | **1/1 PASS**,25s: native asset bytes/MIME, transport/security, login/Create/Update/Post/stock và cleanup |
| Browser wrapper, project `chromium` | **8/8 browser PASS**,18.9s; **1/1 .NET wrapper PASS**,41s gồm SQL oracle + cleanup |
| Browser wrapper, project `edge` | **8/8 browser PASS**,24.1s; **1/1 .NET wrapper PASS**,46s gồm SQL oracle + cleanup |
| Independent review | No unresolved P1/P2; viewport correction và final certificate/error-sanitization deltas reviewed |
| Changed Markdown links/encoding/LF, `git diff --check`, historical evidence/lock diff | PASS; UTF-8 without BOM/LF, local links resolve; historical WEB-01–08 evidence and package-lock unchanged |

Backend fixture command cho từng browser: đặt `MYDMSVN_WEB_PILOT_PROJECT=chromium` hoặc `edge`, rồi `dotnet test tests/MyDmsVn.Server.Infrastructure.Security.Tests/MyDmsVn.Server.Infrastructure.Security.Tests.csproj -c Release -f net48 --no-restore --filter FullyQualifiedName~Published_React_browser_uses_real_HTTPS_SQL_and_atomic_stock --logger 'trx;LogFileName=<project>.trx' --results-directory TestResults/<project>`. Publish directory/browser worktree/test SQL/certificate thumbprint đi qua process environment theo runbook; không ghi connection string hoặc token vào evidence. [Backend evidence](https://github.com/chung6a8m/MyDmsVn/blob/codex/web2-10-server/docs/evidence/web2/20261031-http-jwt-sales.md) sở hữu exact server commands, TRX counts và cleanup; branch link dùng được sau khi được publish.

### Boundary đã chứng minh và giới hạn

- Browser: login thật, localStorage access, refresh cookie Secure/HttpOnly/Strict, reload, hai tab chỉ rotate1 lần, logout/replay từ chối JWT còn hạn, missing/cross Origin403, hai actor tách biệt. Inline script injection bị CSP chặn; không có CSP violation do app ở lượt final trước probe chủ động.
- Sales: UI lookup/Create,200 duplicate/gift rows, ký tự cuối trong decimal editor đi qua Save barrier, exact maximum gift decimals, stale409 giữ raw text. Write/Post không có Read vẫn nhận Create/ack hợp lệ; Get403 không đảo Posted/read-only và không bịa chi phí.
- Independent SQL oracle mỗi browser xác nhận3 chứng từ Posted, quantity203.0001 và cost3045.0015; stock từ1000/value15000 còn796.9999/value11954.9985; từng dòng ledger/valuation khớp Qty/CostAmount. Các test SQL riêng kiểm tra int64 max, Product Any/keyset-bound filters, disabled/revoked sessions, concurrent rotation/replay, grant negatives, rollback và sanitized audit.
- Visual QA1440×900: screenshot `web2-10-chromium-posted-200.png` thể hiện200 dòng, tổng2500.0025, chi phí3000.0015; `web2-10-chromium-post-get403.png` thể hiện Posted/read-only và chi phí chưa có. Đã xem ảnh, không thấy overlay/clipping che thao tác. Ảnh synthetic data nằm ngoài Git trong visualization folder của task; Edge capture lưu cùng chỗ. Không suy ra attended input/mobile acceptance.

**Environment:** Windows11 `10.0.26300.0`; .NET Framework4.8.10008/Release534296; SDK8.0.427; IIS Express10.0.26013.1000; SQL Server14.0.2140.2 Developer64; Node22.14.0/npm11.6.0, Vite8.3.5/Vitest5.0.5/Playwright1.64.1; Chromium156.0.8078.4, Edge156.0.4314.56. Browser plugin not available; repository Playwright used. Pilot HTTPS origin khác dev5173/static preview5174. Automated Chromium/Edge không phải attended Telex/VNI/Narrator.

**Failure history:** first live browser reached trusted HTTPS but blank page: published JS404 proved native routing gap. After routing fix, browser recorded25 style violations and2 script eval probes across navigation; nonce propagation and Zod jitless corrected both. Next failure was Node request TLS trust differing from browser OS trust; private public-PEM configuration fixed probes without disabling TLS. Request errors are sanitized because raw Playwright diagnostics may print headers; failed-run credential-bearing local diagnostic was sanitized and its disposable auth session/database removed. Two subsequent test2 timeouts were test action errors: direct fetch bypasses app auth lifecycle and the list tab was hidden behind the active document. The initial hypothesis of early auth removal was disproved by DOM; test now exercises active-document Save and requires login/no old raw panel. No app auth change was made for these test errors.

Initial full dev suite had90 PASS/1 timeout in `invalid_decimal_escape_and_header_validation_preserve_input`; isolated unchanged test then **3/3 PASS**. Another run had90 PASS/1 failure in `reseed_after_raw_and_lookup_edits_can_prepare` (snapshot40 rows instead of200). Independent trace analysis proved Vite sent `full-reload` at2026-10-31 11:39:01.214 UTC, just after the seed click; beforeunload/navigation then restored a fresh revision0 document. Installed Tailwind Vite plugin scans Markdown and explicitly reloads on changed scanned assets; documentation/normalization writes during verification caused the interference. This was not evidence of a session/admission defect. No application/test timeout workaround was added. With **all watched repo writes frozen**, final full suite passed91/91 unchanged. Counts describe distinct runs, never an additive total.

**Open handoff:** provision a controlled full IIS HTTPS site/app-pool with trusted certificate/DNS and designated nonproduction SQL, then execute Gate A–D against the published pair and validate operational audit sink/retention and deployment configuration. Full IIS and attended pilot are **BLOCKED/NOT RUN** here; they are not inferred from IIS Express. No production migration/cutover is authorized or performed. LocalStorage bearer retains the Owner-accepted XSS risk; nonces/CSP mitigate, not eliminate it. Draft/unknown context remains page-memory only, with no durable recovery after reload.

Final backend cleanup observed0 disposable test databases,0 owned logins,0 temporary manifest/PEM,0 listeners on44321/18081. Final selected .NET runs total325 rows (264+45+13+1+2);16 live browser tests are counted separately, not as extra .NET rows.

## 2026-11-01 — Owner closeout and full IIS exception

**Owner decision, 2026-11-01:** The Owner explicitly accepted the **single final blocked full IIS deployment-acceptance check** as an exception for closing WEB2. **WEB2 roadmap status: COMPLETED WITH OWNER_ACCEPTED_EXCEPTION.** WEB2-01–09 are DONE within their verified scopes. **WEB2-10 is DONE within the verified automated IIS Express/HTTPS + non-production SQL + real browser scope**, and the **full IIS gate is OWNER_ACCEPTED_EXCEPTION / NOT RUN (never PASS)**. Original 2026-10-31 IN_PROGRESS/BLOCKED language, test failures, and command outputs above remain a historical snapshot, not today's active task status.

Frontend final-source verification: **245/245 unit/component**, **91/91 Chromium regression**, **1/1 production artifact isolation** PASS. Published pilot: **8/8 Chromium + 8/8 Edge browser PASS**, two real SQL oracle wrappers; backend companion **325/325 selected .NET rows PASS**. All are dated 2026-10-31 candidate results, not tests rerun for this documentation PR.

**Exception boundary:** full IIS/W3SVC/WAS/appcmd was unavailable in the verification environment. Owner acceptance waives that check **only for this bounded roadmap closeout**; it does not assert compatibility of full IIS app pools, ACL/bindings/TLS, or grant a production release/migration. Operational audit sink destination/retention, distributed/multiworker controls, candidate-specific attended IME/Narrator, broader browser cross-site security matrix and real production rollout are **NOT VERIFIED / DEFERRED**, **not** waived as PASS. localStorage JWT retains XSS exposure; no durable draft or idempotency journal is claimed.

**Provenance:** Web `main@1d75917f7a3f7e4ae7a891bd242b2d9bb70c9b11` ([PR #10](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/10)); backend `main@6a62a98993e698c3baf146e30200f754db3cb37f` ([PR #72](https://github.com/chung6a8m/MyDmsVn/pull/72)), inspected before documentation closeout. Tested source candidate: Web `36c1bca80e02ea3f42ecf08578072d68ddd6e6de`, backend `9480d1b79c012b50aff725612989c7dc861b2973`. Review [archive boundary](../archive/20261101-web2-http-jwt-sales/README.md) and its frozen plan. No executable/test/SQL/framework changes were made for this Owner disposition; this docs-only closeout **does not rerun or certify** any runtime tests.

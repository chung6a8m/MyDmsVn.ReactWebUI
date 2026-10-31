# WEB2 evidence — HTTP/JWT/Sales

**Created:** 2026-10-31. **Current status:** WEB2-01–04 DONE (bounded contract/host/SQL session/auth); WEB2-05–10 PLANNED. Backend focused HTTP/SQL and IIS Express smoke PASS; full IIS/browser/Sales pilot remains open. Active plan: [roadmap](../plans/20261031-002-http-jwt-sales-vertical-slice.md); frontend spec [here](../design/WEB2_FRONTEND_INTEGRATION.md); backend evidence will be kept at [backend companion](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/evidence/web2/20261031-http-jwt-sales.md).

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
| WEB2-05 | — | — | NOT RUN | PLANNED | HTTP Sales/Catalog |
| WEB2-06 | — | — | NOT RUN | PLANNED | Runtime composition |
| WEB2-07 | — | — | NOT RUN | PLANNED | Browser auth lifecycle |
| WEB2-08 | — | — | NOT RUN | PLANNED | Wire/read path |
| WEB2-09 | — | — | NOT RUN | PLANNED | Save/Post/recovery |
| WEB2-10 | — | — | NOT RUN | PLANNED | Pilot acceptance |

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

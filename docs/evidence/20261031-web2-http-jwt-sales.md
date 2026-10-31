# WEB2 evidence — HTTP/JWT/Sales

**Created:** 2026-10-31. **Current status:** WEB2-01 DONE (contract/preflight only); WEB2-02–10 PLANNED. Isolated net48 probe and corpus checks PASS; HTTP/IIS/SQL/browser acceptance NOT RUN. Active plan: [roadmap](../plans/20261031-002-http-jwt-sales-vertical-slice.md); frontend spec [here](../design/WEB2_FRONTEND_INTEGRATION.md); backend evidence will be kept at [backend companion](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/evidence/web2/20261031-http-jwt-sales.md).

## Baseline frozen for planning (NOT execution verification)

- Web main `90ef55c7408c25a6107310199890d809bc329adb`, backend main `5b9f960ee4048581f107e9ee6350e1dfad462b53`. Revalidate actual HEAD for each implementation PR.
- Existing WEB-01..WEB-08 automated fake scope evidence remains [historical](20261031-web-foundation.md), not proof of HTTP/IIS/SQL.
- Signed design: short Bearer JWT in localStorage (XSS residual), opaque refresh GUID in HttpOnly host-only Secure Strict cookie; SQL hashed refresh rotation and replay revoke; net48/IIS, wire DTO strings for int64/decimal.
- **Do not mark PASS for code/runtime from docs-only PR**. Record source review separately from tests, screenshots and attended interaction.

## Task evidence register

| ID | Commit/web PR | Server commit/PR | Tests and environment actually run | Result | Open findings/limits |
|---|---|---|---|---|---|
| WEB2-01 | This documentation candidate, base `3faa0a5` | `350358ae9f8519efd54d46d61b80d3b7887c1dcd` | Node 22.14.0: 59 corpus checks; Windows/net48: 24 probe rows; docs checks | PASS / DONE (bounded) | No HTTP host, live auth, IIS, SQL or browser acceptance |
| WEB2-02 | — | — | NOT RUN | PLANNED | HTTP host |
| WEB2-03 | — | — | NOT RUN | PLANNED | Migration/SQL session store |
| WEB2-04 | — | — | NOT RUN | PLANNED | JWT auth/CSRF/cookie |
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

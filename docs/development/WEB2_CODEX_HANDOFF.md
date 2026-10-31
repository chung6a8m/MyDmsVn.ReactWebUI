# Codex handoff — WEB2 HTTP/JWT/Sales vertical slice

**Owner approved:** 2026-10-31. **State:** plan active after docs PR is merged, execution NOT STARTED. Read [roadmap WEB2](../plans/20261031-002-http-jwt-sales-vertical-slice.md), [frontend design](../design/WEB2_FRONTEND_INTEGRATION.md), [backend HTTP contract](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB2_HTTP_AUTH_AND_WIRE_CONTRACT.md), [backend companion](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/plans/20261031-003-web2-http-jwt-sales-server.md), source `AGENTS.md` and test policies **before** starting a task.

## Execution model

- Work with **two independent repos**: `chung6a8m/MyDmsVn` for `WEB2-02..05`, `chung6a8m/MyDmsVn.ReactWebUI` for `WEB2-06..09`; 01/10 require both. Each PR originates from latest approved `main` of that repo and names the task; never copy .NET test, WinForms policy, SQL connections or passwords into web repo.
- Source inspections at planning: backend `main@5b9f960`, web `main@90ef55c`. Re-read actual latest branch, code, lock versions and migrations before code; no automatic rebase over unrelated active CEX work, no broad dependency or design upgrades.
- **One task at a time / narrow diff.** Start by writing task implementation checklist (paths and contracts), then focused RED tests, implementation, GREEN, build, SQL/browser evidence where relevant, update exact task state/evidence in same PR. Do not merge automatically; do not claim a gate passed on plans alone.
- Stop before changing agreed choices: `net48`, Bearer JWT localStorage, refresh GUID HttpOnly cookie, same-origin HTTPS, versioned exact wire DTO, no automatic mutation retries, retained fake Lab. If blocking incompatible library/hosting, document evidence and propose the smallest alternate within `net48`.

## PR order and exact Codex assignments

### WEB2-01 — two-repo contract gate

**Prompt:** Inspect backend `net48` project graph, SQL schema10 admission/permissions, existing `LoginCommand`/`CurrentUser`/`ApiResponse`/Sales DTOs and frontend `SalesPort`/barrier. Verify with official sources *installed* package compatibility of IIS Web API 2 + OWIN v4 + JWT signing libs; pin candidate package versions only if compatible. Produce focused ADR for host/same-origin HTTPS, auth cookie/origin, refresh session rotation/TTL/CSRF, DTO v1 (long/decimal string) and 400/401/403/409; golden JSON fixtures for long max/decimal/gift/duplicate/inactive refs. Leave business code untouched. Output cross-repo checklist and go/no-go; run docs link/format/contract tests that exist. If a choice is impossible on net48, report blocker, don't switch runtime.

### WEB2-02 — backend HTTP host and immutable request actor

**Prompt:** Create net48 IIS-hosted ASP.NET Web API 2 `MyDmsVn.Server.HttpHost`, proper locked packages/solution and focused tests. Compose `AddServerApplication` + `AddSqlPersistence` per HTTP request; never register `LocalDesktopSession`. Bind immutable `ICurrentUserAccessor` with validated JWT/active SQL session, bearer header only, safe middleware for status/error/correlation, HTTPS and no 302 login redirects. Test simultaneous actors A/B, anonymous/forged/expired, scope disposal, IIS app/SPA route. Do not expose catalog/Sales endpoints before permission gate.

### WEB2-03 — backend auth session SQL store

**Prompt:** Add additive DbUp 011 auth session/refresh hash tables with FK/index/lineage/UTC expiry, transaction-owned issue/rotate/reuse/revoke, restricted Web principal grants/validator/bootstrap/cleanup and real SQL concurrency/negative tests. Keep scripts001–010 immutable and refused unsupported schema, avoid broad DB privileges. Refresh GUID v4 raw only in cookie/in-flight memory; DB stores SHA-256 token hash. Race: two consumes -> at most one child; reused consumed token revokes family. Tests nonproduction SQL guard; report BLOCKED if no SQL. Do not add token plaintext log or idempotent soft replay.

### WEB2-04 — backend JWT auth endpoints

**Prompt:** Implement `POST /api/v1/auth/login,refresh,logout` and Bearer `GET me,capabilities`. Use existing LoginCommand/password policy and permission service; signing HS256 strong secret managed outside repo, `kid` rotation, iss/aud/exp/nbf/jti/sid checks. Access TTL default10m, refresh idle7d absolute30d. Write `__Host-mydmsvn-rt` cookie Secure+HttpOnly+SameSite=Strict+Path=/ no Domain; refresh/logout cookie-only + Origin/CSRF and same-origin, login rate limits, no-store, sanitized audit. Logout makes already-issued JWT unusable. Negative tests JWT forgery, replay, CSRF, inactive account, concurrent refresh, config miskey and no-token logs.

### WEB2-05 — backend Catalog and Sales HTTP

**Prompt:** Implement v1 routes with request-scoped application calls; map long/decimal **strings** to existing C# DTOs, int32 numeric, Sales CalendarDate strict, version opaque, safe API errors; no controller SQL. Implement Read/Write/Post permission independently and Catalog lookup permissions via existing handlers. Create/Update returns authoritative full response; Post returns ack only. Golden fixtures for int64 >2^53/longmax, decimal(18/19/28), nullable posted cost, duplicate row, 200 lines, keyset Product filter, 401/403/409 and real SQL Post/cost. Don't introduce admin grants/new business workflow.

### WEB2-06 — frontend injected composition and Lab parity

**Prompt:** Refactor `createWorkspaceRuntime` to receive SalesPort/CatalogPort/capabilities/clock/storage from app root, preserve external store and editor barrier. Remove fake imports from production SalesHeaderForm/SalesLinesGrid/app composition. Keep `/lab` using deterministic fake adapters/scenarios and the exact production components; protect or exclude Lab in production build. Use clock for new Sales date. Unit and browser regression for lookup typing, 200-line editor, Dockview remount, close admission and Lab fixtures. No React Hook Form mirror.

### WEB2-07 — frontend auth state

**Prompt:** Implement protected login route, JWT only in `localStorage`, HttpOnly refresh via same-origin cookie, no refresh token access/JS cookie, short token expiry preflight, single-flight + cross-tab Web Locks/BroadcastChannel coordination, auth actor fencing. 401 refresh/retry at most once for GET only; **do not automatically retry Create/Update/Post** after dispatch. Voluntary logout uses close admission before remote revoke; expiry/reauth locks and isolates previous owner dirty/unknown sessions. Include MSW/browser tests 2 tabs, same user new session, different user, revoke mid-request, CSRF headers, no credential logs. Reject protocol/401/403 distinction.

### WEB2-08 — frontend HTTP wire and read

**Prompt:** Build typed `httpTransport,authApi,salesHttpPort,catalogHttpPort,salesWireSchemas,salesWireMapper`. Strict Zod parse of server strings for long and decimal; reject numeric payload for those fields rather than parseFloat/String. Map catalog int32 numeric into IDs, omitted/null cost, date-only/posted UTC, inactive reference labels, Product Any keyset, pageSize25/cursor. Use Query keys actor+generation, keep draft immune to stale query, do not synthesize labels from active catalog. RED/GREEN fixtures and browser read test through real API.

### WEB2-09 — frontend write, Post acknowledgement and recovery

**Prompt:** Map immutable Save snapshot to Create/Update wire preserving ordered line index -> clientLineId, no client ID/actor in DTO. Map server issues onto sent snapshot. Change `SalesPort.post`/fake contract to PostAcknowledgement, show confirmed Posted/read-only immediately on ack, independently load detail/cost; Get failed/403 never changes successful Post to failed. Maintain unknown lock after lost response and no auto mutation retry; stale reads/expired session/different actor must not clear it. Test exact decimal, duplicate products, 409, Post ack+Get denied, commit-then-loss, wrong actor, editor last key. Ask backend only for transport bug, not broader idempotency or new pricing.

### WEB2-10 — acceptance across two repos

**Prompt:** On a controlled Windows/IIS HTTPS origin with designated non-production SQL and restricted principal, execute approved matrix: Login/refresh/logout/replay/Origin rejection, two actors, Sales List/Get/Catalog, Create/Update/Post, 200 lines/decimal/duplicate/gift/COGS, stale version, lost response after commit, ack+Get 403 and no replay, CSP and cookie attributes. Run focused client and backend suites, separate real SQL/IIS evidence from MSW/unit, record exact SHAs/env/commands/counts/evidence, update docs and archive closed plan when truly accepted. Missing test infrastructure -> BLOCKED not PASS. No production migration or package release.

## Definition of done for every PR

- Change only intended seams; no unexpected user-facing theme override or new editor behavior.
- Add issue-specific failing regression before fix when possible; show test count and command on candidate SHA, no silently skipped mandatory tests.
- Documentation links, Markdown encoding/line ending and generated lockfile consistent with each repo rules.
- Record PASS/FAIL/BLOCKED in [WEB2 evidence](../evidence/20261031-web2-http-jwt-sales.md); backend separately in its WEB2 evidence. New C# SQL test not run is not accepted.
- Separate already-completed fake foundation claims from new real HTTP/auth evidence; write-specific UNKNOWN must never be translated into optimistic success or re-sent.

# WEB2 evidence — HTTP/JWT/Sales

**Created:** 2026-10-31. **Current status:** DOCS ONLY / NO RUNTIME EXECUTION / ALL WEB2 TASKS PLANNED. Active plan: [roadmap](../plans/20261031-002-http-jwt-sales-vertical-slice.md); frontend spec [here](../design/WEB2_FRONTEND_INTEGRATION.md); backend evidence will be kept at [backend companion](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/evidence/web2/20261031-http-jwt-sales.md).

## Baseline frozen for planning (NOT execution verification)

- Web main `90ef55c7408c25a6107310199890d809bc329adb`, backend main `5b9f960ee4048581f107e9ee6350e1dfad462b53`. Revalidate actual HEAD for each implementation PR.
- Existing WEB-01..WEB-08 automated fake scope evidence remains [historical](20261031-web-foundation.md), not proof of HTTP/IIS/SQL.
- Signed design: short Bearer JWT in localStorage (XSS residual), opaque refresh GUID in HttpOnly host-only Secure Strict cookie; SQL hashed refresh rotation and replay revoke; net48/IIS, wire DTO strings for int64/decimal.
- **Do not mark PASS for code/runtime from docs-only PR**. Record source review separately from tests, screenshots and attended interaction.

## Task evidence register

| ID | Commit/web PR | Server commit/PR | Tests and environment actually run | Result | Open findings/limits |
|---|---|---|---|---|---|
| WEB2-01 | — | — | NOT RUN | PLANNED | Contract and hosting compatibility gate |
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

# WEB4 F02 — Durable drafts candidate, 2026-11-02

Owner selected milestone WEB4-04 (F02 + F03), then explicitly authorized implementing missing backend B04 first. This record covers **F02 implemented and verified candidate; Owner acceptance/merge pending**. F03 and its operation persistence/dispatch proof have separate evidence. No production activation is approved.

## Source and dependencies

Frontend base `68398accdd03a1ed78a2e3bec7c5cb2499457b6d`, branch `codex/web4-04-durable-recovery`. The implementation commit is recorded in the delivery checkpoint below. Backend B04 executable pin `bd871518fd162927d938babd5535a2ddf91c2ad5`, evidence head `8a0308b6ca2df83883cb04127e360cf39c7f1725`, [draft PR #83](https://github.com/chung6a8m/MyDmsVn/pull/83). Its 604 selected local .NET rows and [successful hosted Windows HTTP-host CI](https://github.com/chung6a8m/MyDmsVn/actions/runs/41358463758) are backend evidence, not frontend browser/SQL acceptance.

B01 remains `1c603c6ac57e59a3f7b4bc6ca976b2d531c079aa`; manifest SHA256 `0acab190e7fe126d53c13c0510a1958365e5a6e1fda78a4321da78297e0b3f1a`. The 48 mirrored corpus blobs and dependency locks are unchanged. Runtime: Windows, Node 22.14.0, npm 11.6.0, locked React 19.3.1, Zod 4.6.7, Vitest 5.0.5, Playwright 1.64.1, Vite 8.3.5. Browser plugin was unavailable; existing pinned Playwright was used.

## Implemented boundary

- Auth adopts exact B04 context after `/me`, matching actor and authoritative epoch before production construction, layout discovery or draft preview. Epoch/actor/generation fence document, list, lookup, inventory, capability and late response paths. Layout v3 uses epoch+actor; old actor-only v1/v2 blobs remain untouched and are never imported into that production scope.
- Native IndexedDB `mydmsvn-drafts-v1`, schema 1, compound primary keys, narrow Sales/Receipt snapshots, stable local/client line identities, exact raw/lookup/composition text, strict canonical baseline and 200-line / 16,384 UTF-16-unit / 2 MiB UTF-8 bounds. Credentials, tokens, permissions, runtime generations and layout are excluded. Unsupported/corrupt records are quarantined individually. Operations store is reserved for F03.
- Runtime-owned coalescing queue acknowledges transaction completion; CAS refuses stale writes/deletes. Explicit retry distinguishes a failed latest capture from an older durable snapshot. Restore is user selected, uses fresh capabilities/generation and keeps original baseline/version/raw; it never replaces local input with a Get. Same-server-document duplicates remain separate for review.
- Close admission awaits safe local cleanup and rechecks identity. Discard can abandon invalid or quota-failed edits without first saving them; failed CAS/delete retains RAM. Unknown/protected records remain locked. Forced auth/epoch loss clears private RAM/preview immediately and retains scoped durable bytes. After admitted explicit logout, a separate token-free connection attempts only clean CAS cleanup; failure is reported without retaining authentication.
- Nova/Base UI status/review, retry, explicit discard confirmation and user-initiated copy with a business-data warning. Restored composition markers remain data until fresh input; native composition refs prevent ordinary typing from remaining permanently stuck in composing state.

**Staged production boundary:** F02 production Save/Post fails closed with `durable-intent-required` until F03 installs the atomic immutable-intent path. There is no temporary unkeyed/memory-only write fallback. Thus the F02 browser zero-write assertions do not prove F03 pre-dispatch atomicity.

## Executed verification

| Command / runner | Actual result |
|---|---|
| Baseline `npm.cmd run test:unit` before changes | 48 files, 777 PASS |
| Final F02 unit/component selection below | **58 files, 982 PASS**, zero failed/skipped |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run build` | PASS; existing large-chunk warning remains |
| `npm.cmd run test:e2e -- tests/e2e/durableDraftWorkspace.spec.ts tests/e2e/draftRepository.spec.ts --project=chromium --workers=1` | **23 PASS**: 13 native repository + 10 production-workspace cases |
| `npm.cmd run test:e2e -- --config playwright.edge.config.ts tests/e2e/durableDraftWorkspace.spec.ts tests/e2e/draftRepository.spec.ts --workers=1` | **23 PASS**: same boundaries on Edge |
| `npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1` | **1 PASS** production artifact / Lab isolation |
| Staged diff, UTF-8 without BOM / LF | PASS for 70 source/test files |

Final F02 unit command excludes the independently prepared, uncommitted F03 test files:

```text
npm.cmd run test:unit -- --exclude '**/web4OperationCodec.test.ts' --exclude '**/operationStatusPort.test.ts' --exclude '**/web4OperationRecord.test.ts'
```

An earlier 998-test run included 16 F03 record-codec tests; it is not the F02-only count. The final 982-test selection above is authoritative for this candidate.

Chromium `156.0.8078.4`; Edge `156.0.4314.58`. Workspace cases render the real ApplicationEntry, Dockview, AG Grid and lookup components at `/` on Vite with route-mocked HTTP and native IndexedDB. They cover key-by-key invalid raw/unconfirmed lookup → reload → explicit restore, both 200-line features with stable IDs after a fresh live rewrite, actor/epoch privacy, restored composition, quota/local retry/copy consent, stale close CAS, and retrying discovery with no live document. Native storage cases cover transaction abort after request success, synchronous/asynchronous quota, blocked-open retry, versionchange, corrupt primary keys/values, protected markers and cross-tab CAS. No workspace page errors, console warnings/errors or unexpected HTTP were observed. Screenshots were inspected at 1280×720 and kept outside Git; no overlap obscured restored fields or controls.

Meaningful RED→GREEN checkpoints include codec/store stubs, UTF-16 bounds, malformed stored `undefined` versus absent key, auth/context and epoch cache fences, asynchronous close/restore races, two restored composition-marker browser failures, and three independent-review P2 findings: stale durable claim after capture failure, delayed hiding after permission revoke, and discard incorrectly requiring a failed write to succeed. Focused regressions prove the corrections. Explicit discovery connection retry also received a regression. Review results and delivery commit are recorded below.

## Limits

HTTP responses in F02 browser tests are controlled fixtures, not live server/SQL. No F03 immutable intent/HTTP settlement acceptance, B05/F04 published HTTPS browser/SQL pilot, real process crash or commit-acknowledgement socket loss, attended Telex/VNI/Narrator, full IIS or production rollout was performed. Pagehide remains best effort; only committed local snapshots are promised. Dirty/unknown records have no automatic TTL deletion. Explicit same-ID resend UI stays gated by missing backend crash/restart proof. Historical WEB1–03 evidence and independent CEX remain unchanged.

## Delivery checkpoint

Implementation source: `825711b52d4e1e06f68dfea2989f783085171d2c`. Final independent review found no open P1/P2 in the corrected local persistence, preview, cleanup/logout and explicit retry boundaries. Frontend hosted CI and Owner acceptance/merge were not claimed at this local checkpoint. F03 remains a separate task/PR.

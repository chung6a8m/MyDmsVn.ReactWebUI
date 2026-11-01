# WEB4-04 — F02 implementation checklist

Date: 2026-11-02 (Asia/Bangkok). Owner selected milestone WEB4-04, which maps to F02 + F03 in the [owning plan](../plans/20261101-002-web4-reliability-web.md). This checklist tracks execution; the [approved design](../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md) remains the specification.

## Dependency checkpoint

Web baseline: `68398accdd03a1ed78a2e3bec7c5cb2499457b6d`; backend B03 base: `8f8091575bbdab4d85c97f14d44b82030d70927d` (PR #82 merged). Owner instructed implementing missing B04 first. B04 is now a verified candidate in [draft PR #83](https://github.com/chung6a8m/MyDmsVn/pull/83), runtime/test pin `bd871518fd162927d938babd5535a2ddf91c2ad5`, evidence head `8a0308b6ca2df83883cb04127e360cf39c7f1725`: 604 local rows passed, zero failed/skipped. It supplies mandatory keyed mode, authenticated context and protected status. Canonical B01 stays pinned at `1c603c6ac57e59a3f7b4bc6ca976b2d531c079aa`; corpus bytes are unchanged. B04 Owner acceptance/merge and B05/F04 live browser acceptance remain separate.

F02/F03 consume that pinned B04 implementation. Do not obtain epoch from local storage, JWT sid, an environment constant or a guessed HTTP implementation. Implement F02 in this branch, then F03 on a separate stacked task branch with its own evidence/PR. No production deployment or completed milestone is claimed by this execution checkpoint. Explicit same-key resend UI stays disabled because real process crash/commit-acknowledgement-loss evidence is not yet available.

## Implementation sequence

- [x] Feature snapshot allowlists: add `src/infrastructure/drafts/featureDraftSnapshot.ts` and focused unit tests. Capture only typed Sales/Receipt draft, saved baseline, initial draft, raw and lookup buffers; validate canonical baseline, stable line identity, bounded raw text and 200 lines. Preserve invalid raw and composition markers. Exclude auth, capability hints and runtime generations. Tests first, then implementation.
- [x] Local envelope and IndexedDB repository: add `draftRecord.ts` and `indexedDbDraftRepository.ts`; use compound keys, strict scope/schema/size validation, transaction-complete acknowledgement, CAS revisions, protected marker deletion guard, and same-server-document conflict reporting. Add real-browser tests for reload, cross-tab conflict, foreign epoch/actor, corruption, old schema and failed transactions. No fake IndexedDB dependency.
- [x] Local persistence queue: add a narrow revision-aware coordinator with dependency-injected repository. Coalesce snapshots without making feature stores asynchronous, surface pending/failure/conflict, retry local persistence only, and fence stale scope after every await. Unit-test deferred writes, latest snapshot, failed flush and changed ownership.
- [x] Layout v3 codec: add an epoch+actor-scoped strict codec using existing geometry/descriptor validation; reject v1/v2 instead of importing actor-only server IDs. Unit-test same actor/different epoch, stale live owners, malformed envelopes and exact IDs. Runtime selection awaits authoritative context.
- [x] Run relevant unit/typecheck/build checks and real Chromium/Edge IndexedDB tests. Independent review, encoding/diff review, and task evidence with actual counts and limitations.
- [x] Authenticated B04 context bootstrap, epoch fences for reads/live owners/layout, production subscriptions and preview/restore UI, awaited close/discard/logout integration and full F02 UX/browser acceptance. These must be implemented before F02 is DONE.
- [ ] F03 atomic immutable intents, six keyed writes, protected status/reconciliation and actual frontend port integration with B04 TestServer. Keep same-key resend UI gated; preserve the separate F04+B05 live pilot.

## Review focus

Persisted bytes are untrusted; foreign namespace data must never appear in previews. A successful request event is not transaction completion. A stale writer must not overwrite or delete a newer snapshot. Corrupt/protected records must not become silently discardable. Failed storage must not cause HTTP dispatch or automatic replay. No module is production-enabled until current authoritative epoch can be established.

## Progress

B04 prerequisite and F02 are verified candidates. F02 source `825711b52d4e1e06f68dfea2989f783085171d2c`; final F02-only 982 unit/component, 23 Chromium, 23 Edge and 1 production artifact PASS; independent review has no open P1/P2. See [F02 evidence](../evidence/web4/20261102-f02-durable-drafts.md). Owner acceptance/merge pending; F03 remains the next selected implementation. Frontend baseline locked npm ci succeeded and test:unit ran 48 files / 777 passing tests before changes. New verification and delivery status belong to WEB4-04 evidence, never archived WEB1–03 evidence. Browser plugin is unavailable in this session; use the existing pinned Playwright workflow for actual IndexedDB/browser checks.

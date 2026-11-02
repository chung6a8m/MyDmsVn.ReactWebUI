# WEB4-04 — F03 implementation checklist

Date: 2026-11-02 (Asia/Bangkok). Owner selected milestone WEB4-04 (F02 + F03) and explicitly authorized missing backend B04 first. [Owning plan](../plans/20261101-002-web4-reliability-web.md) · [design](../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md) · [F03 evidence](../evidence/web4/20261102-f03-operation-recovery.md).

Backend B04 runtime `bd871518fd162927d938babd5535a2ddf91c2ad5`, test follow-up `55c6d04d54d3ec08be8f236427350fffdea9dcbf`, evidence/CI head `b225bee1370abac77d4e852302ca45572cd8d3be`; [PR83](https://github.com/chung6a8m/MyDmsVn/pull/83). B01 `1c603c6` and its 48 corpus blobs remain unchanged. F02 source `825711b`; F03 core source `3a34fd9` and final UI source are pinned in evidence.

- [x] Strict B01 canonical builders, frozen original lexemes, immutable GUIDv4/epoch/actor intent, rehash validation and original result/status codecs.
- [x] Native two-store atomic begin/settle/reject, source snapshot/CAS binding, generic write/delete protection against false marker bypass, corrupt and foreign namespace isolation.
- [x] Queue atomic lease before HTTP; immutable prepared revision; no dispatch before complete; no unkeyed or memory-only production fallback.
- [x] Six production writes through coordinator, first direct rejection allowlist only, current actor/epoch/generation/revision/grant fences, no automatic retry.
- [x] Local checkpoint settlement before feature result application; exact client/server line identities and versions; Receipt Post has no invented version; Inventory invalidates only after positive Posted.
- [x] Explicit preview/restore/status UI, local-only retry after storage failure, operator metadata even when frozen intent is corrupt and cannot be restored, no public Get settlement or automatic Get after Post.
- [x] Safe terminal payload cleanup with digest validation and exact-byte-set/CAS comparison in the deleting transaction; dirty/unknown/foreign data retained and failed cleanup honestly reported.
- [x] Unit/component, typecheck/build, real Chromium/Edge IndexedDB and production-component browser regressions, artifact isolation and actual frontend-port/TestServer/SQL case. Evidence separates each level and all earlier failures.
- [x] Independent reviews and targeted corrections; UTF-8/LF, diff, link and unchanged corpus/archive checks.
- [x] Reviewable WEB4-04 frontend candidate in [PR20](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/20), with separate F02/F03 implementation commits and evidence. Combined milestone delivery avoids presenting the intentionally gated F02 intermediate as a standalone write-enabled release.
- [ ] Owner acceptance and merge.
- [ ] Conditional same-key resend UI: disabled until real process-crash/commit evidence satisfies backend safety gates. This is not permission to retry automatically.
- [ ] F04+B05 live production React/IIS Express HTTPS/browser/SQL acceptance; F05/B06 operator closeout; full IIS/production. These remain outside this selected milestone.

No further F04/F05 implementation is selected by this candidate. No automatic unknown disposal, production deployment or merge is performed.

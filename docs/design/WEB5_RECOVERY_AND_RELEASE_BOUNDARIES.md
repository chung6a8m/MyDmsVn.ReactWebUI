# WEB5 — Browser recovery UX, negative certificate and release boundaries

**Proposed design, NOT IMPLEMENTED as of 2026-11-02.** Frontend owns the user-visible recovery state; backend owns SQL truth, terminal negative and operations. [Frontend owning plan](../plans/20261102-001-web5-operational-safety-web.md) · [acceptance](../development/WEB5_WEB_ACCEPTANCE.md) · [WEB4 durable recovery](WEB4_DURABLE_DRAFT_AND_RECOVERY.md) · [WEB4 user guide](../development/WEB4_USER_RECOVERY_GUIDE.md) · [backend proposal](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB5_OPERATION_SAFETY_PROTOCOL.md).

## 1. Three distinct authorities and lifecycle

- **Draft:** local actor+database epoch-scoped IndexedDB raw/lookup/lines, edit revision and optionally pending immutable intent. A transaction-complete IDB snapshot can recover after reload; not the SQL business source. Existing `drafts`/`operations` stores are separate from Dockview layout-v3 descriptors. Never store auth credentials/permissions.
- **Original immutable operation:** GUIDv4, frozen original request route/body/version/method/target, canonical rehash/fingerprint, actor+epoch and client draft checkpoint. Persist draft + intent atomically before dispatch; `DISPATCHED` means "potentially dispatched", not "SQL executed".
- **Authoritative result:** server original COMMITTED outcome or server durable terminal-negative certificate, each bound to exact immutable operation identity, current auth/permission/epoch/generation and local edit revision. A 404, status timeout, generic 409, expired bytes or search result is **neither** proof.

## 2. Client state transition table

| Current | New evidence | Safe action |
|---|---|---|
| Editable local draft | successful IDB snapshot | Mark locally durable only; still not SQL Save |
| Prepared intent awaiting dispatch | IDB transaction completed | Dispatch once; if scope changes, UNKNOWN, never new key |
| UNKNOWN | original authenticated COMMITTED result + exact matching identity | Atomically SETTLED local then apply original server IDs/version/Posted/Inventory invalidation |
| UNKNOWN | COMMITTED metadata but result expired/missing version | Keep protected; show operator case, no Edit unlock |
| UNKNOWN | 404/403/timeout/stale epoch/malformed certificate | Keep UNKNOWN; no auto resend, no clean/discard bypass |
| UNKNOWN | **verified durable NOT_EXECUTED certificate** from B02 new versioned contract | Atomically store terminal disposition and release ONLY matching local intent with CAS; preserve raw draft for explicit review |
| UNKNOWN | no B02 proof or missing matching actor/permission | Keep UNKNOWN and operator metadata, regardless of operator/UI assumptions |
| Verified negative draft | current authorized fresh baseline and review | Offer **new explicit user intent** with new GUID (not automatic replay) |
| UNKNOWN still in permitted key window | B01 crash and B02 proof + separate Owner approval for manual resend | Optional explicitly confirmed **same GUID + byte-equivalent frozen request**, one send only; otherwise UI remains disabled |

The negative certificate cannot contain a fabricated server result/version/line ID, cannot be accepted from localStorage/IndexedDB alone and must be read again under current authority. For an existing document, baseline/version must be refetched and reconciled before new mutation. Same-key resend does NOT become safe merely because 404 indicates absent journal; it relies on server serialization, expiry/tombstone and current actor rights. Existing WEB4 stores `DISPATCHED`, `SETTLED`, `REJECTED`; introduce compatible explicit negative-terminal state/version only through narrow schema-migration/CAS review, not by aliasing `REJECTED`.

## 3. Versioned HTTP and client trust boundary

Backend B02 must publish a versioned resolution DTO/corpus with exact method/route/headers/status/error mapping before F02 source changes. **Do not change or fork WEB4's original 48 pinned JSON fixtures**. Proposed new read may be `GET /api/v2/operations/{operationId}/resolution` but exact route is **TBD by B02 ADR**, not authorization to implement from this document.

Consumer must check:
1. Authenticated actor sourced from `/me`, current server epoch, current module grant, no stale actor generation and live session/document owner. Never use arbitrary persisted permissions to unlock.
2. Locally persisted frozen operation validates strictly; re-hash original byte-equivalent canonical command with the source-pinned WEB4 codec; match original operationId, command, route, HTTP method, target, expectedVersion, epoch, actor and checkpoint; reject a valid-looking certificate from a different request.
3. Typed server resolution and authenticated header must bind the exact operation, actor, database and fingerprint. Result must be a durable SQL terminal/positive fact, not a negative HTTP status or generic administrator remark.
4. Settle/local unlock **after** completed IndexedDB transaction and per-document CAS; if quota/versionchange/abort occurs after a response, retain UNKNOWN and offer local-only retry, not HTTP replay.
5. Late response after logout, changed actor/epoch, permission revocation, close/dispose/tab split or editRevision change does not mutate the new document or Inventory query cache.

No JWT/refresh/cookie, SQL connection, operator credentials, raw business payload or server permissions are added to local persistence or telemetry. Local operator identifiers from corrupt records are display-only, explicitly unverified.

## 4. User experience and accessibility

Keep Nova/Base UI theme, typography and standard compactness unchanged. Use three visually distinct actions:
- **Kiểm tra kết quả:** protected GET only, always permitted only with current session/grant; negative/unavailable stays locked.
- **Thử lại lưu cục bộ:** retry IndexedDB, never HTTP.
- **Gửi lại đúng thao tác này:** conditional manual same-key HTTP (disabled until gates accepted); show exact original command/ID, prompt explicit confirmation, status check and one dispatch; never default or enter-key automatic submission.

For safely verified terminal-negative:
- Label clearly "Máy chủ đã xác nhận thao tác gốc không được thực hiện" only with durable certificate.
- Preserve draft/keyboard focus and allow reviewing newer baseline; new Save/Post remains disabled until the current valid state is verified, permissions refreshed and user consciously starts a new intent.
- Warn when result was COMMITTED but expired: business may exist; never invite re-Post or clear a protected journal marker.
- In cross-tab conflicts show both owners and preserve raw/local information without choosing newer by timestamp. No automatic clearing of a different tab.

Test accessibility in real browser with AG Grid, Dockview and Floating UI active: tab sequence, focus trapped/restored around modal, live-region status announced once without duplicated alerts, keyboard-only review, screen reader/Narrator on attended Windows and Telex/VNI composition. Synthetic composition does not certify human IME.

## 5. Production release gates retained

- Source-pinned published React assets and backend host must use compatible operation mode, schema and corpus. Legacy Web11 artifacts never fall back silently to WEB4/WEB5 writes. New versioned B02 contract may require a separate mode/schema; do not guess.
- Real full IIS (W3SVC/WAS), trusted TLS, app pool and static asset paths, CSP style nonce, no Lab/fake source, secure cookie/Origin/CSRF and proxy trust must be verified on **actual stage**. IIS Express PASS from WEB4 remains historical.
- Login/rate-limit shared among workers or explicitly enforced one-worker topology, audit destination/retention, maintenance audit, backup/restore, epoch rotation, clean rollout/rollback must be proven by backend B03/B05. UI cannot claim operational acceptance.
- Access JWT remains in localStorage by Owner decision and has residual XSS risk; test CSP/DOM injection and review dependencies, but never silently switch token storage.
- Only a separately signed, exact-candidate Owner PRODUCTION GO authorizes deployment. WEB5 roadmap closeout and CI success are not that signoff.

## 6. Verification mapping

F01 maps/source no runtime change → F02 versioned client+storage+status and adversarial state regression → F03 native browser with controlled HTTP, backend actual SQL bridge and CI → F04 full IIS staged Chromium/Edge/SQL + attended Telex/VNI/Narrator → F05 release dossier and Owner decision. [WEB5 frontend matrix](../development/WEB5_WEB_ACCEPTANCE.md) owns expected cases; evidence under [WEB5 evidence](../evidence/web5/README.md) owns actual results.

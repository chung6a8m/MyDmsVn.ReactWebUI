# WEB6 F01 — Frozen source, consent and safety policy

**Status: READY FOR OWNER TECHNICAL REVIEW, 2026-11-03. Feature remains OFF.** This checkpoint maps frontend runtime `a011230fc9d5057ab76321251ad0a292e18aecbc` against backend runtime `c7782429e105688e916fe2a0d41bb58fc0a1cb4d`. The checkpoint document commits are frontend F01 `9f5ae59` and backend B01 `8586de3`; later review-fix commits do not change the runtime pins. It introduces no runtime/API/IndexedDB/UI behavior and does not implement F02–F05/B02–B06.

## 1. Frozen baseline and invariants

| Item | Verified value |
|---|---|
| Frontend WEB4 corpus | 48 files; Git tree `fcab4a1e7505b150a132ce2899002930e9f2a6ee` |
| Frontend WEB5 fixture | 41 files including manifest; Git tree `43c922fd9fded72118555d29e3a068762984a985`; manifest SHA-256 `fef5f1f18d3a556bf35d5c9ed6bc38af3eeb0c1a89dd5f9d125d7fb190a133b2` |
| Runtime stack | Node `22.14.0`, npm `11.6.0`, TypeScript `5.9.3`, React `19.3.1`, Vite `8.3.5`, Vitest `5.0.5`, Playwright `1.64.1` |
| Lockfile | `package-lock.json` SHA-256 `283593a2d944b2031ce57c8c8a59f18755e51b25ab6767571ef3ffdd341f55e9` |
| Backend result policy | Seven-day original result bytes; permanent EXPIRED/CANCELLED identity tombstone; exact13/web5 only |

Preserve actor, actor generation, deployment epoch, document generation, edit revision, draft/operation sequences, raw buffers, line IDs, original Write/Post grant, and current close admission. No resend may call ordinary `write()`, because that path creates a new UUID.

## 2. Source and method map

Line references are for the pinned frontend commit above.

| Boundary | Current source | Current guarantee / F02 gap |
|---|---|---|
| Durable operation record | `operationRecordSchema`, `src/infrastructure/drafts/web4OperationRepository.ts:18`; `Web4OperationRepository`, `:140` | `DISPATCHED`, `SETTLED`, `REJECTED`, v2 `NOT_EXECUTED`; frozen operation and draft checkpoint identity; no resend claim store/API yet |
| Atomic original begin | `createWeb4OperationRepository` and `begin`, same file `:180,245` | `drafts` + `operations` transaction completes before first dispatch; future claim must join a single readwrite CAS and never fetch inside it |
| Frozen codec | `decodeFrozenWeb4Operation` / canonical request, `src/infrastructure/http/web4OperationCodec.ts` | Strict GUID/epoch/actor/method/route/target/body/fingerprint; persisted bytes are rehashed |
| Frozen first-write request | `frozenWriteRequest`, `src/infrastructure/http/frozenWriteRequest.ts:10` | Rehashes, actor-checks, sends frozen method/body/key/epoch; currently also compares to a UI-built expected request, so it cannot be called blindly for resend |
| HTTP retry boundary | `createHttpTransport.request`, `src/infrastructure/http/httpTransport.ts:8` | Only GET/HEAD may refresh and retry after 401; mutations expire auth and stop; no automatic mutation retry |
| Protected v1 GET | `createOperationStatusPort`, `src/infrastructure/http/operationStatusPort.ts:131` | 404 maps to `unknown/not-observed`; expiry/unavailable never settles or unlocks |
| Protected v2 GET | `createOperationResolutionPort`, `src/infrastructure/http/operationResolutionPort.ts:60` | Strict `web5-resolution-v1`; current context accepts only `sameKeyResendEnabled: false`; original Write/Post capability rechecked |
| Runtime owner/fences | `createWeb4MutationRuntime`, `src/app/runtime/web4MutationRuntime.ts:60` | `owners`, `pending`, `known`, `validated`, `negativeLineages`, `negativeAdmission`, `authorityRevision`; late results cannot apply to a new actor/session/generation |
| Ordinary write | `write`, same file `:303` | Creates a new GUID, atomically begins, then dispatches once; forbidden as a resend implementation |
| Restore | `inspect`, `validateRestore`, `bindRestored`, same file `:349,417,433` | Restored DISPATCHED intent stays UNKNOWN and performs no automatic GET or mutation |
| Read/local-only recovery | `checkResult`, `checkResolution`, `retryLocalResult`, same file `:461,515,559` | GET-only or persistence of already-known proof; never falls through to POST/PUT |
| Current recovery UI | `RecoverySupport`, `src/app/workspace/RecoverySupport.tsx:5` | `Gửi lại đúng thao tác` and `Mở khóa thao tác` are disabled; support copy is identifier-only and makes no ticket claim |

## 3. State-transition and action matrix

`UNKNOWN` means the client cannot prove the mutation outcome. `NOT_OBSERVED` means the protected GET returned no disclosed row. Both remain protected and neither proves rollback.

| Fresh server/local state | Same-key control | UI/action outcome |
|---|---|---|
| COMMITTED + valid retained result | Hidden/disabled | GET, decode exact original outcome, atomic `SETTLED`; zero mutation |
| COMMITTED + RESULT_EXPIRED/RESULT_UNAVAILABLE | Disabled | Keep PROTECTED; operator/business verification; no fabricated result/version/line IDs |
| Durable SQL CANCELLED/`NOT_EXECUTED` | Disabled for old key | Existing negative CAS; separate reviewed new intent/new GUID after fresh baseline |
| `DISPATCHED/UNKNOWN` + exact original + fresh current actor/epoch/grant + trusted eligibility + no claim + explicit consent | Potentially enabled only in an approved pilot | Persist one claim, recheck, send exact original once; request can execute business work for the first time |
| 404/`NOT_OBSERVED` alone | Disabled | Remain UNKNOWN; require separate versioned eligibility decision, not a 404-derived unlock |
| Timeout/5xx/invalid response | Disabled | Remain UNKNOWN; bounded GET later, never automatic mutation |
| Actor/session/grant/epoch/generation/edit revision changed | Disabled | Zero send; stale response cannot settle another document |
| Old host/non-web5/feature OFF/unpinned pair | Disabled | Protected legacy positive GET only where supported |
| Missing/corrupt/oversized frozen record | Disabled | Quarantine; never rebuild payload/key from UI |
| Claim committed; tab closes before/on fetch | Consumed | No automatic retry on restore; UNKNOWN + GET/operator path |
| Two tabs in same storage partition | One durable winner maximum | Loser sends zero; BroadcastChannel/Web Locks are presentation only |
| Separate profile/device | Local claims may both exist | Backend same actor/key/epoch SQL fence is the one-business-effect authority |

## 4. Threat matrix

| Threat | Unsafe consequence | Required F02/F03 control | Backend dependency |
|---|---|---|---|
| 404 interpreted as `NOT_EXECUTED` | The resend may unknowingly be the first execution | Copy and state keep UNKNOWN; eligibility is a separate response | B04 journal/race proof |
| Ordinary `write()` reused | New UUID/new mutable snapshot | Dedicated original-only port; assert no `crypto.randomUUID()` | Existing route/journal |
| Current UI body substituted | Same key with different business intent or conflict | Decode and rehash persisted frozen operation; send its exact body | B04 exact-body/fingerprint |
| Double-click/Enter/reload/timer | More than one client transmission | Explicit modal + durable claim before network; no default/keyboard implicit confirm | B04 remains safe against malicious clients |
| Claim reset after ambiguous abort | Repeated consent/transmission | Ambiguous claim stays consumed; GET only | Journal is final outcome authority |
| Auth/grant changes during preflight | Unauthorized dispatch or disclosure | Recheck at each async boundary and just before send | Server repeats actor/session/grant checks |
| Generation/edit changes | Late result corrupts newer document | Bind claim/result to generation/edit revision/sequences and existing CAS | None |
| IDB quota/abort/versionchange | Send without durable one-shot proof | No committed claim means zero fetch; failure does not delete old records | None |
| Two tabs race | Both believe they won | Single IDB readwrite transaction across draft/operation/claim | SQL fence for cross-device |
| Sensitive confirmation/support data | Note/customer/raw request leak | Sanitized module/document label + abbreviated operation ID only | B01 response carries no business payload |
| Old/new host mismatch | Unsupported client gains feature | Fail-closed versioned capability/candidate pin | B01/B04 eligibility contract |

## 5. Consent contract and exact copy proposal

The action is not “try saving again.” It is a second transmission of the exact original command. The confirmation must be scoped to one currently owned operation; no remembered/global consent and no default-focused destructive button.

Proposed primary copy:

> **Gửi lại đúng thao tác gốc?**
>
> Hệ thống chưa xác minh được kết quả của thao tác này. Nếu yêu cầu trước chưa hoàn tất, lần gửi này có thể thực hiện nghiệp vụ bán hàng/nhập hàng lần đầu. Ứng dụng sẽ gửi lại đúng mã thao tác và nội dung đã lưu ban đầu, không dùng các thay đổi hiện tại.

Required details: sanitized operation kind, sanitized document label, abbreviated original operation ID, and the statement “một lần xác nhận cho thao tác này.” Do not show raw note/customer names, line payload, JWT/cookie, or permission snapshot.

Buttons:

- default/focus-safe: `Quay lại kiểm tra kết quả`;
- explicit destructive-risk action: `Tôi hiểu, gửi đúng thao tác gốc`;
- Escape/close/Enter on dialog opening performs zero mutation and returns focus.

After a claim is consumed without settlement:

> Lần gửi đã được ghi nhận nhưng kết quả vẫn chưa rõ. Ứng dụng sẽ không tự gửi lại. Hãy kiểm tra kết quả hoặc dùng thông tin hỗ trợ.

`Mở khóa thao tác` remains disabled. The UI must not claim a support ticket exists.

## 6. Retention and server eligibility dependency

The current v2 context is hard-coded OFF and the frozen status/resolution schemas do not carry server UTC or an eligibility deadline. Frontend `createdAt` is browser-generated and cannot be the sole authority. Therefore F01 selects **fail closed**: no predicate set can enable the button with existing responses.

The minimal next contract is the separate additive `web6-resend-eligibility-v1` proposed by B01. Frontend must strictly decode `ALLOW | DENY | INDETERMINATE`, stable reason, server UTC and `eligibleUntilUtc`, and bind it to actor generation, epoch, operation ID, recomputed fingerprint, original kind/method/route/target and current Write/Post grant. It is a short-lived hint, never a reservation. Any async identity/edit/capability change invalidates it.

For an absent GUIDv4 row, current source has no authoritative server creation time. Owner must select the B01 age source before F02: recommended server-issued receipt bound to actor/epoch/key/fingerprint before original dispatch; a browser timestamp compared with server time is a weaker UI-only policy. Until that decision and B04 proof, `NOT_OBSERVED` remains `INDETERMINATE` and resend remains OFF.

## 7. Existing tests and future proof map

| Existing owner | Current proof | F02/F03 addition later |
|---|---|---|
| `web4MutationRuntime.test.ts` | Begin-before-HTTP, quota/no-send, actor/generation/revision fences, 404 remains UNKNOWN, local-only settlement | Eligibility invalidation and one-claim runtime orchestration |
| `web4OperationRepository.spec.ts` | Native IDB atomic original begin/settle, corruption/quarantine, competing tabs for original operation | Dedicated claim schema, two-tab one-winner, abort/quota/versionchange, claim-before-fetch crash |
| `web4OperationCodec.test.ts`, `wireWrites.test.ts` | Frozen identity/body/decimal/line/order, no unsafe mutation retry | Original-only resend port, no new UUID, exact bytes/key |
| `operationStatusPort.test.ts`, `operationResolutionPort.test.ts` | Strict current actor/epoch/grant and 404/expiry/old-host behavior | New versioned eligibility decoder/transport, clock/window and pin failures |
| `RecoverySupport.test.tsx` | Both protected actions disabled and sanitized copy | Explicit modal keyboard/focus/copy; still OFF without all gates |
| `web5TerminalResolution.spec.ts`, `web5TerminalBoundaries.spec.ts`, `web5RecoveryBoundaries.spec.ts`, `web5HistoricalRecovery.spec.ts` | Current negative/UNKNOWN/browser protections | Real two-tab claim and no-reload-send browser cases |
| `tests/integration/web5-ports.test.ts`, `tests/pilot/web5-*.spec.ts` | Historical six-command port/actual bridge coverage | Exact paired B04/F03 SQL/oracle only after implementation |
| `.github/workflows/web.yml` | Typecheck/build/unit/full Chromium and production-config Chromium | No WEB6 runtime PASS until changed tests execute; Edge/Windows remains separate |

## 8. Owner decisions required before F02

- Approve the separate versioned eligibility contract and keep v1/v2 corpora frozen.
- Select the authoritative age source and confirm the initial maximum seven-day eligibility window.
- Confirm one durable claim maximum per original key; no claim reset after ambiguous dispatch.
- Approve the consent copy that states the resend can execute the original business operation for the first time.
- Confirm the action remains hidden/disabled until B04 + F02/F03 verification and a separate nonproduction pilot approval.

This checkpoint does not satisfy any runtime/browser/SQL acceptance case and does not authorize implementation beyond F01.

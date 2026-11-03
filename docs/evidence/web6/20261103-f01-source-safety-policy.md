# WEB6 F01 evidence — source, consent and safety policy

**Date:** 2026-11-03 (Asia/Bangkok). **Checkpoint:** SOURCE/POLICY DOCUMENTED; OWNER TECHNICAL REVIEW REQUIRED. **Feature:** OFF / no runtime change.

## Scope and revisions

- Frontend source: `a011230fc9d5057ab76321251ad0a292e18aecbc` (roadmap PR #32 is merged).
- Backend source consumed: `c7782429e105688e916fe2a0d41bb58fc0a1cb4d`.
- Deliverable: [F01 frozen source, consent and safety policy](../../development/WEB6_F01_SOURCE_SAFETY_POLICY.md).
- Only F01/B01 source, state, threat, method/test and consent mapping was performed. F02–F05/B02–B06 were not implemented or executed.

## Verified source facts

| Check | Result |
|---|---|
| WEB4 fixture | 48 files; tree `fcab4a1e7505b150a132ce2899002930e9f2a6ee` |
| WEB5 fixture | 41 files including manifest; tree `43c922fd9fded72118555d29e3a068762984a985`; manifest SHA-256 matches backend `fef5f1f18d3a556bf35d5c9ed6bc38af3eeb0c1a89dd5f9d125d7fb190a133b2` |
| Runtime behavior | `write()` creates a new GUID; restore performs no automatic mutation; unsafe 401 does not refresh/replay; 404 maps to UNKNOWN/not-observed |
| Current UI | `Gửi lại đúng thao tác` and `Mở khóa thao tác` remain disabled |
| Eligibility | Current v2 context only accepts `sameKeyResendEnabled: false`; no trusted server clock/window exists |
| Cross-tab | Existing IDB protects original begin/settlement; no WEB6 resend claim is implemented |

## Verification performed

Under `docs/TEST_POLICY.md`, this PR is Markdown-only. No unit, browser, SQL, or IIS run is claimed. Checks were limited to current source/test inspection, corpus/tree/hash verification, dependency/lock inventory, Markdown diff/link/status/encoding validation, and cross-repository policy consistency on the delivery commit.

Historical WEB5 totals (1,397 unit, 275 Chromium, 125 focused Edge) were not rerun and are not WEB6 PASS.

Commands used for the final documentation gate:

```powershell
git diff --check
git rev-parse HEAD:tests/fixtures/web4-v1/corpus
(git ls-files tests/fixtures/web4-v1/corpus | Measure-Object).Count
(Get-FileHash -Algorithm SHA256 tests/fixtures/web5-resolution-v1/manifest.json).Hash
rg -n "write|checkResult|checkResolution|retryLocalResult|DISPATCHED|NOT_EXECUTED|Gửi lại đúng thao tác" src tests
```

Executed runtime tests: **0**. Unit/browser/SQL/IIS cases: **NOT RUN**, appropriate for the Markdown-only F01 checkpoint. The final delivery commit also runs the repository-status, link-target, UTF-8/no-BOM/LF and `git diff --check` gates.

## Conditions established

- Exact original GUID/method/route/target/body/fingerprint/expectedVersion/actor/epoch are mandatory; current UI values cannot replace them.
- `UNKNOWN` and `NOT_OBSERVED` remain protected. A manual same-key send may perform the original business operation for the first time.
- Original Write/Post grant, actor generation, document generation/edit revision and draft/operation CAS must be fresh at every async boundary.
- One browser-storage claim coordinates tabs only; backend actor/key/epoch journal fencing owns cross-device one-effect safety.
- No automatic mutation retry, new resend operation ID, runtime SQL elevation, quarantine cleanup, WEB5 archive edit, or UI enablement occurred.

## Owner decisions / blockers

Owner review is required for the proposed separate `web6-resend-eligibility-v1`, authoritative age source, seven-day initial ceiling, one-claim policy, and consent wording. Recommendation: server-issued receipt bound to the original identity before first dispatch. Until accepted and proven by B04/F02/F03, eligibility is fail-closed and the resend action remains OFF.

**Acceptance state:** F01 source/consent evidence is prepared for review, not Owner-accepted; no browser/runtime acceptance is claimed.

# WEB5-02 / F02 — Versioned terminal resolution

**2026-11-02: DONE (bounded) / VERIFIED NONPRODUCTION — technical scope.** Port source `b017da6b3867fc5ff1885c8aed7538103c374d8f`; runtime/storage/UI checkpoint `a04d41bd3456f7709108d1e2fe8bd1fe7919ad09`, followed by clean-preview privacy fix `cf5252071dc7bacda3d0240b30d6d30196385959`, documented below. Owner selected WEB5-02/03 and explicitly authorized backend B02/B04-B. This record owns the full terminal-resolution increment; [earlier metadata fallback evidence](20261102-f02-operator-metadata.md) remains unchanged historical evidence for its separate candidate. [Owning plan](../../plans/20261102-001-web5-operational-safety-web.md#3-f02--terminal-resolution-ux-and-conditional-explicit-resend-web5-02) · [design and user workflow](../../design/WEB5_RECOVERY_AND_RELEASE_BOUNDARIES.md#41-current-terminal-resolution-workflow) · [acceptance](../../development/WEB5_WEB_ACCEPTANCE.md).

## Source and protocol pins

| Item | Exact source / disposition |
| --- | --- |
| Frontend port/transport | `b017da6b3867fc5ff1885c8aed7538103c374d8f` |
| Frontend core, storage, UI and review fixes | `a04d41bd3456f7709108d1e2fe8bd1fe7919ad09` |
| Subsequent clean-preview privacy fix | `cf5252071dc7bacda3d0240b30d6d30196385959`: one clean-record admission branch plus four focused unit cases; independently re-reviewed APPROVED, no unresolved P1/P2 |
| Backend executable contract | `2d72700294227ef69f1a7a61a2969a6bfe2c58be`, [resolution contract](https://github.com/chung6a8m/MyDmsVn/blob/2d72700294227ef69f1a7a61a2969a6bfe2c58be/docs/contracts/web5-resolution-v1/README.md) |
| Backend mode/schema | Explicit `web5` / exact13; additive v1 compatibility under ADR0015; Desktop10, legacy-Web11 and Web4/exact12 remain separate |
| Separate frontend corpus | `tests/fixtures/web5-resolution-v1/`: 40 manifest-owned files plus manifest, with separate provenance JSON; copied bytes independently compared to the exact backend commit |
| Manifest SHA256 | `fef5f1f18d3a556bf35d5c9ed6bc38af3eeb0c1a89dd5f9d125d7fb190a133b2` |
| Backend schema013 definition fingerprint | `D0A86EA0CACAB3D68F1188A1166227DFA5DE452572D1719CD55A3FA3C16F02C9`, backend-owned measurement/evidence |
| Frozen WEB4 corpus | Original 48 blobs unchanged; backend tree `fcab4a1e7505b150a132ce2899002930e9f2a6ee`; original v1 frozen requests/fingerprints/outcomes retained |
| Hosted backend source proof | [B04-B run41432523016](https://github.com/chung6a8m/MyDmsVn/actions/runs/41432523016):167/167 SQL PASS, zero failed/skipped, owned cleanup; source `2d727002`; backend evidence owns the oracle and provenance |
| Backend final documentation head | `272e1d2fa98848f5a65236f9d6b7b40a34a1011d`; final-head [SQL run41435433435](https://github.com/chung6a8m/MyDmsVn/actions/runs/41435433435) 167/167 PASS, zero failed/skipped and owned cleanup; SQL-free PR run41435403449 and push run41435396862 each 548 HTTP +69 helper PASS |
| Final actual SQL-bridge source | Backend `272e1d2fa98848f5a65236f9d6b7b40a34a1011d` paired with committed F03 `2f087caddfa87a2d0f68bee0eefc63537307e6c0`; 1 .NET wrapper +1 child Vitest PASS separately; production ports unchanged through final browser candidate |
| Final paired browser source | Combined F03 `436b18abac0acc4f770332817920af152b8ea09c`; app `src` tree `3745168523d8853e7fe49b0f67de716af4352f44` is identical to F02 `cf52520`. The paired browser results below establish this functional-source boundary, not an unrun F02 exact-head CI result |

Backend authored vectors are contract evidence, not captured SQL results. Backend B02/B04-B [implementation](https://github.com/chung6a8m/MyDmsVn/blob/2d72700294227ef69f1a7a61a2969a6bfe2c58be/docs/evidence/web5/20261102-b02-terminal-resolution.md) and [SQL evidence](https://github.com/chung6a8m/MyDmsVn/blob/2d72700294227ef69f1a7a61a2969a6bfe2c58be/docs/evidence/web5/20261102-b04b-candidate-sql.md) remain independently owned. A hosted SQL PASS does not prove browser acceptance or full IIS.

## Implemented boundary

- The versioned port uses only canonical empty-body GET for separate v2 context/resolution, strict JSON/Zod/size/identity validation and fresh WEB4 rehash. It rechecks actor/epoch/actor generation, document ownership and the original Write/Post grant around asynchronous work. Ordinary Read is not required for original outcome recovery. Current denied/stale/malformed/error responses cannot mint a negative. Original v1 transport/status behavior remains intact; unsupported v2 discovery may use only the unchanged positive protected v1 read.
- A fresh exact NOT_EXECUTED response transitions only its matching draft/operation after one completed IndexedDB transaction and exact sequence/identity/source CAS. Operation-record `schemaVersion:2` identifies the explicit NOT_EXECUTED state; existing record states and frozen request schema1 remain intact in the existing database/stores. The raw snapshot, lookup buffers, decimal strings and clientLineIds remain unchanged.
- A persisted certificate is shape/content data, never fresh authority. Reload restoration rehashes its lineage, rereads the exact server decision under current authority, rechecks the final draft bytes and synchronously validates adoption before opening. Transient lineage admission is never serialized; grant/actor/epoch changes and failed explicit rechecks remove editing admission. Deletion, new durable writes and logout cleanup cannot bypass unverified negative lineage.
- Negative settlement retains a review lock. A new Create needs explicit consent and confirmation, followed by a separate Save which creates a new UUID. Existing documents require an authorized fresh baseline Get and explicit confirmation; denied Read keeps them protected even when the original negative read is authorized by Write/Post. No branch automatically sends a mutation or resends the original operation.
- Expired/unavailable results remain protected; support correlation is not proof of business-case closure or an editable version. Optional local archival and support-ticket closure are NOT IMPLEMENTED; there is no Owner archival policy. Nova/Base UI, AG Grid Community, Dockview and existing dependencies remain unchanged.

## Verification checkpoints

The completed technical gates support bounded F02 verification. Historical checkpoints and failed attempts retain their original source and runner. Native counts from different runs are not summed into a fictional full suite; exact-head hosted frontend CI and merge disposition remain separate.

| Gate / command or runner | Executed result | Scope / source limitation |
| --- | --- | --- |
| Port-focused Vitest selection |130/130 PASS | Three new HTTP files; included in738/738 all-HTTP PASS on `b017da6` |
| `npm.cmd run test:unit` |1,395/1,395 PASS in 71 files, zero failed/skipped | Final functional source `cf52520`, including 62 runtime cases and all three reviewed fixes; earlier `a04d41b` checkpoint was 1,391/71 |
| Clean-preview focused unit selection |4/4 PASS | Two quarantined-negative denials plus valid/no-operation and SETTLED clean positives;58 other tests intentionally excluded by name filter |
| Full runtime + durable workspace selection |77/77 PASS, zero skipped | Latest privacy-fix source:62 runtime +15 workspace cases |
| `npm.cmd run typecheck` |PASS | Repeated successfully after the clean-preview privacy fix |
| Native terminal UI, Chromium |24/24 PASS | Initial complete terminal-UI checkpoint:6 negatives,2 explicit Create intents,2 quota/local-only,6 original positives,8 unavailable/absent/expired cases; predates final review fixes |
| Focused native Edge |35/35 PASS |24 UI +11 new repository cases; predates final review fixes; not full Edge acceptance |
| Native IndexedDB repository checks |11 new +21 retained PASS | Separate repository checkpoint; real IDB, not SQL and not additional UI cases |
| Latest selected Chromium regressions |6/6 PASS | Two retained expiry cases, two new expiry cases and two actual403/recheck regressions after P2 fix |
| `npm.cmd run build` |PASS | `a04d41b` source; existing Vite >500kB chunk warning retained, no dependency change |
| Production-artifact isolation |1/1 PASS, 7.3s | `a04d41b`; published frontend artifact excludes Lab/fake runtime; no SQL/IIS proof |
| Actual TypeScript → TestServer → SQL bridge |1 .NET wrapper +1 child Vitest PASS, separately zero skipped | Final backend `272e1d2` + committed F03 `2f087cad`; production ports unchanged through `436b18a`; actual SQL/physical oracles, not native-browser or mock-as-SQL counts |
| First full Chromium attempt |243 executed:242 PASS /1 FAIL | `a04d41b`; one destroyed-context failure during initial Lab import before the test body; trace confirmed a second Lab GET. The test now waits for visible Lab text before import; focused 11/11 repository cases PASS. This first full attempt is retained as failed; final paired full result appears below |
| Second F02 full Chromium attempt |243 executed:241 PASS /2 FAIL | `cf52520`; two retained Sales Recovery cases timed out after panels disappeared. Traces show 10 simultaneous Vite full-reload messages followed by a new document GET; triggering file unknown. No Lab source/test change. Frozen unchanged targeted rerun:2/2 PASS in8.3s. This full attempt remains failed |
| Final paired full Chromium |273/273 PASS,6.2min, zero retries/skips | Combined `436b18a`, identical F02 app source tree above; includes F02 terminal UI, native repository and retained regressions. This is the combined 273 suite, not a claimed successful local F02-only243 rerun |
| Final paired focused Edge |123/123 PASS,4.3min, zero retries/skips | Eight affected files on combined `436b18a`, identical F02 app source; includes final F02 cases. Focused Edge, not the full Edge suite; earlier35 remains a separate checkpoint |
| Final build / artifact isolation |PASS /1 of1 PASS, 5.4s | `cf52520` functional source, with typecheck PASS; existing Vite >500kB warning retained. Earlier `a04d41b` build/artifact PASS is separate |
| Exact-head frontend hosted CI / merge disposition |PENDING / NOT CLAIMED PASS | [PR #26](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/26) owns the eventual documentation-head CI and merge disposition; F02 exact-head243 browser CI still to run after push. F03 remains IN PROGRESS until its own hosted CI |

Measured tools: Windows with Node 22.14.0, npm 11.6.0, Playwright 1.64.1; actual Chromium 156.0.8078.4 and Microsoft Edge 156.0.4314.58. Browser execution uses repository Playwright because the Browser plugin skill was absent. Existing dependencies remain pinned. Raw logs, credentials, SQL connection data and proprietary fixture output remain outside Git.

Final `cf52520` functional-source build assets:

| Asset | SHA256 |
| --- | --- |
| `index-DVWN4-YJ.js` | `382DB2C8B365B12B9501C0E5DA14CEFFF60C649680480294C6350A7E5F6A71CD` |
| `index-io_KjKCp.css` | `1D481D99749429B6F18DAF87919F8C6839579839EC23AC28FA5ECE6980DF2A80` |

The final actual SQL bridge on backend `272e1d2` / frontend `2f087cad` observed 12 unique keys with one dispatch each, 6 COMMITTED plus 6 NOT_EXECUTED records, 6 operator decisions, 18 v2 reads, 2 ordinary Get 403 outcomes, one TestServer restart, an independent physical SQL oracle and existing-helper-owned disposal. Its .NET/child counts are distinct from native browser cases. Independent postrun verification found zero test databases, zero test-database sessions and zero Vitest bridge children. Earlier backend `2d727002` / F03 bytes committed as `08d437bf` also passed 1 wrapper +1 child; the final paired run above owns current interoperability proof. Production ports remained unchanged through `436b18a`.

## Review findings and retained development failures

1. **P1 — adoption/binding interleave:** independent review established that background local inspection could invalidate the shared validation cache during the final awaited draft reread. A clean negative draft could open without its review lock. Two focused RED cases reproduced asynchronous and synchronous publication paths. The fix adds exact synchronous adoption validation after the final reread, no NTE cache fallback, defensive review locking during binding and bound-generation admission before a new write. Focused re-review APPROVED the fix.
2. **P2 — failed explicit recheck retained prior authority:** after an earlier valid negative, a 403 or timeout could leave editing admission usable while local capabilities were stale. Two unit RED cases and two actual Chromium UI RED cases established the failure. The fix revokes the relevant lineage before an explicit refresh, restores review protection and readmits only after complete fresh success; failed completion retains no editing authority. Unit and selected native regressions passed; independent re-review APPROVED.
3. **P2 — unvalidated clean-preview privacy:** a cleared draft marker could bypass original-kind privacy when its associated negative operation was quarantined at first load, because no lineage was available and the clean-preview branch accepted an ordinary module grant. Restore/delete already failed closed; the defect exposed snapshot-derived preview metadata without verified lineage. The clean-preview branch now requires exact successful local inspection before exposing the preview. Pending corrupt-operation fallback behavior remains unchanged. Two Sales/Receipt Post denial cases reproduced RED; two ordinary clean history cases stayed positive. Independent re-review APPROVED this narrow fix with no unresolved P1/P2; it retains local-only inspection and ordinary clean-draft behavior.
4. Port test-first evidence: initial scaffold 47 cases ran 19 PASS/28 expected failures; implementation reached 47 PASS. Expanded 130 selection then ran 128 PASS/2 FAIL because v2 GET bodies were still accepted; empty-body admission fixed both, followed by 738/738 all-HTTP PASS.
5. Root integration RED cases separately established missing cleared-record inspection and a final-draft-byte TOCTOU; focused corrections reached 17 combined and 14 workspace cases. The synchronous-adoption workspace selection passed 15. These focused development counts are not added to the 1,391-unit checkpoint.
6. Retained UI-development failures: two nullable-settlement TypeScript diagnostics were corrected in tests. Two old expiry wording assertions failed after the intentional protected result-unavailable wording change, then were corrected only for expired outcomes. A selected retry saw one metadata PASS and one fail-closed restore failure while the adoption hook temporarily preceded the core export; the final integrated source supersedes that transient checkpoint. No timeout increase, skipped case, automatic retry or production workaround hides these attempts.
7. Retained F03 Edge fixture failures: the initial123 selection ran121 PASS /2 FAIL. Receipt Create used actual frozen raw note `""` but a mock COMMITTED note `null`; the strict decoder correctly rejected it and retained DISPATCHED. A keyboard Escape/reopen overlapped the100ms modal close transition. An unchanged targeted rerun ran1 PASS /1 FAIL. Test-only `436b18a` corrected the mock note and waited for modal closing readiness; targeted2/2 PASS in9.9s, then final focused123/123 PASS. No production decoder or modal behavior was relaxed.

Exact clean-preview fix commands and observed results:

- RED: `npm.cmd run test:unit -- tests/unit/drafts/web4MutationRuntime.test.ts -t 'clean .*previews'` executed4 cases: 2 FAIL (expected false, actual true for quarantined Sales/Receipt Post previews),2 PASS;58 unmatched cases intentionally excluded.
- GREEN after the one-line admission change: same command,4 PASS /0 FAIL;58 unmatched cases excluded.
- `npm.cmd run test:unit -- tests/unit/drafts/web4MutationRuntime.test.ts tests/unit/drafts/durableDraftWorkspace.test.ts`:77 executed /77 PASS /0 FAIL /0 SKIP.
- `npm.cmd run typecheck`:PASS, exit0 after the privacy fix. This implementer ran no full-unit/browser/build/artifact gate; root subsequently reported 1,395/71 full-unit PASS, final build/typecheck PASS and 1/1 artifact PASS on the fixed functional source. Root subsequently completed the paired identical-source browser and actual SQL-bridge gates recorded above; exact-head hosted frontend CI remains pending.

Independent port/corpus review APPROVED the strict v2 boundary and exact copied bytes. Independent full core/UI review found the first two issues above, then APPROVED those fixes at `a04d41b`. The subsequent clean-preview privacy fix was separately independently re-reviewed APPROVED, with no unresolved established P1/P2. Source review is supplemented by the completed source-paired gates above; it does not replace pending exact-head hosted CI or release approval.

## Remaining acceptance and limits

F02 technical scope is DONE (bounded) / VERIFIED NONPRODUCTION: final functional-source unit/typecheck/build/artifact, all three independently approved review fixes, paired identical-source full Chromium/focused Edge, actual SQL bridge and backend final-head SQL/SQL-free gates PASS. Exact-head frontend hosted CI and merge disposition remain pending in [PR #26](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/26); no run ID or CI PASS is inferred. F03 remains selected IN PROGRESS until its own hosted CI. Historical fallback and pre-core counts stay attached to their original candidates. This closeout authorizes no deployment or production GO.

Same-key resend is DISABLED / NOT APPROVED. No automatic retry/new-key replay follows UNKNOWN,404, timeout or expiry. Local case archival, positive support-case closure and B03 full operator CLI/operational rehearsal remain outside this implementation. F04 real full IIS (W3SVC/WAS), separately attended Telex/VNI/Narrator/scaling and F05/B06 release decisions remain NOT RUN / NOT APPROVED. IIS Express, controlled HTTP, TestServer and synthetic composition do not substitute. Independent CEX and archived WEB1–04 remain unchanged.

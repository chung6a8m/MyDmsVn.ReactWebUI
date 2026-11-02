# WEB4-06 / F05 — Operator UX handoff and documentation candidate

**Final disposition 2026-11-02: DONE (bounded), Owner accepted; PR #22/backend #85 merged; Roadmap 04 ARCHIVED.** The candidate sections below retain their original checkpoint meaning; [final acceptance](#owner-acceptance-merge-and-archive--2026-11-02) supersedes pending disposition, without changing prior results/limits.

**Date:** 2026-11-02 (Asia/Bangkok). **Status:** VERIFIED DOCUMENTATION CANDIDATE; Owner selected WEB4-06, documentation checks and independent review complete. Owner acceptance, PR merge and roadmap archive are pending. [Owning F05 plan](../../plans/20261101-002-web4-reliability-web.md#6-f05--operator-ux-handoff-docs-and-closeout-in-progress--selected-2026-11-02) · [user recovery guide](../../development/WEB4_USER_RECOVERY_GUIDE.md).

## Scope and source provenance

- Frontend clean `main` baseline: `0e44c5b5cab363d1c24fb785bb5679e2e551d327`, after accepted WEB4-05 frontend PR #21 merge `f7765f052a66242e978a38daa4c22221ea262411` and its documentation closeout.
- Branch: `codex/web4-06-operator-handoff`, isolated worktree. Deliverable commit: `3823b39aaf6736eb41cd097e0130c0d8a3d31f7c`; the follow-up records review and preserves two legacy heading anchors. Final task head is the submitted PR head, not a new runtime pin. No runtime, package/lockfile, fixture, test, auth, UI, schema or SQL changes are included.
- Backend clean `main` baseline: `473c6bfc39ca545c945a2387f1c644ff361a2132`, after PR #84 merge `9ef084a61c1dd0e9f59be049fb5fbb51870e9444`. B06 documentation candidate `7be9ee3b45ac54bc3c7d642038fc77cf794ea944` on `codex/web4-06-operator-handoff-backend`: [operator handoff](https://github.com/chung6a8m/MyDmsVn/blob/7be9ee3b45ac54bc3c7d642038fc77cf794ea944/docs/development/WEB4_OPERATOR_HANDOFF.md) owns backend procedures and candidate disposition.
- B04 implementation remains `bd871518fd162927d938babd5535a2ddf91c2ad5`; B05 fixture pin remains `4d3c75e3ec5c0cb2f165418137d800e5ae5c0762`. No new runtime pin is substituted by these docs.
- Canonical B01 corpus remains `1c603c6ac57e59a3f7b4bc6ca976b2d531c079aa`, manifest SHA-256 `0acab190e7fe126d53c13c0510a1958365e5a6e1fda78a4321da78297e0b3f1a`; [consumer provenance](../../../tests/fixtures/web4-v1/provenance.json) is unchanged.

The user selected an existing F05 plan, so no new product design or runtime feature is introduced. Documentation verification follows [Test Policy §1](../../TEST_POLICY.md#1-chọn-kiểm-tra-theo-thay-đổi); full runtime suites and SQL pilots are not rerun for this docs-only boundary. The earlier F04 commands/counts remain in [F04 evidence](20261102-f04-failure-pilot.md), unchanged and tied to that candidate.

## Deliverable and source review

| F05 requirement | Delivered guidance / source checked at frontend baseline |
|---|---|
| Restore preview, raw draft, conflicting tabs, quota, explicit copy/delete | Guide §§1–3; `LocalDraftControls.tsx`, `productionDrafts.ts`, `durableDraftWorkspace.ts`, IndexedDB repository and snapshot validators. Actual button labels and transaction-complete semantics; no bulk site-data deletion. |
| Lost acknowledgement, absent/expired/denied/mismatched status | Guide §§4–5; `web4MutationRuntime.ts`, `operationStatusPort.ts`, frozen intent codec and durable operation repository. Remain UNKNOWN unless exact authorized positive proof settles locally. |
| Manual same-key resend/operator handling | Guide §§4–5 distinguishes the future gated feature from the current disabled UI. No product resend, operator unlock, direct ledger change or fabricated NOT_EXECUTED route is documented as available. |
| Unsafe layout migration/reset, epoch changes | Guide §6; `workspaceLayouts.ts`, `layoutPersistenceV3.ts`, design lifecycle §§2.1/10. v1/v2 not imported, v3 scope actor+epoch, reset obeys close admission. |
| Local schema/migration, retention/logout | Guide §§3/6/7; `draftRecord.ts`, `indexedDbDraftRepository.ts`, `logoutDraftCleanup.ts`, design §10. Unsupported records stay quarantined; no TTL purge of UNKNOWN, no manual schema rewrite. |
| Write-without-Read, module-specific outcomes and errors | Guide §7; operation status decoder and runtime settlement/rejection. Create/Update original detail; Sales Post version; Receipt Post no version; Get403 is not rollback. |
| Coordinated deployment/Web12 and database rotation | Guide §§6/8 links backend-owned host procedure and B06 runbook rather than duplicating SQL/protocol. Documentation does not authorize deployment or run maintenance. |
| Current routing and bounded closeout | AGENTS, README, selector, owning plan, handoff, acceptance matrix, test-policy supplement, pilot-runbook gate wording and evidence index identify WEB4-06 selection/candidate. Historical checkpoint paragraphs and original evidence remain historical. |

## Verification of this candidate

Local documentation runner: Windows PowerShell, Python 3.14.1. No local browser or server runtime was launched. Hosted regression is recorded separately below. Commands from the frontend worktree:

```powershell
python C:/Users/pdchung/.codex/worktrees/web4-06-handoff/verify-docs.py C:/Users/pdchung/.codex/worktrees/web4-06-handoff/ReactWebUI
git diff --check
git diff --stat
```

The temporary checker (outside the repository) enumerated changed/untracked Markdown against the baseline, decoded strict UTF-8, rejected BOM/CRLF, resolved relative links and heading/explicit anchors, compared 13 protected path groups against baseline and hashed each of the 48 mirrored corpus blobs against unchanged provenance. Initial result: **11 documents, 192 relative links, 12 anchors, 13 unchanged protected scope groups, 48/48 corpus blobs; 0 errors**. `git diff --check`: exit 0. These are document/integrity checks, not executable product testcase counts. New cross-repository B06 links are pinned to the committed B06 tree. `git -C C:/MyData/2026/MyDmsVn/CleanArchitecture-web4-06 cat-file -e 7be9ee3b45ac54bc3c7d642038fc77cf794ea944:docs/development/WEB4_OPERATOR_HANDOFF.md` exited 0. This proves the local committed target exists; remote publication is a separate PR step.

Independent whole-milestone review covered frontend `0e44c5b…3823b39`, backend `473c6bf…7be9ee3`, relevant implementation source and the frontend follow-up preserving legacy F05/WEB4-05 heading anchors. **No actionable P0/P1/P2 or minor findings.** Reviewer verdict: ready for Owner review as a bounded documentation candidate. Parent independently checked the backend candidate: 11 Markdown files, 49 added local links (4 anchors), exact allowed changed paths, 0 errors; both range whitespace checks passed.

The review deliberately does not claim live SQL/IIS/browser or maintenance rehearsal, crash/Commit or production/resend readiness, deployment-specific tooling/audit/backup execution, remote GitHub/hosted CI status, or Owner acceptance. These limits are retained as explicit gates, not omitted work or implied PASS. No behavior changes were required by review. Local runtime tests executed in F05: **0**. Local browser/IndexedDB, .NET, live HTTPS/SQL, full IIS/production and attended IME/Narrator are **NOT RUN in F05**; the hosted regression below is separate and supplies no live SQL or operational acceptance. No screenshots are needed for unchanged UI.

## Acceptance and archive gate

This work prepares a reviewable F05+B06 documentation candidate. It does not supply Owner acceptance of this candidate, merge either PR, archive Roadmap 04 or approve production. After bounded Owner acceptance and PR merge, record the exact reviewed heads/checks/merge SHAs, then archive the execution plan while preserving former-path anchors and original evidence. Do not reopen archived WEB1–03 or change independent CEX.

Same-key resend, real process-crash/Commit proof, operator unlock/terminal NOT_EXECUTED, current-candidate attended Telex/VNI/Narrator, full IIS/production, production audit retention and distributed limiter remain separate gates. A negative status never proves rollback. B06 operational preparation does not turn any of these into PASS.

## Review delivery

[Frontend draft PR #22](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/22) and [backend draft PR #85](https://github.com/chung6a8m/MyDmsVn/pull/85) expose the reviewed candidate. Merge/archive await the plan’s Owner acceptance gate.

[Frontend hosted PR run 41377091298](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/41377091298), job `125059587112`, **PASS** for head `604a4770f3eee10acf63ecc710d5a6f52e958bd2`. Logs checked out PR merge ref `af705d36e205edb62bbce32b0bb90424f3835b07`; after fetching `refs/pull/22/merge`, `git rev-parse 'FETCH_HEAD^{tree}'` and `git rev-parse '604a4770f3eee10acf63ecc710d5a6f52e958bd2^{tree}'` both returned `f1c6044010f14be7455a477a32e2ea7f732191c4`. Runner: Ubuntu24.04, Node22.14.0/npm11.6.0, pinned Playwright1.64.1, Chrome for Testing156.0.8078.4 (Chromium1248).

| Hosted check | Actual result |
|---|---|
| `npm run typecheck` / `npm run build` | PASS / PASS |
| `npm run test:unit` | 66 files, 1,218/1,218 tests PASS |
| `npm run test:e2e -- --project=chromium --workers=2 --forbid-only` | 196/196 PASS; 2 workers; 7.9 minutes |
| `npm run test:e2e -- --config playwright.production.config.ts --workers=1 --forbid-only` | 1/1 PASS |

No failed/skipped cases were reported in these nonempty totals. The existing workflow used `npm ci` and installed the pinned Chromium; this is frontend-controlled/Lab/HTTP-stub regression plus production artifact isolation, not live backend SQL acceptance. No Edge or attended run is added.

Backend final documentation head `ebe245631c25aaffdac3b465e2125a1e9fed25ba` passed [hosted PR run 41377434786](https://github.com/chung6a8m/MyDmsVn/actions/runs/41377434786), job `125060640972`, Windows2022/net48; logs used merge ref `c635dc7a03aa31d570c32121a1e8de6350db3659` and reported 506/506 HttpHost plus 62/62 SQL-free fixture rows, 0 failed/not executed. Its preceding tested-head record and commands are owned by [B06 evidence](https://github.com/chung6a8m/MyDmsVn/blob/ebe245631c25aaffdac3b465e2125a1e9fed25ba/docs/evidence/web4/20261102-b06-operator-handoff.md).

This final frontend follow-up only records observed hosted results and clarifies local versus hosted scope. It does not claim another execution or inherit CI PASS for a later head; the PR reports any subsequent workflow separately. Documentation checks were rerun after this evidence update. No prior evidence or runtime source changed.

## Owner acceptance, merge and archive — 2026-11-02

Owner explicitly accepted the recorded scope and limitations and instructed: verify final CI, review/fix as needed, merge PR #22 and #85 when CI PASS, update evidence and archive Roadmap 04. No further approval was required for this authorized documentation closeout. Final independent review covered frontend `3823b39…5afc2b75d7fb5fd5839e873eb3272ab4014926b3` and backend `7be9ee3…ebe245631c25aaffdac3b465e2125a1e9fed25ba`: no actionable P0/P1/P2 or minor findings. GitHub review submissions/threads were empty for both PRs at the final check; no unresolved finding required a fix.

Final frontend [CI run 41378106326](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/41378106326), job `125062721559`, **PASS** for head `5afc2b75d7fb5fd5839e873eb3272ab4014926b3`: typecheck/build PASS; 66 unit/component files and 1,218 tests PASS; 196 Chromium tests PASS (7.1 minutes); 1 production-artifact test PASS, no failed/skipped cases. Commands/toolchain are the unchanged workflow listed above. Log checkout `41dd6df93154bfada86578f864128e1272ca0e26` and head both have tree `ff2305ade05a788f2d1488aa6afbf8c7d00a1757`.

Final backend [CI run 41377434786](https://github.com/chung6a8m/MyDmsVn/actions/runs/41377434786), job `125060640972`, **PASS** for head `ebe245631c25aaffdac3b465e2125a1e9fed25ba`: 506/506 HttpHost + 62/62 SQL-free fixture rows, 0 failed/notExecuted. Log checkout `c635dc7a03aa31d570c32121a1e8de6350db3659` and head both have tree `b0416a0ca9626a2d49681d11f507f86f44f97986`. These run counts are independent executions of existing tests, not additional unique scenarios or live SQL proof.

Backend [PR #85](https://github.com/chung6a8m/MyDmsVn/pull/85) merged first at `a3f3db16381a38bdf0b76e8ab36cb55bec02bbd2`, then frontend [PR #22](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/22) at `ea104582a5aa4bcdf0d04999296a30a3c43e450e`. Both merges used the exact expected head SHA; fetched merge trees match the reviewed CI-passing trees above. Branches were retained.

The post-merge archive baseline is frontend `ea104582a5aa4bcdf0d04999296a30a3c43e450e`; backend `a3f3db16381a38bdf0b76e8ab36cb55bec02bbd2`. [Archive disposition](../../archive/20261102-web4-reliability/README.md) and [frozen plan](../../archive/20261102-web4-reliability/plans/20261101-002-web4-reliability-web.md) close Roadmap 04. The former plan retains all headings/explicit anchors; current selectors/AGENTS/README/handoff route to archive/reference docs. New work requires a separately selected plan. Original F01–F04 and WEB1–03 evidence, runtime, tests, dependency pins and canonical fixture bytes are preserved.

Archive validation (Windows PowerShell/Python3.14.1): **14 changed/new Markdown documents, 221 relative links, 31 anchor references, 14 protected scope groups, 48/48 canonical corpus blobs, 13/13 legacy plan IDs preserved in both wrapper/frozen plan, 12 prior evidence files unchanged; 0 errors**. The frozen plan equals the completed plan committed at `17ce03862523ed6f1f20eb4265aacb00732e74ac` after normalizing relative link targets and removing the archive banner. UTF-8 without BOM/LF and `git diff --check` passed. A trailing blank line found during archive preparation was removed before the final checks.

```powershell
python C:/Users/pdchung/.codex/worktrees/web4-06-handoff/verify-archive.py C:/Users/pdchung/.codex/worktrees/web4-06-handoff/ReactWebUI
python C:/Users/pdchung/.codex/worktrees/web4-06-handoff/verify-archive-extra.py
git diff ea104582a5aa4bcdf0d04999296a30a3c43e450e --check
```

Independent frontend archive review covered merge baseline `ea104582…17ce038` plus the 14-document archive diff and found no actionable P0/P1/P2 findings; it independently confirmed frozen equivalence, legacy anchors, preserved evidence and unchanged limits.

The temporary verifiers live outside the repository and check only documents/integrity against the recorded merge baseline, not product behavior. This documentation-only archival runs **0 local runtime tests**; no new SQL/IIS/Edge/attended, migration, operator maintenance or deployment was executed. The exact hosted results above precede archive metadata and are not relabelled as a later-head runtime PASS.

**WEB4-06/F05+B06 DONE (bounded); Roadmap 04 COMPLETED / ARCHIVED.** Same-key resend remains disabled; terminal NOT_EXECUTED/operator unlock, real process-crash/Commit proof, operator tooling/audit/rotation/compaction/backup rehearsal, full IIS/production, production audit retention/distributed limiter and attended candidate Telex/VNI/Narrator remain unverified or unapproved. Independent CEX remains unchanged. Acceptance of limits does not turn NOT RUN into PASS.

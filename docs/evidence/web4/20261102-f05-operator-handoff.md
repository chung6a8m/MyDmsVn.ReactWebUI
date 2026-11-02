# WEB4-06 / F05 — Operator UX handoff and documentation candidate

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

Runner: Windows PowerShell, Python 3.14.1. No browser or server runtime was launched. Commands from the frontend worktree:

```powershell
python C:/Users/pdchung/.codex/worktrees/web4-06-handoff/verify-docs.py C:/Users/pdchung/.codex/worktrees/web4-06-handoff/ReactWebUI
git diff --check
git diff --stat
```

The temporary checker (outside the repository) enumerated changed/untracked Markdown against the baseline, decoded strict UTF-8, rejected BOM/CRLF, resolved relative links and heading/explicit anchors, compared 13 protected path groups against baseline and hashed each of the 48 mirrored corpus blobs against unchanged provenance. Initial result: **11 documents, 192 relative links, 12 anchors, 13 unchanged protected scope groups, 48/48 corpus blobs; 0 errors**. `git diff --check`: exit 0. These are document/integrity checks, not executable product testcase counts. New cross-repository B06 links are pinned to the committed B06 tree. `git -C C:/MyData/2026/MyDmsVn/CleanArchitecture-web4-06 cat-file -e 7be9ee3b45ac54bc3c7d642038fc77cf794ea944:docs/development/WEB4_OPERATOR_HANDOFF.md` exited 0. This proves the local committed target exists; remote publication is a separate PR step.

Independent whole-milestone review covered frontend `0e44c5b…3823b39`, backend `473c6bf…7be9ee3`, relevant implementation source and the frontend follow-up preserving legacy F05/WEB4-05 heading anchors. **No actionable P0/P1/P2 or minor findings.** Reviewer verdict: ready for Owner review as a bounded documentation candidate. Parent independently checked the backend candidate: 11 Markdown files, 49 added local links (4 anchors), exact allowed changed paths, 0 errors; both range whitespace checks passed.

The review deliberately does not claim live SQL/IIS/browser or maintenance rehearsal, crash/Commit or production/resend readiness, deployment-specific tooling/audit/backup execution, remote GitHub/hosted CI status, or Owner acceptance. These limits are retained as explicit gates, not omitted work or implied PASS. No behavior changes were required by review. Runtime tests executed in F05: **0**; runtime PASS is **not claimed**. Browser/IndexedDB, .NET, HTTPS/SQL, full IIS/production and attended IME/Narrator are **NOT RUN in F05**. No screenshots are needed for unchanged UI.

## Acceptance and archive gate

This work prepares a reviewable F05+B06 documentation candidate. It does not supply Owner acceptance of this candidate, merge either PR, archive Roadmap 04 or approve production. After bounded Owner acceptance and PR merge, record the exact reviewed heads/checks/merge SHAs, then archive the execution plan while preserving former-path anchors and original evidence. Do not reopen archived WEB1–03 or change independent CEX.

Same-key resend, real process-crash/Commit proof, operator unlock/terminal NOT_EXECUTED, current-candidate attended Telex/VNI/Narrator, full IIS/production, production audit retention and distributed limiter remain separate gates. A negative status never proves rollback. B06 operational preparation does not turn any of these into PASS.

## Review delivery

Paired draft PRs will expose the verified candidate for review; merge and archive await the plan’s Owner acceptance gate. Hosted workflow execution, if triggered by publication, is separate from these local documentation checks and must be read at its exact head before claiming CI PASS.

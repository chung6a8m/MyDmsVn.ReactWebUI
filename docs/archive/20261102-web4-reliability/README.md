# Roadmap 04 — Web Reliability & Delivery Foundation archive

**ARCHIVED / COMPLETED (bounded), 2026-11-02. F01–F05 DONE.** Owner explicitly accepted WEB4-06/F05+B06 scope and recorded limits, authorized final CI/review and paired merges, then requested this archive. The archive closes the execution queue; it does not approve production.

[Frozen frontend owning plan](plans/20261101-002-web4-reliability-web.md) · [F05 acceptance/evidence](../../evidence/web4/20261102-f05-operator-handoff.md#owner-acceptance-merge-and-archive--2026-11-02) · [all WEB4 evidence](../../evidence/web4/README.md) · [current selector](../../plans/README.md) · [backend companion archive](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/archive/20261102-web4-reliability/README.md).

## Accepted source and verification

- Completed-plan checkpoint before archive: `17ce03862523ed6f1f20eb4265aacb00732e74ac`. The frozen plan is equivalent to that committed plan after rebasing relative links and adding the archive banner.
- Frontend [PR #22](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/22): reviewed head `5afc2b75d7fb5fd5839e873eb3272ab4014926b3`, merge `ea104582a5aa4bcdf0d04999296a30a3c43e450e` (archive baseline).
- Backend [PR #85](https://github.com/chung6a8m/MyDmsVn/pull/85): reviewed head `ebe245631c25aaffdac3b465e2125a1e9fed25ba`, merge `a3f3db16381a38bdf0b76e8ab36cb55bec02bbd2`. Each merge tree equals its reviewed, CI-passing tree.
- Final frontend hosted run `41378106326`: typecheck/build, 1,218 unit/component, 196 Chromium and 1 production-artifact PASS. Backend hosted run `41377434786`: 506 HttpHost + 62 SQL-free fixture rows PASS. These are exact-candidate regressions, not a live SQL/production rehearsal.
- F04/B05 previously accepted separate fresh Chromium/Edge HTTPS/IIS Express/SQL pilots; their original evidence remains unchanged. B01 corpus and B04/B05 runtime pins remain owned by the existing provenance/evidence.

## Accepted limits retained

Same-key resend UI remains disabled; operator unlock/terminal NOT_EXECUTED is not implemented or verified. Lost acknowledgement is UNKNOWN; 404/timeout/absence is never rollback proof. Real process-crash/Commit safety, operational rotation/compaction/backup rehearsal and deployed maintenance tooling/audit infrastructure remain unverified. Full IIS/production, production audit retention/distributed limiter and attended candidate Telex/VNI/Narrator remain NOT RUN or NOT APPROVED. JWT in localStorage retains its XSS risk. No new grants, migration, runtime or deployment was performed. CEX WinForms remains independently active in the backend; archived WEB1–03 retain their original decisions.

## Routing and preservation

The [former plan path](../../plans/20261101-002-web4-reliability-web.md) retains all prior heading and explicit anchors and routes to the frozen sections. The frozen plan preserves the completed record and dated historical checkpoints, with relative links rebased and an archive banner. Earlier PLANNED/IN PROGRESS text inside historical checkpoints is not a task queue.

Evidence stays at its original paths. F01–F04 and WEB1–03 evidence remain byte-for-byte unchanged; F05 records this authorized acceptance/archive. [User recovery guide](../../development/WEB4_USER_RECOVERY_GUIDE.md), [draft/recovery design](../../design/WEB4_DURABLE_DRAFT_AND_RECOVERY.md), [acceptance matrix](../../development/WEB4_WEB_ACCEPTANCE.md) and [pilot runbook](../../development/WEB4_PILOT_RUNBOOK.md) remain technical references. The [Codex handoff](../../development/WEB4_CODEX_HANDOFF.md) is historical. A new task requires a new Owner-selected scope.

Archive verification checks links/anchors, frozen-plan equivalence, preservation of evidence/runtime/fixtures, UTF-8 without BOM/LF and diff. No new runtime test result follows from archival.

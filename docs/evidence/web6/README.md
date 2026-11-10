# WEB6 frontend evidence — active implementation

**2026-11-10: F01–F04 BOUNDED IMPLEMENTATION RECORDED; LIVE F04 CANDIDATE/LOAD/RECOVERY BLOCKED / NOT RUN.** Local/frontend gates do not enable the feature or report SQL/IIS acceptance.

[Owning roadmap](../../plans/20261103-001-web6-recovery-quality-web.md) · [manual resend state/UX design](../../design/WEB6_MANUAL_RESEND_AND_RECOVERY_UX.md) · [acceptance matrix](../../development/WEB6_WEB_ACCEPTANCE.md) · [Codex handoff](../../development/WEB6_CODEX_HANDOFF.md) · [archived WEB5](../web5/20261103-web5-roadmap-closeout.md) · [backend WEB6 evidence](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/evidence/web6/README.md).

| Task | Future proof | State |
|---|---|---|
| F01 | [Frozen source/contract and consent/retention checkpoint](20261103-f01-source-safety-policy.md) | READY FOR OWNER TECHNICAL REVIEW; feature OFF |
| F02a | [Durable receipt and one-shot IndexedDB claim](20261110-f02a-durable-claim.md) | IMPLEMENTED / LOCALLY VERIFIED; feature OFF |
| F02b | [Signed eligibility and frozen original transport](20261110-f02b-frozen-transport.md) | IMPLEMENTED / LOCALLY VERIFIED; acceptance blocked; feature OFF |
| F03 | [Guarded confirmation and browser integration](20261110-f03-manual-resend-ux.md) | IMPLEMENTED / LOCAL BROWSER VERIFIED; actual SQL acceptance blocked; feature OFF |
| F04a | [Paired candidate and compatible cutover](20261110-f04a-paired-cutover.md) | IMPLEMENTED / LOCALLY VERIFIED; live pair BLOCKED / NOT RUN; feature OFF |
| F04b | [Frontend gates and measured-quality disposition](20261110-f04b-measured-quality.md) | FRONTEND REGRESSION PASS; load/recovery NOT RUN / NOT MEASURED |
| F05 | User/operator support and Owner candidate/production decisions | PLANNED |

**Historical evidence is source-scoped:** WEB5 unit 1,397, Chromium 275 and focused Edge 125, plus separate actual SQL wrapper and PR #95 admission, are valid as baseline only; they have not tested a new WEB6 manual resend. The UI resend flag stays **OFF** until independent B04/F02/F03 verification and explicit nonproduction Owner pilot approval. No automatic HTTP mutation retry, default production switch, SQL quarantine cleanup or full IIS/Narrator PASS.

Production decision inherited from WEB5: STAGING NOT ACCEPTED / PRODUCTION NO-GO / DEFERRED. Backend B05 implementation exists behind exact opt-ins, but its paired browser, cutover, workload and recovery selectors remain BLOCKED without accepted candidate inputs; B06/Owner targets remain outstanding. Backend CEX is independent.

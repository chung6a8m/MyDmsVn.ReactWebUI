# WEB6 frontend evidence — active implementation

**2026-11-03: NEW ROADMAP SELECTED. ALL F01–F05 IMPLEMENTATION AND WEB6 ACCEPTANCE GATES PLANNED / NOT RUN.** This index reserves evidence paths; it does not report frontend code, browser test, SQL result or production feature enablement.

[Owning roadmap](../../plans/20261103-001-web6-recovery-quality-web.md) · [manual resend state/UX design](../../design/WEB6_MANUAL_RESEND_AND_RECOVERY_UX.md) · [acceptance matrix](../../development/WEB6_WEB_ACCEPTANCE.md) · [Codex handoff](../../development/WEB6_CODEX_HANDOFF.md) · [archived WEB5](../web5/20261103-web5-roadmap-closeout.md) · [backend WEB6 evidence](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/evidence/web6/README.md).

| Task | Future proof | State |
|---|---|---|
| F01 | [Frozen source/contract and consent/retention checkpoint](20261103-f01-source-safety-policy.md) | READY FOR OWNER TECHNICAL REVIEW; feature OFF |
| F02a | [Durable receipt and one-shot IndexedDB claim](20261110-f02a-durable-claim.md) | IMPLEMENTED / LOCALLY VERIFIED; feature OFF |
| F02b | [Signed eligibility and frozen original transport](20261110-f02b-frozen-transport.md) | IMPLEMENTED / LOCALLY VERIFIED; acceptance blocked; feature OFF |
| F03 | Accessible manual action, real Chromium/Edge/SQL-bridge six-command proof | PLANNED |
| F04a/F04b | One paired published IIS Express/SQL browser candidate, old/new cutover and measured workload/service recovery | PLANNED |
| F05 | User/operator support and Owner candidate/production decisions | PLANNED |

**Historical evidence is source-scoped:** WEB5 unit 1,397, Chromium 275 and focused Edge 125, plus separate actual SQL wrapper and PR #95 admission, are valid as baseline only; they have not tested a new WEB6 manual resend. The UI resend flag stays **OFF** until independent B04/F02/F03 verification and explicit nonproduction Owner pilot approval. No automatic HTTP mutation retry, default production switch, SQL quarantine cleanup or full IIS/Narrator PASS.

Production decision inherited from WEB5: STAGING NOT ACCEPTED / PRODUCTION NO-GO / DEFERRED. Backend B03/B05/B06 outstanding now require separately scoped WEB6 implementation/evidence; backend CEX workstream is independent.

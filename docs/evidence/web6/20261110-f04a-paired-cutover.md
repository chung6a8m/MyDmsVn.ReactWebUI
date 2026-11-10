# WEB6 F04a — paired candidate and cutover implementation

**Date:** 2026-11-10 (Asia/Bangkok). **State:** IMPLEMENTED / LOCALLY VERIFIED; LIVE PAIRED CANDIDATE BLOCKED / NOT RUN. Manual same-key resend remains ordinary-build **OFF**.

## Provenance and implemented boundary

- Frontend reviewed head: `9eb7d37e8fdb7ced5871ae9eb6be00f3e6e7163d`; tree `bd6cda2d6f13912101a357ad5f243fa4082e6140`.
- Backend reviewed implementation head: `9598c75d60370bc73efaa14525deb42af3f0e8d2`. B05 Tasks 1–6 added audit admission, sealed candidate evidence, browser/cutover adapters, bounded workload and service-recovery coordinators behind explicit opt-ins.
- Candidate bootstrap accepts only a canonical build-time candidate ID. Missing/empty/invalid input remains OFF or fails the build; no URL, storage or server-response toggle exists.
- Private manifest/result/count/network evidence uses strict allowlists. Tests cover six Sales/Receipt operation kinds, same-key frozen request identity, not-observed versus COMMITTED-response-lost cuts, two-tab one-shot, revoked grant, candidate mismatch and no automatic dispatch after reload.
- Cutover input pins frontend WEB4 `ea104582a5aa4bcdf0d04999296a30a3c43e450e` and backend exact12 `a3f3db16381a38bdf0b76e8ab36cb55bec02bbd2`, separate schema12/schema13/restored ownership receipts and distinct epochs. The browser pack uses authentic COMMITTED setup proof and retains the original UNKNOWN operation/receipt boundary.

Implementation tests and static Playwright discovery are not IIS Express/SQL/browser acceptance. The backend exact selectors refuse missing candidate/publish/TLS/browser/SQL/ownership inputs with non-success and zero skip; those approved inputs were not present together. No live candidate root, IIS worker, Chromium/Edge pair or SQL business oracle ran.

## Disposition

| Gate | Observed state | Reason |
|---|---|---|
| F6-PAIR-01 matched source/artifact/schema13/six effects | BLOCKED / NOT RUN | No admitted paired SQL/IIS candidate manifest and no six-effect live result. |
| F6-PAIR-02 owned IIS Express HTTPS + Chromium/Edge | BLOCKED / NOT RUN | Exact backend selector lacked required publish/TLS/browser/candidate inputs. Static discovery is not execution. |
| F6-COMP-01 old/new cutover | BLOCKED / NOT RUN | Coordinator and strict browser pack are implemented; archive builds, three owned DB allocations and serial live host switching were not run. |
| Attended Telex/VNI, 100%/125%, Narrator | NOT RUN | No attended candidate session. Narrator remains an Owner-scoped bounded exception, never PASS. |

No candidate/pilot enablement is authorized. Full IIS is NOT RUN; staging is NOT ACCEPTED and production remains NO-GO / DEFERRED. B03 dependency waiver only allowed bounded implementation and does not convert prior B03 gaps or failed resources into PASS.

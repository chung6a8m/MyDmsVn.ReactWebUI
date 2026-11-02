# WEB4 frontend evidence — task-scoped records

**Roadmap selected:** 2026-11-01. **F01–F05 PLANNED / NOT RUN** at docs activation. That activation status is historical; task checkpoints below own subsequent implementation and verification. Roadmap/plan and design files alone are specifications, not runtime proof. [F task owner](../../plans/20261101-002-web4-reliability-web.md), [F tests](../../development/WEB4_WEB_ACCEPTANCE.md), [F Codex handoff](../../development/WEB4_CODEX_HANDOFF.md). Backend B evidence belongs in MyDmsVn repo.

For each PR after actual execution: new dated file here with exact frontend/backend SHA and backend corpus pin, commands, discovered/executed PASS/FAIL/SKIP, mock/real IndexedDB/browser/HTTPS/SQL distinction, real runner versions, actual scenario IDs, cleanup/credentials safeguards, prior failed candidates and corrected candidates, Owner disposition and clearly labelled NOT RUN items. Do not include SQL addresses or credentials, bearer/refresh tokens, HAR/trace or unredacted user drafts.

WEB1–03 evidence remains byte-for-byte unchanged and acceptance tied to its own candidate; full IIS/production and attended current candidate Telex/VNI/Narrator remain NOT RUN, not inherited. This file records no runtime acceptance.

## F01 — 01/11/2026

[WEB4-01 source/consumer checkpoint evidence](20261101-web4-01-contract.md): source/design checkpoint, published B01 pin và consumer verification; **F01 DONE (bounded contract; Owner accepted; PR #19 merged 2026-11-01)**; initial BLOCKED checkpoint được giữ như lịch sử. Tại checkpoint F01 chưa có WEB4 runtime acceptance và F02–F05 vẫn PLANNED; các checkpoint mới được ghi riêng bên dưới. [Source map và pin](../../development/WEB4_F01_SOURCE_CHECKPOINT.md).


## F02 — 02/11/2026

[Historical F02 durable draft checkpoint](20261102-f02-durable-drafts.md): 982 unit/component, 23 Chromium, 23 Edge and 1 artifact-isolation PASS. Authenticated epoch, native IndexedDB, explicit restore and awaited CAS close are implemented; F03 production mutation boundary and B05/F04 live acceptance remain separate. At this intermediate F02 checkpoint, Owner acceptance/merge was pending; F02+F03 were subsequently accepted and merged through WEB4-04 below.

## F03 / WEB4-04 — 02/11/2026

[F03 durable operation/recovery and acceptance](20261102-f03-operation-recovery.md) records immutable intent, six keyed writes, protected result recovery, strict direct rejection and safe terminal cleanup. It separates 1,218 unit/component cases, full hosted Chromium, focused native Chromium/Edge, artifact isolation and actual frontend-port/TestServer/SQL evidence, including earlier failed candidates and corrections. [Frontend PR #20](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/20) delivers the selected F02+F03 milestone with separate source commits/evidence; [backend PR #83](https://github.com/chung6a8m/MyDmsVn/pull/83) supplies the authorized B04 prerequisite. Owner accepted and both PRs merged 2026-11-02: WEB4-04/F02+F03 DONE (bounded). Same-key resend remains disabled; F04+B05 live browser and production are not accepted.

## F04 / WEB4-05 — selected 02/11/2026

[F04 failure-pilot evidence](20261102-f04-failure-pilot.md) records the VERIFIED CANDIDATE, frontend regression checks and separately owned live browser/SQL verification. Owner authorized the B05 test fixture and fresh nonproduction SQL/IIS Express runs; the [WEB4 pilot runbook](../../development/WEB4_PILOT_RUNBOOK.md) owns the execution route. Paired Chromium/Edge HTTPS/SQL verification, independent oracle and cleanup passed on separate fresh databases; Owner acceptance/merge remain pending. F05/B06 remain PLANNED; same-key resend is disabled and full IIS/production or attended candidate IME/Narrator are not approved.

# Thiết kế WEB6 F04 — Browser ghép cặp

**Trạng thái:** đề xuất để Owner duyệt. Thiết kế frontend này consume [thiết kế B05 backend](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/superpowers/specs/2026-11-10-web6-b05-paired-candidate-design.md) và chỉ sở hữu F04a/F04b. B03 waiver chỉ áp dụng cho candidate nonproduction này; không đổi B03 gap thành PASS.

## Ý định

Build React artifact gắn với một candidate rõ ràng và kiểm hành vi one-shot manual resend F02/F03 bằng Chromium/Edge thật trên đúng IIS Express/SQL pair đã admit. Build thường giữ OFF.

## Mục tiêu

- Thêm strict build-time candidate ID từ `ApplicationEntry` tới `createProductionRuntime`; thiếu, malformed, mismatch hoặc unsupported host đều disable resend.
- Chứng minh default production build không có enabled candidate; candidate build chỉ gắn với một backend manifest/ID.
- Thêm live Playwright cho sáu Sales/Receipt command, accessible consent, two-tab one-winner, reload, authority/epoch transition và no-auto-retry.
- Gắn browser result, trace và compiled asset hash với backend manifest và SQL oracle độc lập.
- Kiểm old/new cutover; chỉ consume workload/recovery observation của backend, không bịa frontend SLA.

## Ngoài phạm vi và anti-goals

- Không query-string, localStorage, UI, devtool hoặc runtime user toggle.
- Không đổi frozen WEB4/WEB5 contract, tạo ID mới, reconstruct request, auto retry hoặc suy rollback từ 404.
- Không dùng fake API làm F04 acceptance; không full IIS/Narrator PASS; không staging/production approval.
- Frontend không sở hữu SQL allocation, host admission, operator authority, physical oracle hoặc cleanup.

## Các cách đã cân nhắc

### Đã chọn: compiled candidate binding + live external Playwright pack

Build nhận một validated candidate ID, compile vào artifact và truyền cho manual-resend runtime option. Live pack nhận admitted origin và sanitized scenario handle từ backend run record, rồi dùng UI/IndexedDB thật. Quan hệ giữa asset, backend context và evidence trở nên bất biến; build thường vẫn OFF.

### Đã loại: runtime global hoặc query parameter

Switch browser-visible có thể bật UX trên host không pin, bị ship nhầm hoặc tạo unsupported state.

### Đã loại: component harness làm F04 proof

F03 harness chỉ chứng minh dialog; không chứng minh auth, network transmission count, SQL fence hoặc business effect.

## Candidate configuration

Thêm module nhỏ đọc Vite build variable cho WEB6 candidate ID, chỉ nhận `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`, trả `{ enabled: true, candidateId }` hoặc disabled. `ApplicationEntry` truyền value vào `createProductionRuntime`. Missing/invalid fail closed; không suy candidate từ host response.

Backend `/api/v3/operations/resend-context` phải trả cùng candidate ID, actor và epoch trước khi issue receipt. Decoder hiện có từ chối mismatch. Server vẫn sở hữu session/grant/epoch và SQL fence; compiled ID chỉ là candidate UX gate.

Test chứng minh:

- `npm run build` thường OFF;
- candidate build với exact ID chỉ bật đúng ID;
- empty/malformed/overlong bị OFF hoặc làm candidate artifact acceptance fail;
- old host, 404, wrong candidate và authority loss không tạo confirmation path dùng được;
- production artifact không có Lab/fixture module.

## Live browser matrix

Tạo opt-in Playwright config/spec riêng, không tự start Vite, bắt buộc admitted HTTPS base URL và sanitized candidate run record. Từ chối localhost HTTP, thiếu manifest hash, candidate mismatch hoặc thiếu explicit opt-in. Credential/connection string ở ngoài Git và không attach trace.

Với Sales Create/Update/Post và Receipt Create/Update/Post, dùng workspace thật để tạo original frozen operation, gây đúng controlled response-loss/eligibility scenario do backend fixture cung cấp, mở recovery, xem cảnh báo có thể thực thi lần đầu và confirm một lần. Assert một browser mutation transmission cho consent; backend chứng minh một physical effect và result semantics.

Cross-tab dùng hai page cùng storage partition. Cả hai có thể review; chỉ một IDB claim dispatch, loser zero HTTP mutation. Reload/crash không auto-dispatch. Double-click, Enter khi IME composition, Escape, stale dialog, revoked Write/Post, actor switch, epoch change, candidate mismatch, timeout, 401 và 5xx đều fail closed.

Chromium và Edge chạy tuần tự trên cùng compiled hash và backend source. Không ghi trace/HAR cho live authenticated pack. Chỉ lưu screenshot đã kiểm redaction và generated network summary có allowlist, không chứa token, cookie, receipt string, raw draft hoặc business payload. Raw diagnostic tạm cho failure chỉ được đặt trong protected private run root và tuân theo disposition của backend run. Telex/VNI/zoom/Narrator báo riêng; Narrator thiếu vẫn NOT RUN.

## Cutover và recovery

- WEB4 cached client với compatible new host tiếp tục v1, không có resend UI.
- Current candidate client với old exact12 host không có v3 context và giữ disabled; backend dùng exact12 DB riêng, không downgrade schema13.
- Restart cùng epoch giữ UNKNOWN protection và receipt/claim, không dispatch mutation.
- Restore/rewind rotate epoch trước admission; old client/receipt bị từ chối.
- Support conclusion COMMITTED/result unavailable vẫn protected, không tạo result/version/line ID giả.

Baseline compatibility cố định là frontend WEB4 PR #22 merge `ea104582a5aa4bcdf0d04999296a30a3c43e450e` và backend WEB4 PR #85 merge `a3f3db16381a38bdf0b76e8ab36cb55bec02bbd2`; run phải build lại và pin artifact hash từ các tree này.

## Evidence và stop rules

F04 evidence ghi SHA hai repo, `package-lock.json`, build command, file-by-file `dist` hash, browser/Playwright, exact spec, count/retry/duration, redacted artifact và link backend oracle. Giữ failed attempt.

Dừng khi compiled/server ID mismatch, mutation transmission ngoài dự kiến, duplicate effect từ oracle, dirty/unpinned source, thiếu host admission, mandatory browser row skip, trace có secret hoặc backend cleanup không chắc. Feature thường giữ OFF sau run.

## Chiến lược kiểm chứng

Dùng TDD cho candidate config và mọi browser behavior mới. Chạy focused unit/build-artifact trước live; sau đó full affected unit, typecheck, ordinary build, candidate build và Chromium/Edge live tuần tự. Mocked browser test không đủ accept F04; live result phải có paired SQL oracle.

## Quyết định để người triển khai tự chọn

- Tên Vite variable/module, miễn build-time only và strict validate.
- Sanitized run-record JSON shape phối hợp với backend, không secret/raw payload.
- Một table-driven spec hay chia theo module, miễn browser test count và scenario count tách rõ.


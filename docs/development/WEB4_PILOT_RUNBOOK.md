# WEB4-05 — pilot recovery trên HTTPS/SQL

[F04 plan](../plans/20261101-002-web4-reliability-web.md) sở hữu trạng thái; [F04 evidence](../evidence/web4/20261102-f04-failure-pilot.md) sở hữu kết quả. Backend [B05 runbook](https://github.com/chung6a8m/MyDmsVn/blob/4d3c75e3ec5c0cb2f165418137d800e5ae5c0762/docs/development/WEB4_RECOVERY_PILOT_RUNBOOK.md) được bổ sung trong cùng milestone và sở hữu allocation, schema12, host, physical oracle và cleanup. Không dùng fixture WEB2/WEB3 schema11 làm bằng chứng WEB4.

## Candidate và runner

- Build React bằng `npm.cmd ci`, `npm.cmd run typecheck`, `npm.cmd run build`; chạy full unit/component, Chromium, focused Edge và production-artifact isolation theo [test policy](../TEST_POLICY.md).
- Publish net48 host vào thư mục mới bằng script backend `Publish-Web2Host.ps1`; copy đúng `dist/` vào `wwwroot/`, đối chiếu SHA-256 của mọi asset. Không chạy Vite trong live pilot.
- Dùng binding/certificate HTTPS localhost:44321 đã trusted sẵn; không thay machine trust/binding, không `ignoreHTTPSErrors`. Backend kiểm tra thumbprint và chỉ cấp public CA PEM cho Node child.
- Mỗi invocation chọn đúng một project `chromium` hoặc `edge`, fresh owned nonproduction SQL database, restricted runtime login và host riêng. Các SQL owner chạy tuần tự; không build lại assembly khi testhost đang giữ DLL.
- Browser plugin không có trong phiên; dùng Playwright 1.64.1 đã pin. Trace/video/HAR và screenshot-on-failure tắt. Screenshot chủ động chỉ chụp UI đã đăng nhập, lưu ngoài Git.

Backend fixture duy nhất khởi chạy selector:

```powershell
dotnet test tests/MyDmsVn.Server.Infrastructure.Security.Tests/MyDmsVn.Server.Infrastructure.Security.Tests.csproj -c Release -f net48 --no-restore --no-build --filter FullyQualifiedName~Published_React_WEB4_recovery_preserves_journal_and_physical_stock --logger 'trx;LogFileName=web4-chromium.trx' --results-directory TestResults/web4-chromium
```

Biến process-local: `MYDMSVN_WEB_TEST_PUBLISH_DIRECTORY`, `MYDMSVN_WEB_TEST_TLS_THUMBPRINT`, `MYDMSVN_WEB_TEST_BROWSER_DIRECTORY`, `MYDMSVN_WEB_PILOT_PROJECT`; SQL admin dùng designated nonproduction environment theo backend policy. Không in giá trị secret hoặc đưa chúng vào repo/asset. Chạy Edge trong invocation kế tiếp với output/TRX riêng.

## Interface test-only và cách đọc bằng chứng

`playwright.pilot.config.ts` nhận private manifest từ fixture, yêu cầu origin chính xác và selector `web4-recovery`. Chỉ hai file `web4-boundaries-live.spec.ts`, `web4-recovery-live.spec.ts` chạy; selector cũ giữ nguyên. Helper Node nhận manifest version1 và trả kết quả version1; backend kiểm tra đủ 12 check IDs, sáu operation kinds, exact journal/source/Posted union và physical ledger/valuation. Số check IDs không phải số browser tests.

Named pipe chỉ tồn tại giữa test processes, có token ngẫu nhiên và allowlist `rotateEpoch`/`setWritePermission`; không có test endpoint trong product, không đưa pipe token/SQL credentials vào browser. Native IndexedDB đọc/corrupt/quota injection chỉ ở test. Import TypeScript codec để chuẩn bị request chạy trong Node; browser chỉ tải production assets.

Mất acknowledgement được tạo bằng `route.fetch({maxRetries:0})`, xác minh **HTTP200 thật**, rồi abort đường trả về. Reload không tự gửi lại; user chủ động kiểm tra status. Test concurrent same-key là hai client test có chủ đích, không bật product resend. Negative COMMITTED identity và quota là fault injection, được ghi riêng; chúng không tự chứng minh SQL commit. Network/login exceptions được đổi thành thông báo sạch trước khi Playwright ghi error-context; guard không dump toàn bộ IndexedDB khi phát hiện secret.

## Giới hạn

Pilot không giết process tại Commit; không bật same-key resend UI. Chỉ snapshot đã commit IndexedDB được đảm bảo phục hồi. Synthetic composition/keyboard không phải attended Telex/VNI/Narrator. WEB4-05 bounded Owner acceptance/merge đã được ghi trong F04 evidence. WEB4-06/F05+B06 operator handoff đã được Owner chấp nhận và archive; xem [hướng dẫn người dùng](WEB4_USER_RECOVERY_GUIDE.md). Full IIS/production vẫn NOT APPROVED. WEB4-06 acceptance/merge/archive được ghi trong F05 evidence; runbook này không cấp phép chạy lại pilot. Không cộng lượt chạy lại thành số testcase mới hoặc suy SQL PASS từ frontend fake/hosted CI.

# WEB2-10 — chạy pilot HTTPS/SQL/browser

> **Closeout 2026-11-01:** WEB2-10 đã hoàn thành trong phạm vi IIS Express HTTPS/SQL/browser được kiểm chứng; **full IIS NOT RUN** được Owner chấp nhận là ngoại lệ để đóng Roadmap 02, **không** phải bằng chứng full IIS/production. [Archive decision](../archive/20261101-web2-http-jwt-sales/README.md) và [evidence](../evidence/20261031-web2-http-jwt-sales.md#2026-11-01--owner-closeout-and-full-iis-exception) có trạng thái cuối. Runbook này còn giá trị tái lập nhưng **không tự kích hoạt** đợt kiểm thử/deploy mới.

Roadmap [WEB2](../plans/20261031-002-http-jwt-sales-vertical-slice.md) và [contract backend](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB2_HTTP_AUTH_AND_WIRE_CONTRACT.md) sở hữu các gate. Runbook này chỉ mô tả cách chạy candidate; kết quả từng lần nằm ở [evidence](../evidence/20261031-web2-http-jwt-sales.md).

## Phạm vi và điều kiện

- Windows/net48, SQL test non-production được chỉ định bằng `MYDMSVN_TEST_SQLSERVER_CONNECTION_STRING` với effective database `master`; host chạy bằng restricted web principal do fixture cấp riêng.
- IIS Express, binding có sẵn `https://localhost:44321`, certificate localhost được browser tin cậy. Không cài certificate, sửa machine IIS, rewrite Origin hoặc bỏ qua TLS trong runner.
- Node/npm và Chromium/Edge đúng phiên bản đã pin/ghi evidence. Browser plugin không có trong phiên thực thi này; dùng Playwright của repo.
- Backend candidate có test `Published_React_browser_uses_real_HTTPS_SQL_and_atomic_stock`. Test sở hữu database/login/config/process, chạy migration11 thật và dọn theo ownership token. Chạy các SQL owner tuần tự.
- Full IIS, app-pool identity/configuration, audit destination/retention, triển khai schema trên database vận hành và attended IME là các nghiệm thu riêng. IIS Express PASS không đóng Gate D full IIS.

## Chuẩn bị candidate

Ở web worktree:

```powershell
npm.cmd ci
npm.cmd run test:unit
npm.cmd run typecheck
npm.cmd run build
```

Ở backend worktree, publish host vào một thư mục mới/rỗng bằng `src/MyDmsVn.Server.HttpHost/Publish-Web2Host.ps1`. Copy nội dung `dist/` web vào `wwwroot/` của output đó. Không đưa SQL credentials, JWT signing key hoặc manifest test vào `dist/`, Git hay thư mục web được serve.

Đặt các biến cho tiến trình test, không ghi secret vào transcript:

| Biến | Nội dung |
|---|---|
| `MYDMSVN_WEB_TEST_PUBLISH_DIRECTORY` | Đường dẫn host đã publish cùng web build |
| `MYDMSVN_WEB_TEST_TLS_THUMBPRINT` | Thumbprint certificate của binding hiện có, dùng cho HTTP probe backend |
| `MYDMSVN_WEB_TEST_BROWSER_DIRECTORY` | Đường dẫn tuyệt đối web worktree có `node_modules` và pilot tests |
| `MYDMSVN_WEB_PILOT_PROJECT` | Bắt buộc `chromium` hoặc `edge`; mỗi browser chạy một fixture riêng |

Chạy từ backend:

```powershell
dotnet test tests/MyDmsVn.Server.Infrastructure.Security.Tests/MyDmsVn.Server.Infrastructure.Security.Tests.csproj -c Release -f net48 --filter FullyQualifiedName~Published_React_browser_uses_real_HTTPS_SQL_and_atomic_stock --logger 'trx;LogFileName=web2-browser.trx' --results-directory TestResults/web2-10
```

Chạy tuần tự hai lần với project `chromium` rồi `edge`, đặt tên TRX/output riêng. Mỗi lần cấp database/host mới để test độc lập và không vượt limiter login thật khi gộp hai browser vào cùng worker; không tăng hoặc tắt limiter để làm test xanh.

Fixture tạo manifest riêng tạm thời, truyền đường dẫn bằng `MYDMSVN_WEB_PILOT_MANIFEST` cho Playwright rồi xóa trong cleanup. Manifest có credentials **test-only** và catalog IDs của database vừa cấp; không tái sử dụng trên môi trường khác. Frontend config từ chối chạy nếu thiếu manifest hoặc origin sai. Không có dev-server/fake fallback, retry hay `ignoreHTTPSErrors`.

Browser dùng trust store bình thường của máy. Vì request probes của Playwright chạy bằng Node có trust store riêng, fixture kiểm tra chain của certificate đúng thumbprint đã chỉ định, export **public certificate** sang PEM tạm và truyền `NODE_EXTRA_CA_CERTS` riêng cho child process. Xóa PEM khi kết thúc; không đổi trust store/global TLS settings. Probe errors được làm sạch trước khi ghi report để tránh Playwright in Authorization/Cookie headers.

## Các boundary được kiểm tra

`tests/pilot/web2-live.spec.ts` mở build production trên HTTPS, đăng nhập qua UI và dùng API thật để chuẩn bị dữ liệu. Test Save đi qua editor/grid thật; 200 duplicate/gift lines, exact decimal, rowversion409, Write/Post không có Read được kiểm tra ở cả HTTP và UI.

Lost-response test dùng `route.fetch({maxRetries:0})` cho request đến backend thật, đợi response200 sau commit rồi `route.abort()` ở đường trả về browser. Đây là fault injection tại HTTP boundary; không giả commit và không có endpoint test trong production. UI phải giữ unknown lock, không gửi lại mutation, yêu cầu đối soát chủ động. SQL oracle backend kiểm tra chứng từ Posted, stock quantity/value, ledger và COGS sau browser run.

Auth test kiểm tra Secure/HttpOnly/Strict cookie, reload, hai tab refresh, replay/revocation, actor riêng, Origin rejection, CSP/script injection. Runner không lưu trace/video/HAR vì chúng có thể chứa token/password. Screenshot chỉ chụp vùng UI không có credentials; không commit raw test-results/TRX.

## Ghi nhận và bàn giao

Ghi cả hai SHA, build candidate, Windows/.NET/IIS Express/SQL/Node/browser versions, exact command và **số browser tests riêng với số .NET rows**. Ghi lần fail và nguyên nhân trước lần PASS; không cộng nhiều lần chạy thành một tổng. Việc archive Roadmap 02 đã được Owner chấp thuận theo ngoại lệ full IIS duy nhất (2026-11-01). Nghiệm thu full IIS, audit vận hành, attended hoặc production vẫn cần kế hoạch/đánh giá riêng; runbook không được dùng để tuyên bố chúng đã PASS.

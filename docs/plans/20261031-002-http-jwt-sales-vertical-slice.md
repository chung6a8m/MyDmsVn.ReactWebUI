# Roadmap 02 — net48 HTTP + Bearer JWT + Sales end-to-end

**Owner chọn:** 2026-10-31. **Trạng thái:** ACTIVE / WEB2-01 DONE (contract/preflight); WEB2-02–10 PLANNED. **Planning web base:** `chung6a8m/MyDmsVn.ReactWebUI@90ef55c`. **Planning server base:** `chung6a8m/MyDmsVn@5b9f960`; baseline thực thi WEB2-01 và kết quả tại [evidence](../evidence/20261031-web2-http-jwt-sales.md). **Thực thi:** task-scoped PRs ở hai repo, không xem tài liệu hoặc probe dependency là runtime HTTP PASS. Server owns [companion plan](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/plans/20261031-003-web2-http-jwt-sales-server.md) và [HTTP/auth/wire contract](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB2_HTTP_AUTH_AND_WIRE_CONTRACT.md); client owns [frontend implementation specification](../design/WEB2_FRONTEND_INTEGRATION.md) và [Codex handoff](../development/WEB2_CODEX_HANDOFF.md).

## 1. Mục tiêu đã chọn, không tự mở rộng

Đăng nhập -> Sales list/lookup thật -> mở nhiều chứng từ -> Create/Update Draft -> Post -> đọc trạng thái/cost authoritative -> thực hiện permission/conflict/network recovery trên **Windows IIS/HTTPS + SQL Server non-production**. Backend vẫn **net48**, HTTP host mỏng Web API 2; tái sử dụng Application, SQL and DbUp. Không thay đổi desktop WinForms, migrate sang ASP.NET Core, pricing/tax, thanh toán, công nợ, trả hàng.

Bearer JWT access có TTL ngắn (mặc định **10 phút**) và **client lưu localStorage** đúng lựa chọn Owner; refresh opaque GUID v4 ở **Secure+HttpOnly+SameSite=Strict host-only cookie**, hash SHA-256 ở SQL và rotate mọi lần refresh. Production pilot ưu tiên **single same-origin HTTPS**, no cross-origin credentialed CORS. LocalStorage có rủi ro trộm bearer qua XSS; CSP/script hardening, ngắn TTL và test là điều kiện bắt buộc, không được tuyên bố rủi ro được xóa bỏ.

Chọn wire DTO v1 riêng: C# `long`/`decimal` -> JSON **string**, catalog `int32` -> numeric, date-only `yyyy-MM-dd`, Post trả **ack**, error/envelope từ `ApiResponse`. Giữ Zustand document session làm source of truth, không thêm React Hook Form mirror cho Sales; Zod ở HTTP trust boundary và pure validator cho snapshot. UI giữ mặc định Tailwind v4/Nova, AG Grid Community, Dockview, Floating UI. Không Business Compact/font 14px/Enterprise.

**Deferred:** durable drafts sau reload, offline/autosave, popout, in/xuất, full Security Administration, multitenancy, HTTP operation-idempotency journal, production migration/cutover. Không lôi roadmap GUI hiện tại của backend vào WEB2.

## 2. Task board

| Task | Repo owner | Kết quả chính | Depends | Trạng thái |
|---|---|---|---|---|
| **WEB2-01** Contract/preflight | Both | ADR host/net48/ASP.NET packages, origin/cookie/storage, versioned wire+golden fixtures, schema gates | — | DONE (bounded) |
| **WEB2-02** HTTP host/actor | Server | IIS Web API 2, request-scope DI/actor, JWT verifier, status/correlation/HTTPS | 01 | PLANNED |
| **WEB2-03** Refresh persistence | Server | DbUp 011, restricted SQL role, auth sessions, GUID hash/transactional rotate/reuse | 01 | PLANNED |
| **WEB2-04** Auth endpoints | Server | Login/refresh/logout/me/capabilities, JWT signature/cookie/CSRF/rate limits | 02,03 | PLANNED |
| **WEB2-05** Sales/Catalog endpoints | Server | Lossless v1 wire, List/Get/Create/Update/Post + 4 lookups, auth/parity tests | 02,04 | PLANNED |
| **WEB2-06** Runtime split | Web | Inject Sales/Catalog/Auth/clock; remove production imports of fake runtime, retain Lab | 01 | PLANNED |
| **WEB2-07** Browser auth lifecycle | Web | localStorage access JWT, HttpOnly refresh, reauth/logout, 401, actor fencing, multi-tab | 04,06 | PLANNED |
| **WEB2-08** Wire + reads | Web | Zod schema/codec, real Catalog/List/Get/keyset, lossless ID/decimal, permission-aware UI | 05,07 | PLANNED |
| **WEB2-09** Writes/recovery | Both | Create/Update/Post ack, conflict, validation, lost response, no auto write retry | 08 | PLANNED |
| **WEB2-10** Acceptance/handoff | Both | IIS+SQL+browser candidate, negative security/stock tests, evidence and docs | 09 | PLANNED |

WEB2-02, WEB2-03 và WEB2-06 có thể phát triển song song sau 01. Server 05 phải ổn trước khi Web 08 thực sự tích hợp. **Chỉ có WEB2-10 được chuyển full roadmap sang DONE** sau khi các nghiệm thu bên dưới được ghi bằng chứng; task khởi tạo tài liệu không tương đương implementation.

## 3. Milestones / acceptance gates

### Gate A — Authenticated read (WEB2-01..08)

- Login/refresh/reload/me/capabilities chạy trên IIS HTTPS; cookie flags thực tế và Origin/CSRF đã kiểm, revoke/disable làm request kế tiếp bị từ chối; hai browser actor không lẫn danh tính.
- Catalog 4 loại với quyền Catalog độc lập; List filter customer/warehouse/employee/product/status/date/search, pageSize=25, cursor bound to filters. Product filter xét any dòng nhưng total toàn chứng từ.
- Get trả nhãn reference inactive, đơn vị tính snapshot, cost null khi Draft; 401 không render như list trống; 403 không render như 404.
- Fixture JSON `long > 2^53`, decimal biên, saleDate timezone, version/cursor opaque chứng minh không mất precision; không dùng JS Number cho int64/decimal.

### Gate B — Real Draft write (WEB2-09)

- Client save barrier chốt mọi editor/raw/lookup/IME, kiểm editRevision và tạo immutable snapshot; request map `clientLineId -> ordered line -> response positive saleLineId`, duplicate product vẫn độc lập.
- Create/Update 1–200 dòng; typed server validation; 409 rowversion giữ raw draft không mất, 400 issues map vào đúng `clientLineId` của snapshot gửi đi; quyền Write không tự có Read.
- Chỉ một mutation/session; không replay POST/PUT sau refresh, timeout hoặc mất response.

### Gate C — Post/unknown recovery (WEB2-09)

- Post chỉ khi Draft đã lưu sạch + quyền Post. Ack `{saleId,status,postedAtUtc,version}` là kết quả đã commit, **không đợi Get thành công mới công nhận**; state Posted/read-only dù Get sau đó lỗi/403, chi phí chỉ từ Get authoritative.
- HTTP response lost after Create/Update/Post => outcome-unknown (nếu request đã rời client); snapshot, session owner và lock được giữ; stale/ambiguous read không tự unlock; không auto retry mutation; Create unknown cần đối soát có chủ đích.
- Refresh mất response sau rotation thì có thể bắt người dùng login lại, không ghép với retry Write. Logout/session expiry không cho actor mới thấy raw data của actor cũ.

### Gate D — Pilot handoff (WEB2-10)

- IIS same origin HTTPS có CSP, secure headers/cookie/CSRF, XSS mitigation, revoked JWT/refresh replay/concurrency, restricted DB principal/schema 011 migration compatibility, audited sanitized logs.
- SQL-backed Sales Post atomic stock/value/COGS moving average; exact 200-line/duplicate/gift, conflict, 401/403 rights split, after-commit loss; không thay các business handlers vốn đã đạt contract.
- Evidence trên đúng commit/candidate: server+web SHA, Windows/net48/IIS/SQL/browser versions, exact commands/test counts/PASS/FAIL/SKIPPED/BLOCKED. Không gọi production release-ready dựa vào pilot.

## 4. Quy tắc Codex bắt buộc

- Trước mỗi task đọc `AGENTS.md` và `docs/TEST_POLICY.md` của **từng** repo, roadmap task, server contract và source thực tế; không copy giả định từ README vào code. Chọn một task/PR, giữ commit nhỏ, chỉ chạy focus tests theo affected boundaries, rồi ghi evidence.
- Frontend files đầu vào: `src/app/workspace/panelRegistry.ts`, `src/features/sales/SalesHeaderForm.tsx` và `SalesLinesGrid.tsx`, `src/features/sales/salesCommands.ts`, `src/ports/{salesPort,catalogPort}.ts`, `src/shared/grid/editorBarrier.ts`, `src/app/providers.tsx`, `src/lab`; không triển khai thêm form state thứ hai.
- Backend files đầu vào: `Server.Application/Identity`, `Server.Infrastructure/Identity`, `Server.DbMigrator/Scripts`, `Server.Application/Sales`, `MyDmsVn.Contracts/SalesContracts.cs`, `ApiJson`, `deployment/sql/Provision-MyDmsVnPrincipals.sql`. Không đăng ký `LocalDesktopSession` trong HTTP host; không cấp quyền admin SQL.
- Mỗi thay đổi behavior: RED regression -> sửa -> GREEN -> typecheck/build/component/browser focused hoặc Windows SQL real integration theo task. Tests không thể chạy do môi trường thiếu thì ghi **BLOCKED/NOT RUN**, không tự nhận PASS từ việc build.
- Không tạo CORS wildcard, lưu refresh trong JS, tự gửi lại mutation, thay đổi framework target, thay schema lịch sử, thêm permissions/grants khác nội dung task. Dùng Zod để validate HTTP; backend auth giữ immutable request actor và Application authorization.
- Truy vết vào [evidence WEB2](../evidence/20261031-web2-http-jwt-sales.md) và source-specific evidence backend, cập nhật state bảng task trong cùng PR. WEB-01..08 fake evidence giữ nguyên, khi kết thúc archive WEB2 theo policy, không xóa spec hiện hành.

## 5. Sources

[HTTP handoff](../development/HTTP_INTEGRATION_HANDOFF.md), [Foundation](../design/WEB_UI_FOUNDATION.md), [Workspace behavior](../design/WORKSPACE_BEHAVIOR.md), [Sales Pilot](../design/SALES_PILOT.md), [Web Test Policy](../TEST_POLICY.md), [backend HTTP contract](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB2_HTTP_AUTH_AND_WIRE_CONTRACT.md), [RFC 9700 `4.14](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14), [OWASP Storage Warning](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#the-localstorage-api).

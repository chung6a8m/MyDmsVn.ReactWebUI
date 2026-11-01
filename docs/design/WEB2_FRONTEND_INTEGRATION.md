# WEB2 — Thiết kế tích hợp React runtime/auth/HTTP với Sales

**Ngày:** 2026-10-31. **Trạng thái hiện hành (Owner 2026-11-01):** WEB2-01–09 DONE (bounded), WEB2-10 DONE trong phạm vi IIS Express HTTPS + SQL thật + Chromium/Edge; **full IIS NOT RUN / OWNER_ACCEPTED_EXCEPTION**. [Archive closeout](../archive/20261101-web2-http-jwt-sales/README.md) sở hữu kết luận, không xác nhận production. Hợp đồng backend là [WEB2 HTTP/Auth/Wire](https://github.com/chung6a8m/MyDmsVn/blob/main/docs/design/WEB2_HTTP_AUTH_AND_WIRE_CONTRACT.md); frontend roadmap [WEB2](../plans/20261031-002-http-jwt-sales-vertical-slice.md). Đọc với [Foundation](WEB_UI_FOUNDATION.md), [Workspace](WORKSPACE_BEHAVIOR.md), [Editing](LOOKUP_AND_GRID_EDITING.md), [Sales Pilot](SALES_PILOT.md), [HTTP handoff](../development/HTTP_INTEGRATION_HANDOFF.md).

## 1. Invariants; không làm lại WEB-01–08

- `documentSessionId`, raw/lookup buffers, draft, dirty, editRevision, mutation/recovery và editor barrier thuộc **Zustand external session store**, không thuộc React component lifecycle, Query cache hoặc React Hook Form. AG Grid row identity luôn `clientLineId`, Product có thể lặp.
- Dockview layout/mount/unmount không phải close; close-all/reset/restore đi qua admission chung. Pending và outcome-unknown không bị Discard bởi code.
- Không lấy HTTP response, query cache, token refresh hoặc account switch áp lên session khác; mọi async capture `sessionId + generation + actorKey + actorGeneration + request/recoveryRevision` trước khi gửi; check khi về.
- Giữ Nova/Base UI mặc định, AG Grid Community, Dockview, Floating UI; không tạo UI framework riêng, Business Compact/WinForms hoặc font size mặc định 14px.
- Domain rules/decimal parser trong `src/features/sales` tiếp tục pure; Zod chỉ ở **external trust boundary** để parse HTTP/unknown data. Không tạo RHF state mirror hoặc chuyển Sales header sang form-local owner. Login form riêng có thể dùng RHF/Zod.

## 2. Runtime composition và fake isolation — WEB2-06

Runtime đã triển khai tại [runtimeDependencies.ts](../../src/app/runtime/runtimeDependencies.ts) và [panelRegistry.ts](../../src/app/workspace/panelRegistry.ts):

~~~ts
interface RuntimeDependencies {
  sales: SalesPort;
  catalog: CatalogPort;
  auth: AuthSessionReader;
  today: () => string; // yyyy-MM-dd from configured business calendar
  storage: LayoutStorage | null;
}
function createWorkspaceRuntime(deps: RuntimeDependencies): WorkspaceRuntime;
~~~

- `AuthSessionReader.getSnapshot()` cung cấp actorKey, actorGeneration và ba capability Read/Write/Post; `subscribe()` trả cleanup. Capability chỉ áp dụng khi actor và generation khớp; khác scope thì deny UI, không đổi owner/draft/raw/unknown. Đây là UI hint, backend vẫn quyết định quyền. Auth lifecycle/response fencing đầy đủ thuộc WEB2-07/09.
- `WorkspaceProvider` nhận runtime đã tạo; `connectAuth()` quản lý subscription có refcount qua StrictMode/remount. Cleanup/dispose chỉ ngắt observer, không đóng phiên. `today()` được gọi cho từng chứng từ mới; runtime không có ngày hoặc actor fixture mặc định. `storage: null` tắt persistence, không tự fallback localStorage.
- Sales header/grid dùng `workspace.catalog`; danh sách/commands dùng injected Sales. Zustand session store và editor barrier giữ ownership; không thêm RHF mirror. Workspace/document nhận optional toolbar/lookup harness qua context để Lab dùng đúng production components, không kéo fake vào feature.
- Fake composition chỉ ở `src/lab/runtime/`. Lab có QueryClient riêng, retry query/mutation đều false; giữ runtime trong page lifetime để route/Dockview remount không làm mất raw/dirty/unknown. Khi Lab unmount, cảnh báo beforeunload vẫn bảo vệ các phiên còn sống; không persist draft. Foundation catalog demo đã chuyển vào `src/lab/FoundationWorkspace.tsx`.
- `/lab/sales` và `/lab/components` chỉ đăng ký qua dynamic import khi `import.meta.env.DEV`; production build loại cả module graph Lab/fake. Vite build guard từ chối artifact còn bất kỳ module `src/lab` hoặc `src/infrastructure/fake`. Không có opt-in production mock actor.
- `/` dùng protected login/token bootstrap và HTTP composition trong `src/app/runtime/`. Workspace theo actor generation được giữ riêng trong bộ nhớ qua remount; forced expiry ẩn phiên cũ và xóa cache, không gắn lại vào login mới. WEB2-06 vẫn chỉ là evidence runtime injection lịch sử.
- WEB2-07 tiếp tục partition/invalidate query cache theo authenticated actor/session generation khi logout; WEB2-08 nối catalog với quyền độc lập và reference labels từ Get. Scope key hiện hữu không thay các gate này.

## 3. Auth session model — WEB2-07

**Owner storage decision:** access JWT ngắn trong `localStorage`, refresh GUID chỉ ở cookie `__Host-mydmsvn-rt` `HttpOnly Secure SameSite=Strict Path=/` và server lưu hash; frontend **không đọc** refresh token, không lưu nó vào JS memory/localStorage, không ghi cookie bằng JS.

State machine suggested:

~~~text
BOOTSTRAPPING -> AUTHENTICATED -> REFRESHING -> AUTHENTICATED
        |                |                 |
        v                v                 v
UNAUTHENTICATED     REAUTH_REQUIRED <--- REFRESH_FAILED
        ^                |
        +-- LOGOUT <-----+ 
~~~

- `bootstrap`: read access JWT raw from designated `localStorage` key; if missing/expired/near expiry call `POST /api/v1/auth/refresh` with `credentials:'same-origin'` + `X-Requested-With: XMLHttpRequest`; browser supplies `Origin` (application JS does not set it). Server requires the exact configured origin. Apply the same guard to login/logout; then `GET /auth/me` to obtain authoritative actor. Local decoded JWT claims are **hints only**, not authority/capabilities.
- `login`: POST credentials (HTTPS, no-store, generic errors), response `{data:{accessToken,expiresAtUtc,user}}`; browser receives refresh HttpOnly cookie. Update localStorage **only with access JWT**; set actor identity + generation from server-authenticated user/session, not user-controlled input.
- `authorization`: Sales and Catalog fetches use `Authorization: Bearer <JWT>` and `credentials:'omit'` to avoid carrying refresh cookie on business calls; user-facing API failure distinguishes 401/403/409/5xx. Never log JWT/password/cookie.
- `refresh`: single-flight within tab; cross-tab coordinate with Web Locks (`navigator.locks`) + BroadcastChannel event/epoch (never broadcast raw refresh token) and recheck localStorage under lock. Browser without reliable coordination: fail closed, prompt re-login on reuse instead of attempting server grace; client must not use localStorage as atomic mutex. Successful refresh **same session** keeps generation; failed refresh/session revoked increments generation.
- `logout` (voluntary): first request app close admission; Cancel leaves auth intact, pending/unknown cannot be silently discarded. After admission POST logout using cookie + CSRF header, clear access `localStorage` and query cache, fence responses, detach protected sessions; no remote revoke request before allowed close if user selected Cancel. On forced expiry/revocation: immediately block protected actions/rendering, retain private in-RAM recovery context tied to old actor where appropriate, never show to different actor or save in persistent storage.
- `same user reauthentication` creates new server session/`sid` and **new generation**. Do not attach old unknown snapshot to fresh session without explicit reviewed same-owner recovery policy; new actor must never inherit documents from previous actor.
- Token access may be stolen by XSS because `localStorage` readable from same-origin JavaScript (OWASP warning). Required: CSP no `unsafe-inline` JS in prod, no untrusted `dangerouslySetInnerHTML`, no third-party same-origin scripts, restrictive Connect/Frame/object policy, strict dependency/HTML injection tests, HTTPS and HSTS; do not claim BFF-equivalent protection. Do not put JWT in URLs or screenshots.
- Access token TTL default 10min; refresh idle 7d/max30d managed server. Proactive refresh close to expiry, never schedule global repeated refresh blindly; cancel when unmounted/logout; no refresh storms.

Browser header boundary: [`Origin` là forbidden request header](https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_request_header); [`Set-Cookie` không được expose cho frontend JS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie). Test client phải quan sát qua browser/server harness, không dùng code ứng dụng tự đặt Origin hoặc đọc refresh cookie để chứng minh flow.

### 3.1 401 versus write outcome

- Safe `GET/HEAD` with 401: refresh once then retry once **only if actor generation unchanged**; no retry loops. Permission `403` is not token expiry and never triggers refresh.
- `POST/PUT`: preflight token expiry before sending; once **request dispatched**, 401/timeout/abort/network loss **must not** blindly retry. Clear authentication state or require reauth, but keep mutation snapshot. If rejection is conclusively pre-admission/known 401 by server, UI may show known failure only if transport protocol proved no business side effects; otherwise outcome-unknown -> explicit recovery.
- Slow auth response for old generation cannot overwrite new bearer/localStorage or authorize old mutation. Pending/unknown sessions keep original actor key; switching to another account never mounts them as new user's documents.

## 4. HTTP adapter + exact wire codec — WEB2-08

WEB2-01 chốt [wire v1 field tables và golden corpus](https://github.com/chung6a8m/MyDmsVn/tree/350358ae9f8519efd54d46d61b80d3b7887c1dcd/docs/contracts/web2-v1) tại backend; revision và kết quả preflight nằm trong [evidence](../evidence/20261031-web2-http-jwt-sales.md). Đây là input cho Zod/mapper ở WEB2-08, chưa phải codec HTTP đã triển khai. Không sao chép fixture rồi tự sửa riêng trong web repo.

Structure suggestion:

~~~text
src/infrastructure/http/
  httpTransport.ts        # status/body/error/no-store/fetch
  authApi.ts              # login/refresh/logout/me/capabilities
  salesHttpPort.ts        # list/get/save/post -> feature port
  catalogHttpPort.ts      # 4 lookup kinds
  salesWireSchemas.ts     # Zod unknown -> trusted WireDTO v1
  salesWireMapper.ts      # Wire DTO -> SalesDocument and back
~~~

- **Browser parse:** use `response.text()` then `JSON.parse` -> Zod against explicitly **string** `long`/decimal schemas; reject numeric tokens for fields that must be strings instead of `String(number)` (number may already lose precision). For any backend breaking change, fail contract with correlation; do not silently coerce.
- C# `long` positive decimal string; `saleLineId` new row serialized literal `"0"`; `int32` catalog numeric checked range, internal `ServerId` string; `decimal` canonical string without exponent, no `Number/parseFloat` arithmetic, preserve precision of cost/postedUnitCost. `saleDate` invariant yyyy-MM-dd; `postedAtUtc` trusted UTC; `version` and cursor opaque.
- Request Save maps header, ordered lines **only**; exclude clientLineId/actorKey/unit/lineAmount/cost/status. Capture [index -> clientLineId] at immutable sent snapshot and align full response by server line IDs/order/cardinality; reject mismatch, don't reconcile by ProductId.
- Get detail maps header reference ID/DisplayName/IsActive, product Unit snapshot, unavailable inactive labels; does not rely on limited active lookup result. null/omitted cost normalized to null for Draft; Posted cost/profit only server authoritative.
- List query sends explicit pageSize=25; product filter uses server any-line query and page totals remain whole-receipt. Reset cursor when any filter changes; catalog lookup limit bounded and stale request results don't overwrite newer query/selection.
- Errors `ApiResponse<T>`: HTTP status is authority; `error.code/message/details/correlationId`. Map server `lines[index].field` onto exact sent `clientLineId`; preserve missing-field error in global feedback. 401 auth, 403 forbidden, 409 concurrency/already posted, 5xx unavailable; JSON unexpected is **protocol error**, not success.

## 5. Sales writes / ack / recovery — WEB2-09

WEB2-09 đã đổi `SalesPort.post` thành `WriteResult<PostAcknowledgement>` và cập nhật fake port/tests. `SalesSession.postAcknowledgement` tách khỏi baseline Get; `SaveOutcome` có nhánh `posted`. Không dựng full detail giả từ ack.

Recommended state transition:

~~~text
Draft saved + clean --Post pending--> Post ack confirmed (Posted/read-only)
                          |                         |
                          | outcome unknown         +-- GET succeeds -> full Posted detail/cost
                          v                         +-- GET 403/error -> Posted confirmed,
                 recovery locked                       details unavailable
                          |
                          +-- explicit matching read/owner proof -> recovery outcome
~~~

- Post ack is proof of committed Post, even if next Get fails/403; show status/version/postedAtUtc and read-only immediately. Do not convert ack into failed Post or permit Post again; do not invent COGS before Get.
- Create/Update success returns authoritative full document (server built before commit). Maintain old `clientLineId` and UI session when response assigns server SaleId and SaleLineIds, with ordered sent snapshot matching. No de-dup Product rows.
- Unknown Create after timeout cannot use list result alone as unique request proof (server lacks idempotency key). Keep original snapshot privately; explicit candidate selection/read and confirmation. If tab refresh loses in-memory snapshot, **warn there is no durable recovery** and prohibit automatic replay.
- For Update/Post unknown, stale Get/ambiguous same-version response isn't evidence commit succeeded/failed; preserve lock. Never discard on close/reset, never blindly replay; explicit recovery UI and signed-in original actor only.
- If app receives 401 after write sent, freeze auth and mutation separately. Reauth with same user/new server session does not auto-unlock old recovery; any reconciliation follows explicit reviewed authority check and audit. Foreground error feedback stays in proper tab.
- Keep `editorBarrier.prepareSave` as source for Save snapshot; not form-local RHF submit; validate again after all editor flush and revision guard. Dirty includes uncommitted raw lookup/decimal/IME.

## 6. Browser tests, security and handoff

Add focused tests before production integration:
- `WEB2-A01` login/refresh cookie not read by JS; access stored only in localStorage; auth errors no password/token logs.
- `WEB2-A02` short token expiry, revoked sid, wrong user, 401 vs 403; old response fenced across logout/re-login same username.
- `WEB2-A03` two tabs refreshing concurrently; one browser refresh fail/replay => require login, no duplicate auto-write.
- `WEB2-R01` list/cursor/filter; API 400/401/403/409/500, reference labels inactive; catalog permissions separate.
- `WEB2-R02` int64 9007199254740993/long max, decimal qty/price max, omitted/null cost, DateOnly, 200 rows, duplicate Products.
- `WEB2-W01` save final edited char after AG Grid stopEditing; update version conflict keeps buffers.
- `WEB2-W02` Post ack -> Get succeeds/403/5xx; no cost until authoritative Get, no accidental Post replay.
- `WEB2-W03` commit-then-response-lost after Create/Update/Post, stale read and unknown lock, no automatic retry; logout/expiry actor isolation.
- `WEB2-X01` IIS HTTPS same-origin, CSP no JS unsafe-inline, cookie flags, CSRF guard/cross-origin failure; two-user SQL-backed real Post and stock checks.

Deterministic HTTP failures dùng injected fetch và Playwright route harness đã triển khai ở WEB2-07–09, cùng Vitest/Testing Library; không thêm MSW vào dependency pins. WEB2-10 dùng [pilot HTTPS/SQL/browser](../development/WEB2_PILOT_RUNBOOK.md) riêng với backend thật; các kiểm tra harness không thay thế pilot. Record commands/counts in [WEB2 evidence](../evidence/20261031-web2-http-jwt-sales.md). Any browser or SQL checks not run are BLOCKED/NOT RUN. Source references in [roadmap](../plans/20261031-002-http-jwt-sales-vertical-slice.md) and backend contract govern conflicts.

## 7. Suggested source modifications after contract gate

| Source | Intended change | Not allowed |
|---|---|---|
| `src/app/workspace/panelRegistry.ts` | Inject ports/capabilities/today/auth context; no fake factory | Rewrite close/lifecycle as RHF state |
| `src/features/sales/SalesHeaderForm.tsx` + `SalesLinesGrid.tsx` | Use injected Catalog port and field adapters | Hidden fake imports, external component copies |
| `src/features/sales/salesCommands.ts` | PostAck state, status/recovery and error mapping, no writes replay | Treat Get failure as Post failure |
| `src/features/sales/salesSessionStore.ts` | Actor fence, Posted ack lightweight persisted state in RAM | Store tokens/raw drafts in localStorage |
| `src/ports/salesPort.ts` | Explicit post ack return shape | Cast backend ack into full SalesDocument |
| `src/app/providers.tsx`/`router.tsx` | Auth bootstrap, protected routes, Lab runtime isolation | Production mock actor bypass |
| `src/lab/*` | Keep scenarios in fake-only composition | Remove fake regression harness |

## 8. Chạy frontend HTTP và giới hạn môi trường

Production composition gọi relative `/api/v1/...` trên cùng origin. Build bằng `npm.cmd run build`, đưa **nội dung** `dist/` vào `wwwroot/` của HTTP host đã publish, rồi truy cập HTTPS `PublicOrigin` đã cấu hình và có certificate được browser tin cậy. Backend sở hữu [host runbook](https://github.com/chung6a8m/MyDmsVn/blob/main/src/MyDmsVn.Server.HttpHost/README.md), signing/session/SQL và security headers. Không lưu credentials hoặc signing key trong Vite environment/artifact.

Host phải chuyển cả asset requests vào managed pipeline để `SpaAssets` phục vụ file trong `wwwroot`; kiểm tra JS/CSS/font200 và MIME thực tế, không chỉ index/health. Mỗi HTML response có CSPRNG style nonce mới trong CSP và `<meta name="mydmsvn-style-nonce">`. `getStyleNonce` truyền giá trị đó vào `styleNonce` của cả hai AG Grid và nonce provider của Dockview; dev/static preview không có nonce. Script CSP vẫn chỉ cho `'self'`, không `unsafe-inline`/`unsafe-eval`. Auth/wire schemas import `cspZod` để bật `jitless` **trước khi tạo schema**, tránh cả eval capability probe của Zod. Không pin nonce trong bundle, không đổi preset/theme để né CSP.

`npm.cmd run dev` phục vụ UI/Lab, chưa cấu hình API proxy hoặc TLS; nó không tự khởi động .NET/SQL. Không rewrite Origin hoặc tắt kiểm tra certificate để lách transport guard của host. Kiểm chứng browser bằng HTTP route harness chỉ chứng minh frontend request/state/rendering; cookie flags, CSRF enforcement, CSP, real SQL và full IIS vẫn cần candidate HTTPS ở WEB2-10.

Test fixtures trong `tests/fixtures/web2-v1/` là mirror bất biến của backend corpus tại revision ghi trong `provenance.json`, chỉ chuẩn hóa LF. Không chỉnh ví dụ độc lập: khi contract đổi, cập nhật từ revision backend xác định; negative/fault tests dùng bản clone trong bộ nhớ. Backend tiếp tục sở hữu field tables/corpus, frontend không tạo spec wire thứ hai.

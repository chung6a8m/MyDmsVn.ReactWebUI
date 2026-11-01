# WEB3-04 — Goods Receipt Web: implementation and verification

**Ngày:** 2026-11-01 (Asia/Bangkok). **Phạm vi Owner chọn:** WEB3-04 gồm F03 ports/codec và F04 Receipt UI/session/mutation; cho phép subagents. Owner sau đó cho phép mở rộng fixture backend để nghiệm thu Receipt thật trên SQL dùng riêng, IIS Express HTTPS, Chromium và Edge. Trạng thái task thuộc [active plan](../../plans/20261101-001-web3-goods-receipt-inventory-web.md); tài liệu này không tự chấp thuận merge hoặc production.

**Trạng thái ghi nhận hiện tại:** implementation và các gate tự động/live của WEB3-04 đã hoàn tất, review độc lập không còn finding. Owner đã chấp thuận ngày 2026-11-01: F03/F04 **DONE (bounded)**, dùng evidence đã kiểm chứng để merge PR frontend #15 và backend #77 dù chưa có CI. Các dòng NOT RUN bên dưới không được hiểu là PASS; F05 Inventory UI và F06 integrated acceptance không được đóng bởi checkpoint này.

## 1. Source và môi trường

| Thành phần | Candidate / phiên bản |
|---|---|
| Web baseline | `c2a7e4f` — main sau PR #14 |
| Web branch | `codex/web3-04-goods-receipt`, worktree riêng |
| F03 runtime/test checkpoint | `bf2aea7db1efb3e39402d6632e26dbdbbd3234ed` |
| F04 state/command checkpoint | `07197e988e12634d7bced8ec9968c1239f5f8fc3`, review fix `f9920100e1d3969708c3978137849c84f8542fb7` |
| F04 UI/composition | `7c62d1c38133fdc217df417391dbb3abe7f927e1`, review fix `66764fb1687519ea502dcc9c4e3a2e4ecb99fc67` |
| Web production build / live pilot candidate | Runtime/build `66764fb1687519ea502dcc9c4e3a2e4ecb99fc67`; pilot tests/config `684cc633996561e8ed76d1bd8dceccb55733ad71`, logout synchronization fix `3fbbe60bb0896d344f3e0a7d4ac0b8d0e3b1d516` (test-only) |
| Backend prerequisite main | `6e960787a9cd5a656a3a5cab0fe0bf0194a0f24c`, đã chứa B02/B03 runtime `d2e7e3f3709a7e97cf91c7d4558c560303fa498d` |
| Backend fixture candidate | `ed532fccb267cb5e543bd6b19bbf016265b255e1` (timeout fix after `b0f48bec19edbffda1e147e1e45bd260bab07aa7`), branch `codex/web3-04-receipt-pilot` |
| Node / npm | 22.14.0 / 11.6.0 |
| Playwright / Vitest | 1.64.1 / 5.0.5 |
| Chromium / Edge | 156.0.8078.4 / 156.0.4314.58 |
| Windows | NT 10.0.26300.0 |
| Backend tooling / IIS Express | .NET SDK 8.0.427 / IIS Express 10.0.26013.1000; runtime vẫn net48 |
| SQL engine | 14.0.2140.2 RTM, Developer Edition (64-bit), EngineEdition 3; cùng designated test input |

Dependency pins/lockfile, Nova/Base UI mặc định, AG Grid Community và cơ chế JWT/refresh được giữ. Browser plugin không có trong phiên; dùng Playwright có sẵn của repo. Đọc version và launch browser trắng chỉ là chuẩn bị môi trường, không phải kiểm chứng ứng dụng.

## 2. F03 — strict ports/codec checkpoint

Commit `bf2aea7` thêm Receipt/Inventory contracts và ports riêng, neutral port result/context/error types, codec theo corpus B01 đã pin. Sales tiếp tục export các type cũ. Reader nghiêm ngặt được opt-in qua `HttpRequestInit.strictResponse`; transport bỏ option này trước fetch. Sales/auth giữ parsing hiện hành.

- Giữ int64/decimal/totalCount/UTC fractional precision dưới dạng chuỗi; explicit nulls, rowversion tám byte, giới hạn riêng cho quantity/cost/value/average. Không làm tròn input hoặc suy stock từ browser.
- Chụp Save snapshot theo thứ tự trước await; chỉ gửi header và `productId,quantity,unitCost`, Update thêm `expectedVersion`. Xác minh identity/Draft/cardinality/lineNumber/Product trước gắn lại clientLineId; chấp nhận server line IDs mới sau Update.
- Post acknowledgement chỉ có `receiptId,status,postedAtUtc`, không có version. Response malformed/mismatch, timeout/abort hoặc 401 sau dispatch giữ outcome-unknown; không replay.
- Strict response reader chặn duplicate decoded JSON keys, UTF-8/escapes/surrogates sai và envelope thừa. Typed outbound queries được validate rồi serialize bằng URLSearchParams. Raw malformed inbound-query vectors thuộc backend; không thêm parser production chỉ để chạy những vector đó. Corpus mirror/provenance không thay đổi.

| Lệnh thực chạy | Kết quả tại checkpoint F03 |
|---|---|
| `npm.cmd ci` | PASS; cài theo lockfile |
| `npm.cmd run test:unit` trên baseline | 33 files / **418 PASS** |
| `npm.cmd run test:unit -- tests/unit/http/web3HttpPorts.test.ts tests/unit/http/web3WireSchemas.test.ts tests/unit/http/web3StrictResponse.test.ts tests/unit/http/wireReads.test.ts tests/unit/http/wireWrites.test.ts tests/unit/http/wireRuntime.test.ts tests/unit/http/auth.test.ts tests/unit/http/web3ContractCheckpoint.test.ts` | 8 files / **391 PASS** |
| `npm.cmd run test:unit` sau F03 | 36 files / **656 PASS**; 238 mới, không cộng với lượt baseline |
| `npm.cmd run typecheck` | PASS |
| `git diff --cached --check` | PASS |

238 test mới gồm 180 schema/corpus, 51 transport và 7 strict-response cases. Unit/controlled-fetch không thay thế HTTP/SQL/browser thật.

**RED→GREEN:** strict reader cũ 6 FAIL/1 PASS → 7 PASS. Scalar refinement phát hiện BigInt trên `1e3`/`1.0`; sửa guard trước conversion. Test Get `GRinvalid` ban đầu trả unavailable thay vì protocol; sửa grammar guard. Các lỗi fixture test nội bộ (ID numeric chưa chuyển sang internal string và expected ledger ID sai) được sửa theo corpus, không nới codec. Reviewer độc lập duyệt spec/quality F03, không còn finding tại checkpoint.

## 3. F04 và browser frontend

Receipt state/commands/close adapter được triển khai riêng. App-owned `ProductionWorkspace` ghép Sales và Receipt qua registry/admission F02; không đưa Receipt vào Sales store/validator. List có filter Kho/trạng thái/search, paging 1/25 và totalCount nguyên chuỗi. Header/grid dùng ProductLookup/Floating UI và AG Grid Community thật; giữ clientLineId qua replacement Update, raw editor/dirty qua switch/split/close và 1–200 sản phẩm duy nhất.

- Raw decimal/lookup/IME thuộc Receipt session; duplicate Product bị chặn tại dòng tương ứng, 1–200 dòng; clientLineId không phụ thuộc Product hoặc server line ID. Save barrier giữ raw qua known failure và kiểm tra revision; Post barrier độc lập với Write và không tự Save.
- Pending/unknown giữ snapshot, chặn edit/close/discard; lỗi biết rõ giữ draft và cho review/confirm reload tường minh. Recovery kiểm tra positive evidence, read round, identity/generation/revision và bind trùng; không replay.
- Post ack không có version được ghi nhận trước Get; Get403/5xx hoặc stale Draft không đảo Posted. Label local chỉ bổ sung khi response label null, không sửa reference authoritative.
- Exact `previewLineAmount` dùng BigInt round4; không lấy overflow của preview làm điều kiện chặn Save hợp lệ. Backend Post sở hữu giới hạn valuation. Sales decimal/business rules không đổi.
- Feature adapter dùng F02 registry/admission, actor/module-scoped identity; đọc trễ không ghi vào revision mới hoặc cùng session ID được tạo lại. Auth subscription và disposal không phụ thuộc Dockview remove/add.

Verification tại `07197e9`: `npm.cmd run test:unit` **40 files / 720 PASS** (64 mới); typecheck và diff/encoding checks PASS. Test bắt được raw bị mất sau409, Post bỏ qua editor flush, revoked permission trong preparation, stale recovery, version thừa trong ack và các read-generation/dispose races; các ca được sửa trước checkpoint.

Reviewer phát hiện thêm đường reload cho Receipt đã được mở/recovered ở trạng thái Posted nhưng không có ack: stale Draft có thể làm baseline quay lại Draft. Fix `f992010` bảo vệ cả reload eligibility và điểm accept theo `baseline.status === Posted` hoặc ack. Lệnh `npm.cmd run test:unit -- tests/unit/goodsReceipt/commands.test.ts tests/unit/goodsReceipt/workspace.test.ts`: **RED 3 FAIL/41 PASS → GREEN 44 PASS**, typecheck PASS. Ba regression chứng minh initial Posted, recovered Posted và accept guard độc lập; scoped re-review không còn finding. Không cộng ba test này vào lượt full720 đã chạy trước fix.

Capability loader đọc lại sau authoritative adoption kể cả cùng token; chờ lượt đầu trước restore layout, giữ host/session khi refresh. Live component aliases encode về tên canonical F02; không đổi schema layout. Toolbar Receipt Read/Write/Post độc lập, giữ hành vi Lab và Sales. Preview/recovery cần xác nhận tường minh; không replay.

| Lệnh thực chạy | Kết quả |
|---|---|
| `npm.cmd run test:e2e -- tests/e2e/web2-http.spec.ts tests/e2e/sales-editing.spec.ts tests/e2e/lookup-grid.spec.ts tests/e2e/web3-workspace.spec.ts tests/e2e/layout-restore.spec.ts tests/e2e/sales-flow.spec.ts tests/e2e/sales-list-layout.spec.ts --workers=2` | **73/73 Chromium PASS** |
| `npm.cmd run test:e2e -- --workers=2` | **119/119 Chromium PASS**, trước sửa fallback tên header một expression |
| `npm.cmd run test:unit` trên source UI cuối | **42 files / 729 PASS** |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run test:e2e -- tests/e2e/web3-receipt.spec.ts --workers=2` sau fallback | **14/14 Chromium PASS** |
| `npm.cmd run test:e2e -- --config=playwright.edge.config.ts tests/e2e/web3-receipt.spec.ts tests/e2e/web3-workspace.spec.ts --workers=2` | **17/17 Edge PASS** (14 Receipt + 3 Workspace) |
| `npm.cmd run build` tại `684cc63` | PASS; JS 2,268.82 kB / gzip 642.16 kB, Vite cảnh báo chunk >500 kB; chưa tối ưu/đo performance |
| `npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1` | **1/1 PASS**, artifact không có fake workspace/actor/Lab routes |

Các lượt browser frontend dùng canonical controlled HTTP tại localhost Vite, không phải SQL thật. 14 ca Receipt bao phủ keyboard/caret/arrows/Enter/Tab/Escape và Quantity focus chưa mở editor; invalid raw và close focus; unique Product/200 dòng; Create/Update/Post và ack/Get403; unknown Create/Update/Post; explicit409 review; filter/page reset; hai Receipt cạnh Sales; pending close/reset; persisted restore và cùng-token refresh với Post-only. Quan sát pageerror/console không có lỗi liên quan; lọc riêng failed-resource đã chủ đích. Tooling có cảnh báo NO_COLOR/FORCE_COLOR.

**Lỗi trước sửa:** capability loader 3 FAIL → 3 PASS; missing-UI browser RED sau login (sửa harness refresh trước khi tái hiện đúng); lượt UI đầu **3 PASS/7 FAIL trên 10 ca**, sửa scope locator/options/details và nhãn region Dockview trùng. Layout alias regression **1 FAIL/33 PASS → GREEN**. Header ID có label null bị trống: **1 FAIL/1 PASS → GREEN** với fallback `ID n`, không tạo tên/activity giả. 119 ca đầy đủ chạy trước fallback cuối; chỉ các boundary bị ảnh hưởng được chạy lại Chromium/Edge sau sửa.

Đã xem ảnh Light 1280×720 (cả popup Product), Light Posted 1440×900 và Dark split Sales/Receipt 1440×900; action/field đọc được, popup trong viewport, narrow grid dùng horizontal overflow hiện hữu. Ảnh lưu local ngoài repo tại `C:/Users/pdchung/.codex/visualizations/2026/11/01/web3-04-receipt-ui/`. Automated browser không phải attended Telex/VNI/Narrator. Giữ toàn bộ Web tree ổn định trong mỗi Vite run; chỉ cập nhật source/report sau khi runner/server đã dừng.

Review độc lập pilot/config tại `684cc63`: APPROVE, không finding P1/P2/P3. UI review không có P1/P2; hai P3 đã sửa ở `66764fb`: gắn lỗi vào numeric/date/note/lookup bằng error ID ổn định theo session/field/clientLineId và `aria-invalid`/`aria-describedby`; tạo một token cố định mỗi harness, assert login/refresh có cùng bytes. ProductLookup chỉ thêm props ARIA tùy chọn, giữ mô tả lỗi local hiện hữu. Scoped re-review: cả hai ADDRESSED, không finding mới. Whole-branch review `c2a7e4f..66764fb`: **APPROVE implementation, không còn P1/P2/P3**; reviewer không chạy lại suite hoặc coi live gate chưa chạy là PASS. Backend hiện hữu xuất decimal cố định bốn chữ số thập phân; không mở rộng đánh giá sang alternate provider ngoài contract/runtime đã pin. List refresh tường minh giữ theo thiết kế; Inventory invalidation thuộc scope sau.

Sau fix review: focused RED **2 FAIL/2 PASS → GREEN 6 PASS**; covering **4 files/52 PASS**; toàn bộ unit **42 files/731 PASS**, typecheck PASS. `npm.cmd run test:e2e -- tests/e2e/web3-receipt.spec.ts tests/e2e/lookup-grid.spec.ts --workers=2`: **21/21 Chromium PASS** (14 Receipt + 7 lookup Sales); `npm.cmd run test:e2e -- --config=playwright.edge.config.ts tests/e2e/web3-receipt.spec.ts --workers=2`: **14/14 Edge PASS**. Không cộng với các lượt trước. Build lại `66764fb`: PASS, JS `index-CZjqufWD.js` **2,269.42 kB / gzip 642.34 kB**, cảnh báo chunk giữ nguyên; production artifact selector trên build mới **1/1 PASS**. Đây là build dùng cho live gate.

## 4. Fixture backend và live gate

Owner cho phép fixture-only extension. Test mới dùng lifecycle cấp/thu hồi SQL database và restricted principal hiện hữu, HTTPS certificate đang được máy tin cậy; không sửa binding, bỏ qua TLS, thay runtime nghiệp vụ hoặc mở rộng SQL grants. Manifest `mode:web3-receipt` thêm Receipt editor/poster/reader với quyền độc lập; Product `WEB3-RP` riêng giữ nguyên các expected Sales/COGS hiện hữu. B04 posting Receipt/Sales cùng stock key vẫn là gate riêng.

Backend oracle đối chiếu tập ID Receipt Posted chính xác, source lines, actor, ledger/valuation từng dòng và Q/V bằng SQL. Reviewer phát hiện string aliases `1`/`01` có thể lọt kiểm tra trùng ban đầu; sửa parse int64 dương chuẩn một lần và set equality với ID SQL. Test thuần RED 10 FAIL/2 PASS → **12 PASS/0 FAIL/0 SKIP**. Scoped re-review không còn finding. Chi tiết backend do runbook `docs/development/WEB3_RECEIPT_PILOT_RUNBOOK.md` tại backend candidate và evidence backend sở hữu; nhánh chưa được merge tại checkpoint này.

Backend locked restore/build và publish host từ `b0f48be`: PASS, 0 warning/error; DLL publish khớp DLL build. Đây chưa phải kết quả live. Frontend pilot discovery với manifest origin/mode tạm, không có credentials: `npm.cmd run test:e2e -- --config playwright.pilot.config.ts --project=chromium --list` tìm **15 tests** (8 Sales + 7 Receipt), **0 thực chạy**.

Các scenario Receipt đã chuẩn bị: Create→replace Update→Post bên cạnh Sales dirty, stale409 giữ raw, Create/Update/Post commit rồi mất response với một dispatch và close/logout lock, Write/Post không Read với Post ack/Get403, Read không cấp Write/Post. Success phải đến từ HTTP thật; fault injection chỉ bỏ response sau `route.fetch({maxRetries:0})` đã trả 200.

**Lượt live Chromium đầu:** .NET wrapper **1 FAIL / 0 PASS / 0 SKIP**, browser **0 thực chạy**. Fixture truyền timeout 10 phút vượt hard cap 5 phút của `GuiOwnedProcess`, lỗi trước `NativeChild.Start`. Cleanup của runner đã drain IIS và dọn restricted login/database; cổng 44321/18081 trống, manifest/public PEM đã xóa, không có browser result. Không phải lỗi frontend hoặc acceptance PASS. Fix backend `ed532fc` giữ callsite 5 phút cho cả hai mode, không đổi supervisor/safeguards. Build Release/net48 0 warning/error, pure regression **12 PASS**, scoped re-review APPROVED. Lượt chạy lại dùng fixture/database mới và đường dẫn artifact riêng; lượt lỗi đầu được giữ trong TestResults ignored.

Web dist có 9 file copy byte-identical; JS SHA256 `F8B2B9ED18D9FA81448F248D5AB035BA2DCE4D6FD97122C69D5B77212C1B33DA`, CSS SHA256 `EE89832BFAEC4202E6DD71295535774051F18E3B089C165987468542EC41B875`. Host business DLL không thay sau fixture fix, SHA256 `3A028277ACC9A85F1DEF89A0FCA991C2282E017786B0089E198B240BD76EC031`.

**Lượt Chromium thứ hai:** **14 browser PASS / 1 FAIL / 0 SKIP** (8 Sales và 6 Receipt PASS); .NET wrapper FAIL, **SQL oracle NOT REACHED**. Ca Receipt Read-only cuối click Logout rồi `page.goto` trước khi logout/admission/revocation hoàn tất, nên có thể bootstrap lại actor cũ và timeout tìm ô username. Sửa test-only `3fbbe60`: chờ response Logout200 và màn hình đăng nhập trước khi chuyển actor; giữ nguyên các assertion quyền. Typecheck/diff PASS, scoped review APPROVE. Runtime/dist `66764fb` không đổi. Ba Post result rows tổng Q4.0001/V80.0020 chỉ là đầu vào oracle, không được ghi là SQL PASS ở lượt này. Runner đã dọn IIS/login/database/manifest/PEM, cổng trống; artifacts riêng của lượt hai được giữ. Chạy lại Chromium trên fixture mới trước Edge.

| Gate | Trạng thái hiện tại |
|---|---|
| Receipt live Chromium + backend SQL oracle | **PASS**: attempt3, 15/15 browser (8 Sales + 7 Receipt), .NET wrapper 1/1, 0 FAIL/SKIP; independent SQL + cleanup PASS |
| Receipt live Edge + backend SQL oracle | **PASS**: fresh attempt1, 15/15 browser (8 Sales + 7 Receipt), .NET wrapper 1/1, 0 FAIL/SKIP; independent SQL + cleanup PASS |
| Attended Telex/VNI/Narrator trên candidate mới | NOT RUN |
| Full IIS / production | NOT RUN / NOT APPROVED |

**Các lượt live thành công:** backend fixture `ed532fc`, Web runtime/build `66764fb`, pilot `3fbbe60`; chạy tuần tự, mỗi lượt database/principal/IIS config mới. Chromium wrapper 53s / browser 29.4s; Edge wrapper 59s / browser 36.1s. Mỗi lượt thực thi đủ 8 Sales và 7 Receipt, không retry hoặc skip. Lệnh từ backend worktree, với process-local env theo backend runbook (không lưu secret):

```powershell
dotnet test tests/MyDmsVn.Server.Infrastructure.Security.Tests/MyDmsVn.Server.Infrastructure.Security.Tests.csproj -c Release -f net48 --no-restore --no-build --filter FullyQualifiedName~Published_React_Receipt_browser_uses_real_HTTPS_SQL_and_independent_receipt_stock --logger 'trx;LogFileName=receipt-chromium-attempt3.trx' --results-directory TestResults/web3-04-receipt-chromium-attempt3
dotnet test tests/MyDmsVn.Server.Infrastructure.Security.Tests/MyDmsVn.Server.Infrastructure.Security.Tests.csproj -c Release -f net48 --no-restore --no-build --filter FullyQualifiedName~Published_React_Receipt_browser_uses_real_HTTPS_SQL_and_independent_receipt_stock --logger 'trx;LogFileName=receipt-edge-attempt1.trx' --results-directory TestResults/web3-04-receipt-edge-attempt1
```

`MYDMSVN_WEB_PILOT_PROJECT` lần lượt là `chromium` và `edge`; đây là hai invocation độc lập, không phải browser chạy song song trên cùng DB. Oracle đọc SQL thật và xác nhận **tập đúng 3 Receipt Posted**, source/actor/line/ledger/valuation, tồn Receipt thực tế **Q4.0001/V80.0020** bằng expected tính độc lập. Hồi quy Sales xác nhận 3 Post/203 source lines, quantity203.0001/COGS3045.0015, tồn Sales thực tế **Q796.9999/V11954.9985**. Hai stock keys tách biệt như fixture đã duyệt; không gọi đây là B04 same-key cross-module oracle.

Cleanup hai lượt PASS: runner đợi đúng owned IIS/process, dọn restricted login và database theo ownership, xóa manifest/public PEM; kiểm tra sau chạy không còn IIS/testhost/vstest, cổng 44321/18081 trống. Raw TRX, result JSON, logs và screenshot nằm trong các thư mục `TestResults/...` ignored của backend; frontend chỉ giữ summary đã làm sạch. Đã xem screenshot production Receipt cạnh Sales dirty và Post ack/Get403; assets/styles/actions hiển thị đúng, không có Lab route trong host production. Không commit credentials/token hoặc trace/HAR/video.

Backend evidence sở hữu chi tiết fixture/SQL: `docs/evidence/web3/20261101-web3-04-receipt-pilot-fixture.md` trong branch `codex/web3-04-receipt-pilot`. Cả hai nhánh chưa merge/push ở checkpoint này; không tạo URL remote cho tài liệu chưa xuất bản.

## 5. Giới hạn giữ nguyên

Không tuyên bố production release, full IIS, durable drafts/idempotency, audit retention hoặc distributed limiter. JWT localStorage giữ rủi ro XSS đã được ghi nhận. Không tự retry Create/Update/Post. Không sửa evidence WEB1/WEB2 đã đóng. Raw TRX/manifest/credentials/token/HAR/trace không được commit; chỉ summary đã làm sạch và screenshot UI không có secrets được dùng làm evidence.

## 6. Quyết định triển khai và bàn giao

- Dùng plan/design Owner đã chọn, không tạo spec hay vòng xin duyệt lặp lại; nếu diễn giải phạm vi sai thì cần chỉnh candidate trước acceptance.
- Làm trong worktree/branch riêng, giữ main nguyên trạng; chưa merge/push, nên tích hợp vẫn là bước sau.
- Mở rộng fixture backend theo đúng cho phép của Owner, chỉ test/runbook/evidence; oracle Receipt dùng stock key riêng và không thay thế B04.
- Raw malformed inbound-query corpus thuộc boundary backend; frontend validate typed outbound query và strict raw response. Không thêm parser query production không có caller; untyped raw-query API tương lai sẽ cần validation riêng.

Review F03, state, UI, pilot, whole branch và các scoped corrections đã kết thúc không còn finding. Các lỗi trước sửa và lượt failed được giữ ở trên. Handoff/selector/AGENTS/index liên kết về owning plan và evidence này; chưa đánh dấu DONE hoặc production-approved thay Owner.

Final documentation pass: review độc lập APPROVE; 102 local Markdown links hợp lệ, 65 file thay đổi qua kiểm tra UTF-8 không BOM/LF, `git diff --check` PASS. Backend handoff/docs HEAD `d369cc31fa124b3bf9b73448567d504f300712cb` sạch, chỉ cập nhật tài liệu sau fixture đã test `ed532fc`. Hai branch/worktree được giữ; không push/merge và không còn tài nguyên fixture đang chạy.

## 7. Owner acceptance — 2026-11-01

Owner cho phép dùng kết quả đã kiểm chứng trong evidence để merge [frontend #15](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/15) và [backend #77](https://github.com/chung6a8m/MyDmsVn/pull/77), cập nhật WEB3-04 F03/F04 thành **DONE (bounded)**. Các ghi nhận chưa push/merge hoặc chờ acceptance phía trên thuộc checkpoint triển khai trước quyết định này.

Kiểm tra GitHub trên hai PR: không cấu hình CI, 0 workflows, 0 check runs, 0 commit statuses; trạng thái tổng hợp pending với zero statuses không phải CI xanh. Owner chấp nhận dùng 731 unit/component tests, build/typecheck, browser regressions và hai lượt live 15/15 với SQL oracle/cleanup đã ghi nhận. Thay đổi acceptance chỉ là tài liệu; không tuyên bố chạy lại runtime suites.

Giữ nguyên toàn bộ giới hạn: F05/F06 chưa bắt đầu; B04 same-key valuation và toàn bộ B05 chưa hoàn tất; attended Telex/VNI/Narrator, full IIS NOT RUN; production NOT APPROVED. Durable drafts/idempotency, audit retention, distributed limiter, rủi ro JWT localStorage và cảnh báo bundle vẫn giữ nguyên.

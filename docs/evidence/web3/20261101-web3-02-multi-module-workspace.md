# WEB3-02 — Multi-module Workspace / F02 evidence

**Ngày:** 2026-11-01. **Kết quả:** implementation/verification COMPLETE trong phạm vi F02; task còn IN_PROGRESS chờ merge/acceptance theo plan; code/tests commit `dfa407d5c58c97ca76c6c645443a4f93f5ddcedd`, branch `codex/web3-02-workspace`. Tài liệu này được ghi sau khi các suite kết thúc. Commit tài liệu tiếp theo không thay runtime. [Plan sở hữu trạng thái](../../plans/20261101-001-web3-goods-receipt-inventory-web.md) · [thiết kế](../../design/WEB3_MULTI_MODULE_WORKSPACE.md) · [acceptance matrix](../../development/WEB3_ACCEPTANCE_MATRIX.md).

## 1. Candidate và môi trường

- Web base: `1fa3708f2ed04a5193f61c878a5b91991295c2a9` (`main`, đã merge F01); Owner chọn triển khai WEB3-02 ở task hiện tại. Worktree: `C:/Users/pdchung/.codex/worktrees/web3-02-workspace/ReactWebUI`.
- Backend regression: checkout sạch `C:/MyData/2026/MyDmsVn/CleanArchitecture`, SHA `feb3b6cbc3bec3fe505c2b575fd4a8050973524d`; không thay backend source hoặc task B02–B05. Canonical WEB3 fixture provenance không đổi.
- Windows 11 Home Single Language `10.0.26300`; Node `22.14.0`, npm `11.6.0`; `npm ci` thành công, 419 packages. Manifest/lockfile không thay. npm audit của dependency pins hiện hành báo 2 low/4 moderate; không tự nâng dependency trong F02.
- React `19.3.1`, TypeScript `5.9.3`, Vite `8.3.5`, Dockview/React adapter `8.8.2`, AG Grid Community `36.2.0`, Floating UI `0.27.20`. Đối chiếu installed declarations: `closeActionOverride`, `setTitle`, `onDidActivePanelChange`, `fromJSON`; không suy API từ source upstream.
- Playwright `1.64.1`; Chromium `156.0.8078.4`; Edge `156.0.4314.58`. Browser plugin không có; chạy Playwright của repo, không thay runner bằng DOM mock.
- Live host: net48, .NET SDK `10.0.303`, VSTest `17.11.1`, IIS Express `10.0.26013.1000`, SQL Server non-production được chỉ định qua biến môi trường. Dùng HTTPS `https://localhost:44321` và certificate localhost đã được OS trust; không cài cert, đổi binding hay bỏ qua TLS. Không đọc/in SQL credential.

## 2. Before → after và ownership

| Boundary | Trước F02 | F02 đã kiểm chứng |
|---|---|---|
| Phiên tài liệu | `panelRegistry` dựng Sales store/draft/read/line IDs | Sales giữ các phần đó trong `salesWorkspaceAdapter`; registry chỉ ghép feature adapters, refs và Dockview. Receipt stub có store/port riêng trong Lab |
| Identity | `[actor,generation,sales,serverId]`, chỉ Sales | Sales/Receipt cùng ID `1001` khác session/store; mở lại cùng module kích hoạt phiên cũ; hai Receipt mới có UUID riêng; stock panels là singleton theo scope |
| Command | Active Sales session | Capture module/session/actor/generation; active read-only không có document command; nút tạo mới ghi rõ Sales/Nhập kho; Save/Post vẫn thuộc feature |
| Close | Controller đọc/ghi Sales mutation và validation | `DocumentCloseAdapter` sở hữu barrier/dirty/raw/unknown/feedback; coordinator không import `SalesSessionStore` hoặc ghi business mutation |
| Global admission | Snapshot Sales, khóa mở chủ yếu ở layout | Khóa mở đồng bộ cho toàn bộ close-all; duyệt cả detached docs của mọi feature; recheck actor/revision/membership; tài liệu đã đóng trước một Cancel sau đó vẫn đóng; simple panels chỉ đóng sau tất cả document admission thành công |
| Native/UI close | Sales X/middle/Delete/Backspace | Cùng admission cho mọi document; simple close cho records/read-only; unknown/pending/preparing không Discard/close. Đóng lặp lại khi Save pending giữ promise và feedback |
| Layout | v1 Sales refs, legacy ID đến 64 chữ số | v2 module/kind/strict positive int64; fresh session và read lại; v1 sanitizer vẫn drop/prune unknown components, rồi strict int64 migration; giữ v1 key cả khi reset; present invalid v2 không fallback v1 |
| Persistence | Layout không phải draft recovery | V2 không chứa UUID, actor generation, raw/draft/lookup/unknown snapshot/token; filters của probe ở RAM, chưa có Inventory query/filter persistence của F05 |
| Auth/capability | Sales triple | Bốn module, explicit `goods-receipt` → `goods-receipts`, thiếu/unknown/stale scope deny; Inventory không có Write/Post; production startup giữ Sales calls, feature capability reads opt-in |
| Actor/remount | Sales retained memory + QueryClient scope | Generic ownership fence và unload warning duyệt mọi feature; protected host ẩn khi scope đổi; existing auth-generation runtime/QueryClient clearing giữ nguyên; move/remove không dispose phiên |

Các file ownership chính: [documentContracts](../../../src/app/workspace/documentContracts.ts), [featurePanels](../../../src/app/workspace/featurePanels.ts), [panelRegistry](../../../src/app/workspace/panelRegistry.ts), [workspaceController](../../../src/app/workspace/workspaceController.ts), [Sales adapter](../../../src/features/sales/salesWorkspaceAdapter.ts), [Sales close adapter](../../../src/features/sales/salesCloseAdapter.ts), [layout v2](../../../src/app/workspace/layoutPersistenceV2.ts), [layout orchestration](../../../src/app/workspace/workspaceLayouts.ts), [module capabilities](../../../src/app/runtime/moduleCapabilities.ts).

Receipt probe chỉ chứng minh vòng đời và fake save result qua [receiptWorkspaceStub](../../../src/lab/receiptWorkspaceStub.ts). Không có Receipt DTO/line validator/HTTP posting, số phiếu giả, stock giả hay ledger giả. Production vẫn chỉ đăng ký Sales; F03–F05 mới nối consumers thật. Sales caption dùng số chứng từ server với ID fallback; fixture cũ đã có prefix `Sales ` không bị nhân đôi prefix. Nút **Chứng từ mới** đổi thành **Sales mới**; region/editor contract giữ nguyên.

## 3. Kiểm tra frontend thực chạy

| Lệnh | Kết quả cuối trên candidate |
|---|---|
| `npm.cmd ci` | PASS; dependency lock không đổi |
| `npm.cmd run typecheck` | PASS; strict TypeScript |
| `npm.cmd run build` | PASS; gồm `tsc --noEmit`. Warning chunk >500 kB vẫn tồn tại, không phải lỗi build |
| `npm.cmd run test:unit` | **411/411 PASS**, 32 files, 0 fail/skip |
| `npm.cmd run test:e2e -- --project=chromium --workers=2` | **105/105 PASS**, 0 fail/skip, 2.1 phút |
| `npm.cmd run test:e2e -- --config playwright.edge.config.ts tests/e2e/web3-workspace.spec.ts tests/e2e/layout-restore.spec.ts tests/e2e/workspace.spec.ts tests/e2e/web2-http.spec.ts tests/e2e/sales-editing.spec.ts --workers=2` | **60/60 PASS**, 0 fail/skip, 1.6 phút; đây là targeted Edge, không phải full suite |
| `npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1` | **1/1 PASS**, artifact `/` + Lab routes bị loại |
| Static artifact inspection / `git diff --check` | PASS; production JS không có Lab actor/Receipt probe/fake constructor/private draft markers; không có `SalesSessionStore` import trong generic Workspace |

Baseline trước refactor: **65/65** `tests/unit/workspace` PASS. Các lượt focused RED→GREEN không cộng vào tổng cuối. Build artifact: `index-BI_B486l.js`, `index-D-tugx59.css`; không có fake production fallback.

Browser thật đã kiểm chứng W3-WKS-01/03/04/05/06/07 theo phạm vi F02: split/move/remount, raw input riêng, X/middle/Delete/Backspace/Ctrl+Alt+W, command target khi hai group visible, save barrier, pending/unknown, actor switch, fresh restore và malformed layout. W3-WKS-02 kiểm chứng UUID tài liệu mới; Receipt line editing/clientLineId business còn thuộc F04. W3-AUTH-01/02 có auth/unit + existing HTTP browser regression; capability endpoints Receipt/Inventory thật thuộc B02/F03.

Sales regression gồm duplicate Product/gift/200 lines, decimal/raw/composition, Floating UI selection/focus, validation sau sort, row identity, keyset list, conflict/recovery, no automatic write replay. Chromium có native browser zoom125/200; Edge suite không chạy native zoom case tự launch Chromium. Viewports gồm 1280×720/1440×900, theme Light/Dark theo suite; ảnh hai module ở 1440×900 được kiểm tra trực quan, không có overlay/lỗi console trong các ca mới. Synthetic composition không phải attended Telex/VNI.

## 4. Sales real HTTPS/SQL regression — tách khỏi Receipt acceptance

Theo [runbook hiện hữu](../../development/WEB2_PILOT_RUNBOOK.md) như fixture pattern được F02 cho phép, không mở lại roadmap WEB2:

1. Backend `Publish-Web2Host.ps1 -OutputPath <new-empty-temp-directory>`: locked restore/build/publish PASS, không warning/error. Copy đúng candidate `dist` vào `wwwroot` của output mới.
2. `dotnet restore tests/MyDmsVn.Server.Infrastructure.Security.Tests/MyDmsVn.Server.Infrastructure.Security.Tests.csproj --locked-mode`: PASS.
3. Đặt process-local `MYDMSVN_WEB_TEST_PUBLISH_DIRECTORY`, `MYDMSVN_WEB_TEST_BROWSER_DIRECTORY`, `MYDMSVN_WEB_TEST_TLS_THUMBPRINT` cho binding có sẵn và `MYDMSVN_WEB_PILOT_PROJECT=chromium`, rồi chạy lệnh dưới. Lặp tuần tự với `edge` và output riêng.

```powershell
dotnet test tests/MyDmsVn.Server.Infrastructure.Security.Tests/MyDmsVn.Server.Infrastructure.Security.Tests.csproj -c Release -f net48 --no-restore --filter FullyQualifiedName~Published_React_browser_uses_real_HTTPS_SQL_and_atomic_stock --logger 'trx;LogFileName=chromium.trx' --results-directory TestResults/web3-02-chromium
# Invocation thứ hai: project env=edge, LogFileName=edge.trx, results-directory TestResults/web3-02-edge
```

| Runner | Browser count | .NET wrapper/oracle/cleanup |
|---|---:|---:|
| Chromium, fresh owned SQL/host | **8/8 PASS**, 18.8s | **1/1 PASS**, 0 fail/skip, 50s |
| Edge, separate fresh owned SQL/host | **8/8 PASS**, 25.9s | **1/1 PASS**, 0 fail/skip, 49s |

Fixture kiểm tra posted Sales, Qty/CostAmount, Q/V, StockLedger và StockValuationEntries độc lập qua SQL. UI/API cases gồm real Create/Update/Post, 200 lines/gift/precision, stale version409, Write/Post không Read, response loss sau commit, actor/logout/refresh/cookie/Origin/CSP. Không thay quyền, limiter hay expected oracle để làm test xanh.

Backend TRX cục bộ: `TestResults/web3-02-chromium/chromium.trx` và `TestResults/web3-02-edge/edge.trx`. Sanitized browser logs cục bộ của fixture xác nhận rõ 8 tests mỗi lượt. Fixture đã xóa credential manifest/public PEM, drain IIS worker và cleanup owned SQL login/database; wrapper chỉ PASS khi cleanup không lỗi. Sau cả hai lượt: 0 listeners ở 44321/18081; backend git sạch tại SHA trên. Không commit log/TRX/trace/HAR/token/cookie/password. Live config tắt trace/video/HAR/screenshot, TLS verification bật.

## 5. Lỗi đã tìm và sửa trước nghiệm thu

- Unit composition test cũ mở tài liệu khi auth chưa login: registry mới deny đúng; sửa fixture test để login qua auth API giả lập trước khi kiểm business date. Lượt đầu full unit: 405 PASS/1 FAIL; lượt cuối **411/411 PASS** sau bổ sung regressions.
- Review phát hiện restored-ID argument có thể vượt global open lock; đường restore được giữ private, public open không nhận UUID restore, không bypass close busy. Regression dùng extra argument cũng không mở được phiên.
- Review phát hiện close-all còn để simple panels khi trả success; thêm finalization callback dưới cùng lock, giữ simple panels nếu Cancel/blocked. Thêm regression cho startup sau cleanup phải dựng lại safe shell. Cả hai quan sát RED→GREEN.
- Một lượt browser focused bị dừng chủ động sau 10 PASS để áp dụng review fix; không tính là suite PASS.
- Lượt full Chromium đầu: **103 PASS/2 FAIL**. Một lỗi locator trùng tên vùng Dockview/StockCard được giới hạn vào section của probe. Một regression thật ở close lặp lại khi Save pending thiếu feedback: thêm assertion unit (13 PASS/1 FAIL trước fix), gọi feature feedback khi join intent. Sau fix **14/14 unit** và **2/2 browser** targeted PASS, rồi full **105/105 PASS**.
- Rà soát subagents độc lập cho actor/restore/close và kiểm lại diff; không có lỗi F02 đã xác nhận còn mở.

## 6. Handoff và giới hạn

**Implementation/verification F02 hoàn tất** (task chưa chuyển DONE trước merge/acceptance): hai feature-specific session adapters cùng tồn tại, generic seams không sở hữu Sales/Receipt business state, regression Sales giữ được ở unit/browser và live HTTPS/SQL scope đã chạy. Runtime/test commit ở branch riêng; chưa merge branch này vào `main`.

- F03/F04/F05: actual Receipt/Inventory ports/codecs/UI, unique Product/line reconciliation, Post ack không version, Inventory queries/filters và capability loading sau login/refresh. `loadFeatureCapabilities` là opt-in; auth adopt/refresh xóa grant module bổ sung, consumers phải reload và giữ deny trong lúc chờ. Không thêm startup request khi B02 chưa sẵn sàng.
- F06/B04/B05: Receipt → Inventory → Sales real cross-module SQL/browser acceptance chưa chạy. Live regression ở đây chỉ là Sales hiện hữu; Receipt stub không thay nghiệm thu backend.
- Full IIS/production, durable drafts/idempotency, audit retention, distributed limiter và candidate-specific attended Telex/VNI/Narrator vẫn NOT RUN/not authorized. WEB2 Owner-accepted full-IIS exception không thành PASS. Rủi ro JWT localStorage hiện hữu không thay đổi.
- Không sửa evidence WEB1/WEB2, không đổi CEX WinForms, không thêm Enterprise/custom theme/popout hoặc quyền SQL rộng.

## 7. PR #14 review follow-up — 2026-11-01

**Candidate sửa lỗi:** `fcc9979f17c1f0b27990733b08a31d514ef86af0`, tiếp nối PR head `6a1a14e2dc4c817d4ca4bdba1dbdc3eb14a10dba`; base review `1fa3708f2ed04a5193f61c878a5b91991295c2a9`. Owner yêu cầu review boundary Workspace và regression Sales, sửa rồi push lên cùng [PR #14](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/14). F02 vẫn IN_PROGRESS chờ merge/acceptance.

**Finding P2 đã sửa:** `openPanel` từ chối module thiếu Read, nhưng restore v2 gọi đăng ký simple panel trực tiếp sau khi chỉ kiểm tra module tồn tại. Vì vậy layout đã lưu có thể mở lại Receipt records, Stock Balances hoặc Stock Card khi Read hiện tại bị từ chối. Restore preflight nay áp dụng cùng module Read gate trước khi đăng ký/render panel. Sales shell mặc định vẫn được tạo riêng, giữ luồng Write/Post không có Read. Đây là lỗi capability boundary của Workspace; không có bằng chứng rò rỉ dữ liệu backend từ các Lab probes.

[Regression mới](../../../tests/unit/workspace/restoreCapabilities.test.ts) chạy runtime/registry thật với auth/port fixture và Dockview boundary double: **RED 3 fail / 4 pass**, sau sửa **7/7 pass**. Ba case deny và ba case allow bao phủ các simple module; case thứ bảy giữ Sales shell khi Read bị từ chối. Review độc lập cho close/commands, registry/auth/Sales và layout không tìm thêm lỗi xác nhận được; review chéo bản sửa kiểm tra default shell, actor fence và thời điểm preflight trước remap. Không dùng unit double để tuyên bố Dockview browser acceptance.

Các lệnh dưới chạy lại trên đúng source của candidate sửa lỗi; các lượt focused không cộng vào tổng cuối:

| Lệnh / runner | Kết quả mới |
|---|---|
| `npm.cmd run test:unit` | **418/418 PASS**, 33 files, 0 fail/skip |
| `npm.cmd run build` | PASS, gồm strict `tsc --noEmit`; warning chunk >500 kB hiện hữu. Artifact `index-B8MHN8Sl.js`, CSS `index-D-tugx59.css` |
| `npm.cmd run test:e2e -- --project=chromium --workers=2` | **105/105 PASS**, 2.3 phút |
| `npm.cmd run test:e2e -- --config playwright.edge.config.ts tests/e2e/web3-workspace.spec.ts tests/e2e/layout-restore.spec.ts tests/e2e/workspace.spec.ts tests/e2e/web2-http.spec.ts tests/e2e/sales-editing.spec.ts --workers=2` | **60/60 PASS**, 1.7 phút; targeted Edge |
| `npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1` | **1/1 PASS**, không có fake workspace/actor/Lab routes trong artifact |
| `git diff --check`, encoding/LF và link tài liệu thay đổi | PASS |

Browser plugin không có; dùng Playwright repo, môi trường/version giữ nguyên mục 1. Flow browser `/lab/sales` → mở Sales/Receipt cùng ID, split, nhập raw riêng, đóng/Cancel, chuyển read-only và remount: giữ đúng buffer và command target. Screenshot hai module 1440×900 được kiểm tra trực quan; không overlay hoặc lỗi console trong case đó. Sales suite kiểm tra editor/lookup, last keystroke, duplicate Product/gift/200 lines, close admission, layout, auth/HTTP fake và recovery không tự retry. Chromium native zoom vẫn thuộc full suite; không coi đây là Edge zoom hoặc attended IME.

**Sales HTTPS/SQL thật được chạy lại**, không thay backend source tại `feb3b6cbc3bec3fe505c2b575fd4a8050973524d`. Publish host mới bằng `Publish-Web2Host.ps1 -OutputPath <new-empty-temp-directory>`, copy candidate `dist`, locked restore test project PASS; TLS verification bật với binding/certificate có sẵn. Chạy lại đúng lệnh `dotnet test` ở mục 4, tuần tự `MYDMSVN_WEB_PILOT_PROJECT=chromium` rồi `edge`; results directories lần này là `TestResults/web3-02-pr14-review-chromium` và `TestResults/web3-02-pr14-review-edge`, logger lần lượt `chromium.trx`/`edge.trx`.

| Runner | Browser mới | .NET SQL oracle/cleanup mới |
|---|---:|---:|
| Chromium | **8/8 PASS**, 27.4s | **1/1 PASS**, 56s, 0 skip |
| Edge | **8/8 PASS**, 40.5s | **1/1 PASS**, 65s, 0 skip |

Sanitized browser logs xác nhận riêng 8 tests mỗi lượt. SQL stock/valuation oracle và cleanup owned resources PASS; sau hai lượt 0 listeners tại 44321/18081, backend git sạch. Không commit TRX/log/credentials. Không sửa dependency pins hoặc evidence WEB1/WEB2. Giới hạn mục 6 giữ nguyên: Receipt/Inventory production và cross-module SQL acceptance, full IIS/production, attended Telex/VNI/Narrator chưa được nghiệm thu. Commit tài liệu kế tiếp chỉ bổ sung evidence/checkpoint, không thay runtime đã kiểm chứng.

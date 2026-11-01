# WEB3-06 — frontend verification và checkpoint tích hợp

**Ngày:** 2026-11-01 (Asia/Bangkok). **F06 IN_PROGRESS — implementation và kiểm chứng tích hợp được ghi bên dưới; chờ Owner acceptance, chưa DONE.** Owner chọn WEB3-06, cho phép subagents và sau đó cho phép B04/B05 trong phạm vi giới hạn. [Plan §7](../../plans/20261101-001-web3-goods-receipt-inventory-web.md#7-web3-f06--integrated-acceptance-ci-and-handoff) sở hữu trạng thái; [acceptance matrix](../../development/WEB3_ACCEPTANCE_MATRIX.md) sở hữu scenarios. **§1–4 giữ checkpoint frontend trước authorization; §5–7 ghi diễn tiến mới, không dùng các trạng thái NOT RUN cũ làm trạng thái hiện tại.**

## 1. Source và phạm vi

- Web baseline main `7626a2fb6d9fe30ffad85c60b622e343fdf20502`, sạch trước khi tạo worktree; nhánh `codex/web3-06-acceptance`.
- Candidate tests/CI **`73f560e20ffeefc0ee32bf1d327ebce7c8bc918c`**. Không đổi `src/`, dependency/lockfile, business validation, auth storage hoặc SQL grants. Production build vẫn là runtime tree của baseline.
- Backend đọc tại main sạch **`e86335add61cc2d1e936cadad019b96053e4b9ca`**. B04/B05 vẫn PLANNED trong [owning backend plan](https://github.com/chung6a8m/MyDmsVn/blob/e86335add61cc2d1e936cadad019b96053e4b9ca/docs/plans/20261101-002-web3-goods-receipt-inventory-http.md). Không sửa backend, không chạy SQL hoặc host fixture trong checkpoint này.
- Đã gửi Owner đề nghị cụ thể: mở rộng B04/B05 chỉ tests/fixture/oracle/docs, SQL non-production và IIS Express HTTPS hiện hữu, Chromium/Edge riêng từng database; không đổi runtime nghiệp vụ/grants/production. **Chưa có trả lời ở checkpoint này.** AGENTS yêu cầu trình bày và xin quyết định trước khi mở rộng backend/runtime thật.

## 2. Deliverables

[CI workflow](../../../.github/workflows/web.yml) chạy PR, push main/codex và manual trên Ubuntu 24.04: Node22.14/npm11.6, `npm ci`, typecheck, build, unit/component, Chromium frontend đầy đủ và production isolation. Actions pin SHA, token chỉ `contents: read`, checkout không giữ credentials. Không có SQL, live pilot, secrets hoặc giả định Edge trên Linux. Native Chromium zoom test được giữ. **Workflow đã thêm và lint PASS; hosted CI NOT RUN**, không gọi kết quả Windows local là CI PASS.

[Receipt browser regression](../../../tests/e2e/web3-receipt.spec.ts) bổ sung W3-REC-09: hai Product khác nhau, sửa quantity rồi sort đảo vị trí hiển thị; server400 `lines[1].quantity` phải map theo sent snapshot tới stable clientLineId, focus đúng editor, giữ raw của dòng còn lại và chỉ gửi một Save. Behavior hiện hữu PASS ngay; đây là acceptance coverage, không có runtime fix hoặc RED giả lập.

[Integrated live spec](../../../tests/pilot/web3-integrated-live.spec.ts) có **3 ca PREPARED / NOT RUN**:

1. Receipt Create/Update/Post qua UI, opening10@10 rồi Receipt10@20 → Q20/V300; Sale4@25 → COGS60, Q16/V240; Receipt2@50 có ngày nghiệp vụ cũ → Q18/V340, chi phí Sale đã Post giữ nguyên. Kho thứ hai Receipt3@7 → Q3/V21; không ảnh hưởng kho đầu. Năm Post qua UI, Inventory đã load phải refetch trước khi activate lại panel, thẻ kho có movement âm và source links, Sales dirty khác được giữ.
2. Balances-only actor: endpoint được cấp200, Card403, source read/write403 và UI độc lập.
3. Card-only actor: endpoint được cấp200, Balances403, source read/write403 và UI độc lập.

Expected số học trong browser là assertion kiểm tra projection; **không thay independent physical SQL oracle**. Không fake response thành công, không direct SQL, TLS bypass hoặc write retry. Config giữ trace/video/HAR tắt. [Pilot config](../../../playwright.pilot.config.ts) chọn mode rõ: omitted mode giữ Sales8, `web3-receipt` chọn15, `web3-integrated` chọn18; mode không hợp lệ/null bị từ chối, không fallback âm thầm sang Sales.

### Hợp đồng fixture đang chờ backend

Đây là interface test-only của spec đã chuẩn bị, chưa phải manifest backend đã triển khai. Mode `web3-integrated` cần giữ actors/catalog hiện hữu và thêm `actors.integratedEditor`, `actors.balanceReader`, `actors.cardReader`; `integratedCatalog` gồm `warehouseId`, `otherWarehouseId`, `employeeId`, `customerId`, `productId`. Mã lookup `WEB3-IW`, `WEB3-IW2`, `WEB3-IP`; hai integrated stock keys ban đầu không có stock/history. Editor có grants Receipt/Sales/Balances/Card và Catalog; hai reader có Catalog lookup cùng đúng một Inventory Read.

Spec ghi vào `resultPath` hiện hữu: bốn Receipt và một Sales, thêm `scenario: integrated`, `actor: integratedEditor`, ID thật và quantity/value hoặc cost expected. Backend phải kiểm tra độc lập exact document-set union, actor/source/line/ledger/valuation, posting order, frozen COGS/profit và Q/V từng key. Oracle cũ đang giả định mọi Posted Receipt dùng regression key và đúng hai balances, nên chưa được dùng với mode mới mà không mở rộng đúng ownership.

## 3. Môi trường và kết quả thực chạy

Windows build **26300**, Node **22.14.0**, npm **11.6.0**, Playwright **1.64.1**, Chromium **156.0.8078.4**, Edge **156.0.4314.58**. Browser plugin không có; dùng Playwright có sẵn theo TEST_POLICY. Fake/browser chạy `http://127.0.0.1:5173`; production preview `http://127.0.0.1:5174`. Không gọi hai URL này là HTTPS/SQL.

| Lệnh | Thực chạy / kết quả |
|---|---|
| `npm.cmd ci` | PASS; 419 packages. Audit báo 2 low/4 moderate trong cây dependency; không tự nâng pin. `npm.cmd audit --omit=dev --audit-level=high` trả 0 vulnerabilities |
| `npm.cmd run test:unit` | **47 files / 763 PASS**, 0 FAIL/SKIP; trước các thay đổi test-only, runtime/unit source không đổi sau đó |
| `node --test tests/fixtures/web3-v1/validate-corpus.test.mjs` | **8 PASS**, 0 FAIL/SKIP; corpus pin không đổi |
| `npm.cmd run typecheck` | PASS, gồm lượt sau source test/CI cuối |
| `npm.cmd run build` | PASS; JS 2,282.11kB / gzip646.00kB, cảnh báo chunk >500kB giữ nguyên, không có performance acceptance |
| `npm.cmd run test:e2e -- --project=chromium --workers=2` | **133 PASS**, 0 FAIL/SKIP, 2.9m; suite hiện hữu trước khi thêm W3-REC-09 |
| `npm.cmd run test:e2e -- tests/e2e/web3-receipt.spec.ts --project=chromium --workers=1 --grep "server indexed quantity error"` | **1 PASS**, 0 FAIL/SKIP, 5.4s; ca mới, không cộng thành một lượt full134 |
| `npm.cmd run test:e2e -- --config playwright.edge.config.ts tests/e2e/web3-receipt.spec.ts tests/e2e/web3-inventory.spec.ts tests/e2e/web3-workspace.spec.ts tests/e2e/web2-http.spec.ts --workers=2` | **41 PASS**, 0 FAIL/SKIP, 1.0m; có ca W3-REC-09 mới |
| `npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1` | **1 PASS**, 0 FAIL/SKIP; artifact không có fake workspace/actor/Lab routes |
| `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 .github/workflows/web.yml` | PASS qua subagent CI; cú pháp/semantic workflow, không phải hosted execution |
| `npm.cmd run test:e2e -- --config playwright.pilot.config.ts --project=chromium --list` với manifest TEMP không credentials | Discovery: omitted8, Receipt15, integrated18; **0 live tests thực chạy**. Invalid/null mode exit1 đúng thông báo |

Không có test failure trong các lượt frontend trên. Source review sửa query denial Sales của pilot từ pageNumber sang pageSize-only trước live execution; không gọi đây là HTTP regression đã chạy. Hậu review, assertion refetch của live spec được đặt trước activation để remount đơn thuần không thể làm test PASS; typecheck PASS, live vẫn NOT RUN.

Suite kiểm tra DOM thật AG Grid/Dockview/Floating UI, key-by-key lookup, close/reset/restore, actor/permission change, ack/Get403 và Create/Update/Post response-loss/no replay. Các HTTP response trong suite frontend là controlled stubs. Overlapping-ID Workspace probe là lifetime stub; actual Receipt/Sales cũng có browser split/Cancel/pending coverage, không gọi probe là live business integration.

Đã xem ảnh Edge Receipt popup Light1280×720 và Inventory/Card cạnh Sales dirty Dark1440×900; controls/popup hiển thị trong viewport, grid dùng scroll hiện hữu. Suite có cả1280×720/1440×900 và Light/Dark. Pageerror/console assertions của Receipt/Inventory PASS, bỏ qua resource failure được fault-inject có chủ đích. Ảnh/log ở `test-results/edge` ignored và TEMP local; không commit raw reports/credentials/traces. Vite do Playwright sở hữu đã dừng trước ghi tài liệu. Chưa cấp SQL fixture nên không có SQL cleanup nào để tuyên bố PASS.

## 4. Review và gate tại checkpoint frontend ban đầu

Review độc lập source CI/config/new browser/pilot không còn actionable finding. Reviewer không chạy live hoặc xác nhận hosted CI. B04 audit xác định các test Inventory/Security hiện hữu cho concurrency, Shared/Exclusive barrier, rollback, fractional/depletion và frozen cost để chạy chọn lọc, tuần tự theo backend TEST_POLICY; không tạo bản sao test chỉ để tăng số lượng.

| Gate | Trạng thái |
|---|---|
| Frontend local regression và CI configuration | PASS trong phạm vi ở trên |
| GitHub-hosted CI | NOT RUN; chưa push/PR |
| Backend B04/B05 extension và independent SQL oracle | PENDING Owner scope decision; backend chưa đổi |
| Fresh production HTTPS/SQL integrated Chromium và Edge | NOT RUN; phải riêng database/fixture cho từng browser |
| Owner acceptance/merge F06 | PENDING; **không DONE** |
| Current-candidate attended Telex/VNI/Narrator | NOT RUN |
| Full IIS / production | NOT RUN / NOT APPROVED |

Giữ các giới hạn audit retention, distributed rate limiting, durable drafts/idempotency, JWT localStorage XSS risk, bundle optimization chưa đo. Không archive WEB3 hoặc sửa evidence WEB1/WEB2/F03/F04/F05 đã đóng để thêm PASS mới. Worktree/branch giữ lại, chưa push/merge.

Documentation review phát hiện README active summary còn ghi F06 chưa bắt đầu; đã đồng bộ thành IN_PROGRESS và link checkpoint. Historical acceptance paragraphs giữ nguyên. Kiểm tra cuối: UTF-8 không BOM/LF, local Markdown links và `git diff --check` PASS; không thêm runtime test claim từ lượt kiểm tra tài liệu.

Encoding gate phát hiện CRLF do append cuối trên working copy; đã normalize về LF và chạy lại validator. Đây là lỗi định dạng tài liệu, không phải runtime test failure.


## 5. Owner mở rộng B04/B05 — 2026-11-01

Owner đã trả lời **“Cho phép B04/B05 trong phạm vi nêu trên”**: tests/fixture/oracle/docs và SQL non-production + IIS Express HTTPS hiện hữu, Chromium/Edge riêng từng database; không đổi runtime nghiệp vụ, SQL grants hoặc production. Các ghi nhận chờ quyết định phía trên là checkpoint trước câu trả lời này. Backend thực hiện trong branch `codex/web3-06-integrated` tại worktree riêng từ `e86335a`; owning backend plan ghi B04/B05 IN_PROGRESS. Không cần xin lại phạm vi đã được cho phép. Kết quả live sẽ được ghi sau khi chạy, không suy từ authorization.

## 6. Kiểm chứng tích hợp đã hoàn tất — chờ Owner acceptance

### Source, môi trường và artifact thực chạy

- Backend tests/fixture/oracle candidate **`82f235248b1b570d41ae42f5d8cffd53f8b9f46e`**, branch `codex/web3-06-integrated`. Backend `src/`, schema, business valuation, provisioning/grants và dependency không đổi. B04/B05 status chỉ nằm trong owning backend plan; evidence mới của backend là `docs/evidence/web3/20261101-b04-b05-integrated-pilot.md`.
- Web lần đầu dùng checkout **`67f317d52aaad49c77bb84e4593c6cbce6e05e1a`**, gồm test/CI source `73f560e`. Attempt2 dùng **`b4ebd405e1eefa40b754c11cba2b0f8b661a7e3d`**, thêm ba assertion ẩn nút trước screenshot. Sau review locator, candidate cuối **`d2e416f0a99bafe3851b61bbc90771fb10af9907`** thêm `includeHidden` cho parent Sales và yêu cầu cả ba nút vẫn tồn tại trước khi kiểm tra ẩn. Runtime vẫn đúng tree baseline `7626a2fb6d9fe30ffad85c60b622e343fdf20502`; không có runtime fix. Typecheck sau mỗi thay đổi pilot PASS.
- Môi trường Web/browser giữ đúng §3; SQL Server **14.0.2140.2 RTM Developer Edition (64-bit)**, IIS Express **10.0.26013.1000**, .NET SDK **8.0.427**, target **net48**, VSTest **17.11.1**. Đọc metadata từ designated nonproduction connection; không ghi connection string.
- Publish mới qua `Publish-Web2Host.ps1 -SkipBuild` sau build Release, rồi copy production `dist`; cả **9 file Web byte-identical**. Host artifact ở backend `TestResults/web3-06-host-20261101-a/published`. SHA-256 DLL `D233ACFB61865A0D0E8E4D326A22A77629A8C5FA22459CCB9BDF37A6BBFFAFEB`; JS `index-Lu1N_ZH7.js` có SHA-256 `CE6AE5C640DCDF772ACA8002BF961D0678DE5BC790DA814258593D5ECD1248A0`. Mọi lượt dùng cùng artifact; không chạy Vite/watchers trong live pilot.

### Backend và browser thực chạy

Backend dùng các owner hiện hữu, tuần tự, không thêm SQL runner. **26 pure parser/oracle rows PASS**, **54 Inventory SQL rows PASS**, **6 HTTP/Security/provisioning SQL rows PASS**, mỗi lượt 0 FAIL/SKIP. Exact filters/commands/TRX và phạm vi từng scenario nằm trong backend evidence: rounding/max/fractional/full depletion, same-Receipt concurrent Post chỉ một movement/value companion, Receipt/Sale serialization, Shared/Exclusive barrier, sorted multi-key locks, timeout/deadlock không replay, rollback, stale/denied writes, frozen cost, queries, HTTP 0/201-line rejection và 200-line replacement, restricted principals. Không gọi 60 SQL rows này là full backend suite.

Security build ban đầu bị xUnit2031 chặn `Assert.Single(rows.Where(...))`; đổi sang overload predicate và build sạch. Đây là lỗi analyzer của test, không phải SQL/browser failure. Các test behavior mới đều PASS lần thực chạy đầu; không tạo RED giả.

| Browser / Web pilot candidate | Browser cases | Host + independent SQL wrapper | Cleanup |
|---|---|---|---|
| Chromium attempt1 / `67f317d` | **18 PASS**, 0 FAIL/SKIP, 39.2s | **1 PASS**, 70.648s | PASS |
| Edge attempt1 / `67f317d` | **18 PASS**, 0 FAIL/SKIP, 42.6s | **1 PASS**, 69.732s | PASS |
| Chromium attempt2 / `b4ebd40` | **18 PASS**, 0 FAIL/SKIP, 37.6s | **1 PASS**, 62.895s | PASS |
| Edge attempt2 / `b4ebd40` | **18 PASS**, 0 FAIL/SKIP, 45.6s | **1 PASS**, 68.943s | PASS |
| Chromium attempt3 / **`d2e416f`** | **18 PASS**, 0 FAIL/SKIP, 37.8s | **1 PASS**, 62.164s | PASS |
| Edge attempt3 / **`d2e416f`** | **18 PASS**, 0 FAIL/SKIP, 47.3s | **1 PASS**, 70.727s | PASS |

Mỗi lượt tạo riêng database schema11, ordinary actors, restricted runtime login có SID tracking, IIS Express configuration và browser context. Backend wrapper chỉ PASS sau oracle và guarded cleanup. Cả 18 ca thực chạy gồm Sales8, Receipt7 và integrated3, không chỉ discovery. Candidate cuối có 18 ca trên mỗi browser, cộng hai wrapper; không cộng các lượt lặp thành scenario khác nhau.

Lý do chạy attempt2: ảnh attempt1 chụp ngay sau chuyển tab có nút của panel cũ còn hiện trong transition. Review source pin xác định Dockview giữ panel bằng `visibility:hidden`, còn Button preset dùng `transition-all` với default150ms. Bổ sung `toBeHidden()` cho nút Sales Post, Card source và Balances reload; không dùng sleep hoặc sửa CSS preset. Assertions PASS trên cả browser; đã xem PNG attempt2, các nút cũ không còn, dirty Sales và text tiếng Việt nguyên vẹn. Đây là kiểm chứng trạng thái UI đã ổn định; không tuyên bố đã sửa runtime bug hoặc đã thực hiện attended IME.

Review cuối phát hiện riêng assertion Sales ở `b4ebd40` có thể PASS vì parent role locator không tìm region đã ẩn; `includeHidden` ở child không sửa được parent. Kết quả nghiệp vụ/SQL và các PNG attempt2 vẫn hợp lệ, nhưng assertion đó chưa chứng minh retained Sales button ẩn. Candidate `d2e416f` sửa parent và thêm `toHaveCount(1)` trước `toBeHidden()` cho cả ba controls. Re-review không còn actionable source finding. Các lượt attempt3 chạy lại với fixture mới để kiểm chứng thay đổi, không phải automatic retry của writes.

Cả Chromium và Edge attempt3 PASS gồm tồn tại/ẩn đủ ba controls, independent SQL oracle và cleanup. Đã xem PNG cuối của cả hai browser: không còn nút của panel không active, note Sales chưa lưu nguyên vẹn. Independent scope audit không phát hiện gate implementation/verification còn thiếu trong phạm vi đã cho phép. Review tài liệu sửa summary backend cũ còn PLANNED/chưa có live proof; không sửa lịch sử test cũ.

Lệnh cho lượt cuối (chạy từ backend checkout, set các input process-local theo backend runbook; không in secrets):

```powershell
$env:MYDMSVN_WEB_PILOT_PROJECT = 'chromium'
dotnet test tests/MyDmsVn.Server.Infrastructure.Security.Tests/MyDmsVn.Server.Infrastructure.Security.Tests.csproj -c Release -f net48 --no-restore --no-build --filter FullyQualifiedName~Published_React_integrated_browser_preserves_same_key_QV_COGS_and_warehouse_isolation --logger 'trx;LogFileName=integrated-chromium-attempt3.trx' --results-directory TestResults/web3-06-integrated-chromium-attempt3

$env:MYDMSVN_WEB_PILOT_PROJECT = 'edge'
dotnet test tests/MyDmsVn.Server.Infrastructure.Security.Tests/MyDmsVn.Server.Infrastructure.Security.Tests.csproj -c Release -f net48 --no-restore --no-build --filter FullyQualifiedName~Published_React_integrated_browser_preserves_same_key_QV_COGS_and_warehouse_isolation --logger 'trx;LogFileName=integrated-edge-attempt3.trx' --results-directory TestResults/web3-06-integrated-edge-attempt3
```

Normal TLS verification dùng certificate/binding localhost đã tin cậy; không thay machine trust. Browser chỉ nhận manifest tạm, không nhận SQL credentials. Trace/video/HAR tắt. Các ca mất response chặn response **sau mutation thật**, rồi xác nhận khóa recovery/no replay; không fake successful Post.

### Kết quả nghiệp vụ và cleanup

Independent physical SQL oracle kiểm tra exact union toàn bộ Posted IDs trước khi tách scenario; source line, ledger, valuation companion, actor/timestamp, thứ tự Post, đúng tập stock keys, không Draft movement/orphan/extra movement. Nó đọc physical tables độc lập với production projection/valuation helpers; browser-result không được coi là SQL oracle.

- Hai Receipt cùng key: 10@10 và 10@20 → **Q20/V300**. Sale4@25 → **Q16/V240**, frozen unit cost15, COGS60, revenue100, profit40.
- Receipt2@50 có ngày chứng từ cũ nhưng Post sau Sale → **Q18/V340**; toàn bộ Sale DTO đã Post và physical frozen costs không đổi.
- Cùng Product tại kho thứ hai nhận3@7 → **Q3/V21**, không thay đổi key thứ nhất. Legacy Sales/Receipt keys vẫn được đối soát riêng và trong global oracle.
- Browser xác nhận Inventory refetch trước khi activate panel; signed movement/source links; năm Post đúng một lần mỗi chứng từ; Sales dirty khác không mất. Hai Inventory-only actors đọc đúng feature200, feature còn lại403 và source read/create/update/post403 thật. Sales/Receipt unknown mutation, stale409, Post ack/Get403, cookie/refresh/CSP/Origin regression đều chạy lại.

Sau mỗi lượt: không còn IIS Express/testhost hay listener44321/18081; manifest và public certificate PEM tạm đã xóa. Wrapper đã await browser process-tree drain, SID-checked login cleanup và positively owned database disposal trước PASS; không có cleanup failure/quarantine. Không drop bằng prefix. Các run directory chỉ giữ config, sanitized log và browser result local; screenshots được copy vào TRX directory `browser-artifacts/` trước lượt kế. Không commit raw config/credentials/results/traces. Logs có warning NO_COLOR/FORCE_COLOR, không có runtime failure.

### Gate hiện tại

| Gate | Kết quả hiện tại |
|---|---|
| Frontend regression, typecheck/build, CI configuration/lint | PASS theo §3; không rerun broad suites chỉ vì thay pilot assertions |
| Authorized B04/B05 focused SQL + final Chromium/Edge production HTTPS/SQL | PASS trong phạm vi trên; backend owning evidence riêng |
| GitHub-hosted CI | **NOT RUN**, chưa push/PR; local PASS không phải CI PASS |
| F06 Owner acceptance/merge | **PENDING**, F06 IN_PROGRESS; implementation và verification sẵn sàng review |
| Current-candidate attended Telex/VNI/Narrator | NOT RUN |
| Full IIS / production | NOT RUN / NOT APPROVED |

Giữ các giới hạn audit retention, distributed limiter, durable drafts/idempotency, JWT localStorage XSS risk và bundle optimization chưa đo. Không archive WEB3, không đổi CEX/WinForms hay evidence cũ. Hai worktree/branch giữ lại để review; chưa push/merge.

Kiểm tra tài liệu cuối: 12 file candidate Web UTF-8 không BOM/LF, 128 local links resolve và `git diff --check` PASS. Backend có 14 file candidate, Markdown UTF-8 không BOM/CRLF theo repo, 283 local links resolve và diff check PASS. Đã đối chiếu lại TRX thực tế: không có failed/notExecuted row trong các lượt đã báo. Hai checkout `main` gốc vẫn sạch và không đổi; những kiểm tra này không tạo thêm runtime/CI PASS.

## 7. Push, PR và hosted CI — 2026-11-01

Owner yêu cầu push cả hai nhánh, tạo PR và kiểm tra CI/review trước merge. Đã tạo [frontend PR #17](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/17) từ `codex/web3-06-acceptance` vào `main`, reviewed head **`36728b14dc8949b71a23ecb888fc410a41e853d4`**, base `7626a2fb6d9fe30ffad85c60b622e343fdf20502`; companion là [backend PR #78](https://github.com/chung6a8m/MyDmsVn/pull/78). Không force-push hoặc đổi main. Trạng thái chưa push/hosted CI NOT RUN ở các checkpoint trước là lịch sử, được cập nhật bằng kết quả thực bên dưới.

Independent pre-merge review toàn bộ frontend diff không có actionable finding; đối chiếu cả manifest/result contract backend, CI, mode rejection, stable-line error, refetch trước activation và retained-control count/hidden assertions. Review được ghi thành [GitHub COMMENT](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/17#pullrequestreview-5727848173), không phải GitHub approval hoặc Owner acceptance. Backend review cũng không có finding. Chỉ bổ sung tài liệu publication sau source đã kiểm chứng; không chạy lại SQL/browser live chỉ để tạo PR.

Hosted **push CI PASS** tại head `36728b1`: [run 41302091172](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/41302091172), job `124834989218`. Đã đọc logs: Ubuntu **24.04.5**, runner image **20261025.353.1**, Node **22.14.0**, npm **11.6.0**, Chromium **156.0.8078.4**. Locked install, typecheck, production build, **47 files / 763 unit-component PASS**, **full Chromium 134 PASS** (4.2m), **production isolation 1 PASS** (2.2s), 0 failed/skipped. Đây là một lượt full134 thực chạy trên Linux; không thay số liệu local133+focused1 của checkpoint trước. Warning dependency audit2 low/4 moderate và bundle >500kB giữ nguyên, không nâng pin hoặc suy production readiness.

Hosted **PR CI cũng PASS** tại cùng head `36728b1`: [run 41302133951](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/41302133951), job `124835127160`. Logs xác nhận **763 unit/component**, **full Chromium 134 PASS** (5.2m), **production isolation 1 PASS** (2.5s), typecheck/build PASS, 0 failed/skipped. Hai lượt push/PR là hai executions của cùng suites, không phải cộng thành số scenario khác nhau.

Backend GitHub inspection tại reviewed head `38e54e5`: **0 Actions workflows, 0 check runs, 0 commit statuses**, nên **CI NOT CONFIGURED / NOT RUN**, không PASS. Backend evidence ghi riêng review/publication; các kết quả net48/SQL/IIS Express ở §6 vẫn là local owned execution. Cả hai PR còn mở, F06/B04/B05 chưa DONE; Owner acceptance/merge và các giới hạn full IIS/production/attended input không thay đổi. CI trên từng head mới được kiểm tra qua PR checks; không dùng PASS của head cũ cho source mới.

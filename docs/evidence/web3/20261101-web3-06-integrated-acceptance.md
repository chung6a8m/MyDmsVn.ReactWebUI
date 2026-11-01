# WEB3-06 — frontend verification và checkpoint tích hợp

**Ngày:** 2026-11-01 (Asia/Bangkok). **F06 IN_PROGRESS — chưa nghiệm thu tích hợp, chưa DONE.** Owner chọn WEB3-06 và cho phép subagents. [Plan §7](../../plans/20261101-001-web3-goods-receipt-inventory-web.md#7-web3-f06--integrated-acceptance-ci-and-handoff) sở hữu trạng thái; [acceptance matrix](../../development/WEB3_ACCEPTANCE_MATRIX.md) sở hữu scenarios.

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

## 4. Review và gate tiếp tục

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

# WEB7-09 — Hướng dẫn nghiệm thu UI và handoff

**Ngày:** 2026-11-21 · **Owner scope:** `W7-INT-01..05`. [Owning roadmap](../plans/20261120-001-web7-product-shell-ui-lab.md#web7-09) · [Acceptance matrix](WEB7_ACCEPTANCE_MATRIX.md#5-nghiệm-thu-tích-hợp-và-handoff) · [candidate evidence](../evidence/web7/20261121-web7-09-integrated-ui-acceptance.md).

**Windows follow-up 2026-11-21.** PARTIALLY ACCEPTED. Edge Windows 318 PASS/1 SKIP/0 FAIL; native Edge 100%/125%/200% tại OS scale 100%; artifact 3/3. Telex theo Owner: E01 mất vị trí caret, E02 chưa đủ bằng chứng về composition, E03–E08 PASS. VNI và Narrator NOT RUN. [Biên bản Windows, kịch bản E01–E08 và Narrator](../evidence/web7/20261121-web7-09-windows-physical-acceptance.md). PR #54 đã merge ở `786e85cf`; [CI sau merge](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44888833158) SUCCESS.

## 1. Mở Product và UI Lab đúng runtime

**Product (HTTP thật):** `/` khởi tạo `ApplicationEntry`, yêu cầu HTTPS same-origin host, `net48` API/SQL và JWT/refresh theo [WEB2 contract](../design/WEB2_FRONTEND_INTEGRATION.md). Không có fake fallback khi dùng `npm run dev`; một Vite server đơn lẻ sẽ không tạo ra môi trường nghiệm thu nghiệp vụ thật. Để kiểm tra HTTP/SQL thật phải dùng fixture/runbook của owning WEB2/WEB4/WEB6, không trỏ thử vào dữ liệu sản xuất.

**UI Lab (chỉ DEV, fake explicit):** sau `npm ci` và `npm run dev` mở:
- `/lab/components` — catalog primitives/controls/recipes; `?entry=date-field` cho DateField; `?entry=decimal-input` nếu catalog cho phép; entries ngoài allowlist quay về fallback an toàn.
- `/lab/sales` — Sales fake scenarios và diagnostic snapshot/mark.
- `/lab/receipts` và `/lab/inventory` — feature thực dùng fake ports riêng.
- `/lab/recipes/filters` — read states loading/empty/error/forbidden, committed filters.
- `/lab/recipes/document-edit` — Goods Receipt document session/dirty/close admission qua feature thực.

Lab không kiểm chứng SQL ledger, quyền server hay release. Product không chứa Lab/fake modules trong built artifact. Không nhầm `/lab/receipts` (feature thật + fake port) với receipt stub legacy dùng cho focused tests.

## 2. Automated candidate gates

Khóa toolchain: Node **22.14.0** (range `>=22.14.0 <23`), npm **11.6.0**; dùng lockfile. Lệnh Linux/CI:

```bash
npm ci
npm run typecheck
npm run build
npm run test:unit
npm run test:e2e -- --project=chromium --workers=2 --forbid-only
npm run test:e2e -- --config playwright.production.config.ts --workers=1 --forbid-only
```

Chạy focused `npm run test:e2e -- tests/e2e/web7-integrated-ui.spec.ts tests/e2e/product-shell.spec.ts tests/e2e/product-workspace-actions.spec.ts tests/e2e/ui-lab-catalog.spec.ts tests/e2e/web3-receipt.spec.ts tests/e2e/web3-inventory.spec.ts --project=chromium --workers=2 --forbid-only` khi sửa boundary; **để đánh giá candidate cuối vẫn lấy toàn bộ CI**. Giữ `test-results`/Playwright artifact khi FAIL, không tắt test hoặc tăng timeout chỉ để xanh. Không chỉnh Markdown lúc browser suite đang chạy (Vite/Tailwind có thể full reload).

**Windows Edge đã cài thật** (PowerShell, trong repo):

```powershell
node --version
npm.cmd --version
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e -- --config playwright.edge.config.ts --workers=2 --forbid-only
```

Edge config chọn `channel: msedge`; Chromium native zoom spec không được tính là Edge acceptance. Nếu Edge không cài/không chạy, ghi `NOT RUN` hoặc `BLOCKED` với môi trường và lỗi; không suy PASS từ CI Ubuntu.

## 3. Attended matrix (chạy trên Windows khi có người kiểm)

Với đúng candidate SHA, ghi Windows build/DPI, Edge `edge://version`, Node/npm, viewport và chế độ Light/Dark; dùng fixture dữ liệu giả riêng, không screenshot token/credential/hóa đơn thật.

| Nhóm | Kịch bản quan sát | Bằng chứng cần ghi |
|---|---|---|
| Desktop 1440×900, 1280×720 | Sales mới và Receipt mới nhập raw riêng; Inventory balances/card; split hai group; collapse sidebar; scroll grid; toolbar, popup và footer không che nhau, không có ngang trang | SHA, ảnh/chụp DOM, lỗi/focus, số request write |
| Narrow 768px và drawer 390px | Open/close sidebar/drawer, tab order, Escape trả focus, active tab/breadcrumb đúng, quay lại chứng từ còn raw | SHA, width, panel/session ID trước/sau, video/ảnh khi lỗi |
| Light/Dark + popup | Header/form/grid/DateField/calendar/lookup/Menu/Dialog dễ đọc và focus ring rõ; popup không bị clipping cạnh Dockview/viewport; không mở hai popup chủ quản lý cùng lúc | Browser/OS/scale, trạng thái, ảnh lỗi |
| Native Edge zoom 125%/200% | Dùng chính zoom của Edge (không phải CSS/viewport emulation), ghi zoom thực từ UI; kiểm tra field đang focus, nhập thêm một ký tự, menu/dialog và grid cuộn đúng | Zoom đọc từ Edge UI, session ID/raw, screenshot cho mỗi mức |
| Telex và VNI attended | Nhập tên dài có dấu, composition đang dở, arrows/Tab/Enter trong product lookup, date/decimal editors; Save ngay sau phím cuối đúng raw và đúng dòng | IME phiên bản/chế độ, key sequence, caret, selected ID/line ID, request count |
| Narrator attended | Dùng Windows Narrator để duyệt sidebar icon-only, header/breadcrumb, labels/helper/errors, validation summary, calendar/grid, drawer/menu/dialog; tên/role/announcements và focus return đúng | Narrator bật/thực chạy, announcements quan sát, phím, lỗi cụ thể |
| Auth/epoch/dirty/recovery | Đổi quyền/actor/epoch theo fixture độc lập; close/reset/logout Cancel không bỏ raw/unknown; không dispatch write vì chỉ mở menu/dialog | Fixture/control owner, session/operation ID đã ẩn thông tin nhạy cảm, requests observed |

**STOP/P1:** mất raw/session hoặc ghi sai chứng từ/quyền; tự phát Write/Save/Post; unknown mutation được tự retry/unlock; fake import vào production; close bypass admission; focus/popup che thao tác trọng yếu. Với lỗi khác, ghi mức P2/P3, reproducer, ticket/owning task và regression trước khi đổi kết luận.

## 4. Biên bản kết quả và kết luận

Mỗi lượt ghi: commit **exact HEAD**, `package-lock` hoặc lock không đổi, lệnh, số test thực chạy PASS/FAIL/SKIP/retry, browser build/version, runner/OS, dimensions + zoom thật, fake/HTTP/SQL phân biệt, flags, ảnh/log không có secrets và danh sách findings. Ghi riêng `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`, `NOT APPLICABLE`; không gọi kiểm tra không thể thực hiện là ngoại lệ Owner accepted khi Owner chưa chấp thuận riêng.

Khi source regression đã sửa, kiểm tra lại **HEAD cuối** (source và docs) qua required CI; kết quả commit trước chỉ giữ provenance. Independent review source/UX là gate khác với CI. Sau đó cập nhật [evidence WEB7-09](../evidence/web7/20261121-web7-09-integrated-ui-acceptance.md), [owning plan](../plans/20261120-001-web7-product-shell-ui-lab.md) và selector; roadmap chỉ archive nếu Owner yêu cầu.

**Không thay disposition WEB6:** cutover FAIL/FailedRetained, workload/recovery NOT RUN/NOT MEASURED, `CandidateVerified` absent; ordinary resend OFF, staging NOT ACCEPTED, production NO-GO. UI acceptance không phải phê duyệt production.

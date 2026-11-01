# WEB3-01 — Contract/architecture checkpoint

**Ngày:** 2026-11-01, Asia/Bangkok. **Task:** WEB3-F01 trong [owning plan](../../plans/20261101-001-web3-goods-receipt-inventory-web.md#web3-01-checkpoint--2026-11-01), cùng B01 backend do Owner cho phép mở rộng trong phiên này. **Phạm vi:** source/architecture checkpoint, canonical wire/corpus, immutable frontend consumption, kiểm tra hợp đồng SQL-free và tài liệu. Trạng thái merge/acceptance nằm trong hai owning plans. Không có WEB3 runtime/browser/HTTP/SQL acceptance.

## 1. Candidate và môi trường

| Thành phần | Mốc kiểm tra |
|---|---|
| Web baseline | `8163dc99500ffffc94a3aa6a9c87e25e3db49726`, clean `main` khi bắt đầu; khớp `git ls-remote origin refs/heads/main` |
| Backend baseline | `8b599c782816d9cd64f04a45d809a2b8eb1235c8`, clean `main` tại `C:/MyData/2026/MyDmsVn/CleanArchitecture`; khớp remote main trước B01 |
| Backend corpus revision | `d2d4b5e799916d058a90149331ac15345248d025`; SHA-256 từng file trong [provenance](../../../tests/fixtures/web3-v1/provenance.json); branch `codex/web3-01-contract-freeze`, commit local, chưa publish |
| Web candidate / branch | `codex/web3-01-contract-checkpoint`; final source/test commit được ghi ở mục 4 sau local commit; không push/PR/merge |
| OS | Windows 11 Home Single Language, `10.0.26300`, build `26300` |
| Toolchain thực đọc | Node `v22.14.0`, npm `11.6.0`; `npm.cmd ls --depth=0` exit 0 |
| Browser / host / SQL | Không khởi động; browser version không áp dụng cho kiểm tra tài liệu; không kết nối DB/host |

Package manifest/lock và installed inventory giữ nguyên: React/React DOM 19.3.1; TypeScript 5.9.3; Vite 8.3.5; Tailwind 4.3.3; Base UI 1.9.0; AG Grid Community/React 36.2.0; Dockview/React 8.8.2; Floating UI React 0.27.20; TanStack Query 5.105.0; Zustand 5.0.16; Zod 4.6.7; Vitest 5.0.5; Playwright 1.64.1. `components.json` vẫn `base-nova`, neutral, CSS variables, lucide. Không cài/nâng package.

Đã đối chiếu declaration trong dependency đang cài: Dockview `dist/cjs/api/component.api.d.ts` mô tả remove event có thể xảy ra khi move, `fromJSON/toJSON`; AG Grid `gridApi.d.ts:748` có `stopEditing(cancel?)`, `gridOptions.d.ts:2182` có `getRowId`; Floating UI `floating-ui.react.d.ts` có `useFloating`, `useDismiss`, `FloatingFocusManager`. Đây là kiểm tra API source/type; không chứng minh DOM/focus acceptance. Không suy ra một cancelable Dockview remove hook chưa có trong type.

## 2. Deliverable và nguồn sở hữu

- [Workspace design](../../design/WEB3_MULTI_MODULE_WORKSPACE.md): source→ownership/call-site matrix; records/document/read-only identity, captions, singleton policy; adapter đóng có identity cụ thể, all-module admission; module→HTTP feature mapping; v1 sanitizer thực tế và quyết định v2/retention. Sales/Receipt giữ store, raw normalization, validation, command/recovery riêng.
- [Receipt/Inventory design §9](../../design/WEB3_GOODS_RECEIPT_INVENTORY_UI.md#9-f01-sourcewire-checkpoint--2026-11-01): DTO/source→wire matrix, pre-commit Save materialization và ID mới khi replace lines; paging/filter/order, permission/error mapping; C01–C05 resolutions và manifest/consumer ownership.
- [Immutable corpus](../../../tests/fixtures/web3-v1/README.md) và [test tương thích](../../../tests/unit/http/web3ContractCheckpoint.test.ts): dùng nguyên validator/JSON từ backend, kiểm hash trước khi chạy; test primitive/envelope/error/arithmetic hiện có, không triển khai F03 codec.
- [Plan](../../plans/20261101-001-web3-goods-receipt-inventory-web.md): trạng thái F01/gate và thứ tự PR hai repo. Handoff/index/README/AGENTS chỉ dẫn lại tài liệu sở hữu; không nhân bản payload spec.

Hai subagent đã rà soát workspace và backend; một reviewer độc lập kiểm tra checkpoint/corpus. Parent đối chiếu lại DTO, repository Save/query, error mapper, auth/transport và dependency types. B01/corpus chưa tồn tại tại baseline: Owner đã chọn **“Thực hiện thêm backend B01 để hoàn tất gate WEB3-01”**, sau đó backend tạo canonical corpus riêng. Web chỉ consume pin, không sở hữu trạng thái B tasks.

Điểm cần phân biệt với assumptions ban đầu: v1 **drop/prune unknown components**, không reject mọi unknown; regex v1 nhận đến 64 chữ số nên migration v2 phải kiểm int64 thật. `shared/grid/editorBarrier.ts` vẫn Sales-specific. `TotalCount` là long; serializer bỏ null; average có scale 8; Receipt SQL DateTime có Kind unspecified. Các điểm này được ghi vào thiết kế/gate, chưa sửa runtime.

## 3. Kiểm tra đã thực hiện

Các lệnh đọc/checkpoint:

```powershell
git status --short --branch
git rev-parse HEAD
git ls-remote origin refs/heads/main
git -C ../CleanArchitecture status --short --branch
git -C ../CleanArchitecture rev-parse HEAD
git -C ../CleanArchitecture ls-remote origin refs/heads/main
node --version
npm.cmd --version
npm.cmd ls --depth=0
git -C ../CleanArchitecture ls-tree -r --name-only HEAD -- docs/contracts/web3-v1
git diff --check
npm.cmd run test:unit -- tests/unit/http/wire.test.ts tests/unit/http/web3ContractCheckpoint.test.ts
npm.cmd run typecheck
node tests/fixtures/web3-v1/validate-corpus.mjs
node --test tests/fixtures/web3-v1/validate-corpus.test.mjs
```

`rg` và `Get-Content` được dùng để đối chiếu source/type/test paths đã liệt kê trong hai design. Lần dò đường dẫn có `scripts`, `CommonContracts.cs`, `ApiExceptionHandler.cs`, `CatalogController.cs` không tồn tại; đã chuyển sang `rg --files` và đọc đúng source. Probe dependency bằng Python lần đầu dùng encoding mặc định Windows gây UnicodeDecodeError; chạy lại UTF-8 đối chiếu **32/32** manifest/lock/installed pins, không mismatch. Không tính lệnh tìm không thấy hoặc probe lỗi như test PASS.

| Kiểm tra | Kết quả / số thực chạy |
|---|---|
| Local/remote baseline hai repo | Khớp 2/2 SHA; cả hai sạch trước task |
| Installed dependency inventory | `npm.cmd ls --depth=0` exit 0; không missing/invalid |
| Backend canonical corpus / Web mirror | Final pin `d2d4b5e…`: **32 golden fixtures PASS**; **36/36** copied JSON/MJS files byte-identical với `git show` tại pin, SHA-256 khớp provenance |
| Corpus semantic controls | **29 positive / 68 negative / 85 scalar / 4 rounding** đạt kỳ vọng; **601** dòng thực được mở rộng (200+200+201), **15** lifecycle assertions PASS; không phải HTTP/SQL calls |
| Canonical Node test suite chạy từ mirror | **8 discovered / 8 executed / 8 PASS / 0 FAIL / 0 SKIP**; cùng oracle backend, không cộng thành 16 case khác nhau |
| Diff / UTF-8 no BOM / LF / local links / source line anchors | PASS: **49 text files**, **11 Markdown documents**, **170 local links**, **15 pinned backend links**, **60 line anchors**, **9 heading anchors**; kiểm tra đích nguồn local và `git diff --check`, không tuyên bố publish URL |
| Frontend unit tests — final combined run | **114/114 PASS, 0 FAIL/SKIP**: WEB2 wire **28** + WEB3 compatibility **86**, 2 files, Vitest 386 ms. Draft trước review có 83 WEB3 cases; đã cập nhật theo corpus cuối |
| Typecheck | **PASS** sau final pin; không emit |
| Build, fake browser, production artifact | **NOT RUN** — không sửa `src/`/dependency hoặc browser behavior |
| Backend .NET / SQL / live HTTPS / Chromium / Edge | **0 executed / NOT RUN** |
| Attended IME/Telex/VNI/Narrator | **NOT RUN**; không dùng evidence WEB1/WEB2 thay candidate mới |

Không có runtime behavior fix nên không có RED→GREEN runtime claim. Test mới kiểm compatibility và corpus semantic cases, không test số file/config/Tailwind. Các test chỉ được đọc source ở hai design vẫn là danh mục cho các task sau; không chuyển thành PASS.

Review đã sửa mâu thuẫn v1 unknown-component handling giữa design/acceptance/plan. Review corpus tách một fixture trộn validation/handler/Post errors thành các phản hồi khả thi theo route; xác minh lại giới hạn sequence `9999999999 NO CYCLE` thay vì suy từ `D10`. Cross-response validation được bổ sung kiểm Create/Update header và thứ tự Product/Quantity/UnitCost so với request. Đây là correction ở hợp đồng/test oracle, không phải lỗi HTTP đã tái hiện trên server.

Probe production modules qua Vite SSR xác nhận giới hạn reuse: `utcSchema` nhận 8 fraction digits, `profitSchema` nhận `-0`, `priceSchema` nhận decimal 65 ký tự; count zero/signed quantity/canonical version cần schema riêng. Design đã ghi nghĩa vụ F03; test canonical đầy đủ vẫn từ chối input ngoài WEB3, không nới corpus để chiều theo Sales.

## 4. Trạng thái gate và cleanup

[Register C01–C05](../../design/WEB3_GOODS_RECEIPT_INVENTORY_UI.md#discrepancy-register--b01-resolutions) ghi quyết định long total string, explicit null projection, decimal/UTC, error corpus và canonical pin. Không còn cần tự đoán các projection này; merge/acceptance checkpoint vẫn do owning plans ghi nhận. B02/B03 phải triển khai mapper/route/least-privilege grants và kiểm SQL thật. F02–F06 chưa triển khai; corpus consistency không thay các gate đó.

Exit kỹ thuật F01 đã có: source→contract/ownership matrix, module descriptors/close/layout decisions, canonical fixture manifest và pin, thứ tự PR hai repo, review độc lập và kiểm chứng corpus/primitive tương ứng. F01/B01 vẫn **IN_PROGRESS — checkpoint verified, pending merge/acceptance**, đúng policy cập nhật DONE tại merge/acceptance; không ghi Owner đã nghiệm thu kết quả chưa được duyệt. Manifest SHA-256 `2e11b7299397d832ff23c5dd8071d3048962cf0991aaf7647cb9adfcdc3e5fc3`.

Chỉ chạy Node/Python/Vitest/typecheck; không mở browser/server/SQL fixture, không đọc/lưu credentials/JWT/cookies/HAR/trace. Canonical Node tamper test dọn thư mục tạm do chính test tạo. Backend thay đổi chỉ hợp đồng/tài liệu/test oracle, không C#/grants/schema/WinForms; Web không sửa `src/`/dependency. WEB1/WEB2 evidence và layout keys giữ nguyên. Full IIS, production, durable drafts/idempotency, audit retention và distributed limiter không thuộc thay đổi này.

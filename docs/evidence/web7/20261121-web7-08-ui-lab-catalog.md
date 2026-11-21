# WEB7-08 — UI Lab Catalog & Recipes

**Ngày:** 2026-11-21 · **PR:** [#53](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/53) · **Branch:** `codex/web7-08-ui-lab-catalog-recipes`.

**Trạng thái:** SOURCE IMPLEMENTED / CI & REVIEW PENDING. Bản ghi này không tuyên bố browser PASS hoặc production release.

## Phạm vi và ownership

- **W7-LAB-01:** catalog DEV-only ba nhóm `primitives / controls / recipes`; metadata ID/purpose/source/consumer/states/keyboard/validation/test paths. Planned entries có nhãn rõ, không giả lập component Enterprise.
- **W7-LAB-02:** `GoodsReceiptDocumentPanel`, `GoodsReceiptListPanel`, `StockBalancesPanel`, `StockCardPanel` thật từ `src/features/`, AG Grid, shared forms/inputs; recipe Filter Results và Document Edit đi qua fake `GoodsReceiptPort`, `InventoryPort` và catalog riêng. Không lấy `receiptWorkspaceStub.ts` làm bằng chứng nghiệp vụ.
- **W7-LAB-03:** DateField/DecimalInput/DocumentField/ReadState có ví dụ từng state đã được bổ sung trong 04–07; metadata link đến ProductLookup field/cell/Modal, workspace actions và keyboard. Primitive Button/Input/Dialog/NativeSelect dùng cùng export production.
- **W7-LAB-04:** `/lab/sales`, `/lab/components` được giữ; thêm `/lab/receipts`, `/lab/inventory`, `/lab/recipes/filters`, `/lab/recipes/document-edit`. Search `entry` allowlist + fallback Button; chỉ route DEV dynamic import trong `src/app/router.tsx`.

Legacy Lab Sales/Receipt stub được giữ tách biệt để không phá harness/test trước. Feature runtime thứ hai chỉ tạo khi đi vào route mới; retention giữ `workspace`, `QueryClient`, fake actor và readonly storage `null` cho page lifetime. `beforeunload` kiểm tra dirty/blocked trên **cả hai runtime**, route change không dispose sessions. `WorkspaceHost` vẫn điều phối Dockview và admission. Selector latency/empty/error/forbidden không tự dispatch mutation; read 403 được feature fence, muốn mô phỏng regrant phải đóng tab bằng admission rồi mở lại.

## Verification ledger

| Gate | Kết quả hiện tại | Evidence |
|---|---|---|
| Source/route/port review | SOURCE IMPLEMENTED | GitHub PR #53; compare `main` `b0a30085311458172154b537f48e259d164a9b3d` |
| `npm ci`, typecheck, build | PENDING trên HEAD cuối | CI `Web checks`; old run [#44877381690](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44877381690) FAIL typecheck do `defaultOpen` trên native `details`, đã sửa commit tiếp theo. Không dùng run cũ làm PASS |
| Unit/component | NOT YET VERIFIED | `tests/unit/lab/catalogEntries.test.ts`, `featureFakePorts.test.ts` + toàn bộ suites |
| Chromium | NOT YET VERIFIED | `tests/e2e/ui-lab-catalog.spec.ts`, `runtimeIsolation.spec.ts`, `lookup-grid.spec.ts`, toàn bộ regression |
| Production isolation built assets | NOT YET VERIFIED | Gate CI hiện hữu; `src/app/router.tsx` DEV guard không thay |
| Windows Edge, attended Telex/VNI/Narrator, SQL/IIS/production | NOT RUN / OUT OF SCOPE | Không mượn evidence lịch sử; WEB6 staging NOT ACCEPTED / production NO-GO, ordinary resend OFF |

## Review focus

1. `LabFeatureScope` có provider/query cache/actor riêng, legacy Lab retained và `beforeunload` không mất dirty khi chuyển route. `WorkspaceExtensionsContext` rỗng trong feature recipe để receipt stub không override real panels.
2. Read mode switch chỉ cancel/invalidate read, không unmount document, tạo fake HTTP hoặc tự retry write. Inventory UTC decimal strings giữ chính xác.
3. Deep link chỉ vào entry allowlist; không import động path tùy ý hoặc mock Enterprise. `src/app/router.tsx` chỉ import Lab trong DEV; built production phải được CI kiểm chứng.
4. Phân biệt fixture/fake test và real SQL; không mở WEB6 acceptance/release.

**Sau CI:** ghi exact source+docs SHA, run ID, Node/browser, số tests/thực chạy và kết quả khi đã có dữ liệu; review độc lập trước merge, sau đó WEB7-09 tích hợp acceptance.

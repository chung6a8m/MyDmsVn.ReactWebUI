# WEB7-08 — UI Lab Catalog & Recipes

**Ngày:** 2026-11-21 · **PR:** [#53](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/53) · **Branch:** `codex/web7-08-ui-lab-catalog-recipes`.

**Trạng thái hiện hành:** DONE / PR #53 MERGED ngày 2026-11-21, bounded frontend fake scope. Bảng CI phía dưới là **historical implementation checkpoint** trước review; closeout cuối được ghi tại phụ lục. Không tuyên bố Edge/SQL/IIS hay production release.

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
| `npm ci`, typecheck, build | PENDING trên HEAD cuối | CI `Web checks`; old run [#44877381690](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44877381690) FAIL typecheck do `defaultOpen` trên native `details`; fixed. First full run [#44877551775](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44877551775) PASS typecheck/build/unit, Chromium 313/317 PASS (4 FAIL), artifact SKIPPED. Không dùng run FAIL làm PASS |
| Unit/component | NOT YET VERIFIED | `tests/unit/lab/catalogEntries.test.ts`, `featureFakePorts.test.ts` + toàn bộ suites |
| Chromium | NOT YET VERIFIED | `tests/e2e/ui-lab-catalog.spec.ts`, `runtimeIsolation.spec.ts`, `lookup-grid.spec.ts`, toàn bộ regression |
| Production isolation built assets | NOT YET VERIFIED | Gate CI hiện hữu; `src/app/router.tsx` DEV guard không thay |
| Windows Edge, attended Telex/VNI/Narrator, SQL/IIS/production | NOT RUN / OUT OF SCOPE | Không mượn evidence lịch sử; WEB6 staging NOT ACCEPTED / production NO-GO, ordinary resend OFF |

## CI finding & scoped follow-up

- Run `44877551775` found 4 failures: `foundation.spec.ts` grid height 87px instead of >=200, two `lookup-grid.spec.ts` pointer intercept/timeouts from toolbar (all three due catalog detail injecting extra vertical space into old Components Lab geometry); `ui-lab-catalog.spec.ts` missing explicit unknown-entry fallback.
- Fix: catalog detail only mounts on explicit `?entry=`, leaving legacy `/lab/components` viewport geometry unchanged; route retains raw requested token only to display fallback, while rendering is still strictly allowlisted by `findCatalogEntry`. No baseline asserts removed/relaxed, no browser PASS claimed before new run.

## Review focus

1. `LabFeatureScope` có provider/query cache/actor riêng, legacy Lab retained và `beforeunload` không mất dirty khi chuyển route. `WorkspaceExtensionsContext` rỗng trong feature recipe để receipt stub không override real panels.
2. Read mode switch chỉ cancel/invalidate read, không unmount document, tạo fake HTTP hoặc tự retry write. Inventory UTC decimal strings giữ chính xác.
3. Deep link chỉ vào entry allowlist; không import động path tùy ý hoặc mock Enterprise. `src/app/router.tsx` chỉ import Lab trong DEV; built production phải được CI kiểm chứng.
4. Phân biệt fixture/fake test và real SQL; không mở WEB6 acceptance/release.

**Sau CI:** ghi exact source+docs SHA, run ID, Node/browser, số tests/thực chạy và kết quả khi đã có dữ liệu; review độc lập trước merge, sau đó WEB7-09 tích hợp acceptance.

## Final independent review / CI / merge closeout (2026-11-21)

- [Review PR #53](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/53#pullrequestreview-6003752017) xác định một P2: đổi scenario read bị giữ cached success khi chờ latency; sửa trong `0bd2086`, regression thật Receipt/AG Grid và fake latency trong `f1cefe1`. Không bỏ assertion stale-row.
- **Exact final source+docs HEAD:** `f1cefe12df3a077c49f071022f4a0ad4384a5c42`; [Web checks #44879190230](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44879190230) **SUCCESS**: locked install/typecheck/build, **1,839 unit/component PASS / 1 SKIP** (101 test files), **317/317 Chromium PASS**, **3/3 production artifact PASS**. Earlier FAIL/CANCELLED runs above are not final-HEAD acceptance.
- **PR #53 MERGED**, merge SHA `4171aff4dd71299f5b7cb5a2217a76a624e42c07`; [main push CI #44880270205](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44880270205) SUCCESS.
- Scope: DEV Lab catalog/recipes/fake ports, bounded source/CI/Chromium/artifact; **NOT RUN:** native Windows Edge, attended Telex/VNI/Narrator, live IIS/SQL, production. WEB6 and ordinary resend OFF unchanged. WEB7-09 owns integrated acceptance on its own candidate, not this evidence.

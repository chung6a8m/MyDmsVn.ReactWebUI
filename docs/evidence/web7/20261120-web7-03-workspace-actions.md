# WEB7-03 — Workspace Actions

**Ngày:** 2026-11-20 · **Task:** WEB7-03 · **Acceptance:** W7-CMD-01–06 · **Checkpoint:** IMPLEMENTED / PRE-REVIEW DOCS-HEAD CI VERIFIED on `5a859e62`; independent review fixes applied; PR #48 IN_REVIEW, **post-review final-head CI required before merge**.

## 1. Scope và provenance

- Repository: `chung6a8m/MyDmsVn.ReactWebUI`; base `main` sau WEB7-02 merge; [PR #48](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/48), branch `codex/web7-03-workspace-actions`.
- Source checkpoint trước cập nhật docs: `d7b825b791a7531b64c9aaf959c7742dca826752`; final candidate là HEAD thực tế của PR sau cập nhật tài liệu. Không sửa dependency, lockfile, backend, API hoặc IndexedDB schema.
- Stack giữ `base-nova`/Base UI Menu, Tailwind v4, Dockview/AG Grid. Không chạy generator, không tạo package mới.

## 2. Phạm vi triển khai và acceptance

| ID | Thay đổi / oracle |
|---|---|
| W7-CMD-01 | Product: Sidebar gọi `openPanel(module)` theo Read, Header dùng menu `Tạo chứng từ` theo Write độc lập Read; `ProductionWorkspace` bỏ nhóm nút mở module bị lặp, `WorkspaceHost` chỉ render menu action + LocalDraftControls trong Product. Lab giữ toolbar pilot để focused tests. |
| W7-CMD-02 | `WorkspaceActions.tsx` capture actor/scope + panel id/module/kind tại thời điểm mở menu, recheck trước dispatch để từ chối target đã đổi, actor cũ hoặc layout/close busy. Inventory không fallback sang Sales. |
| W7-CMD-03 | Split, Close current, Close All, Restore Layout, Reset Layout gọi `panelRegistry`/`workspaceController`/`workspaceLayouts` hiện có; không tạo code Save/Post hoặc dispose session khi chuyển group; một dispatch per menu opening, IME/repeat key protection. |
| W7-CMD-04 | Entry `Bản nháp trên thiết bị`/đối soát luôn mounted ngoài popup; `LocalDraftControls` giữ `finalFocus` về opener. `WorkspaceProvider` cấp scoped ref tới trigger menu còn mounted để `CloseDocumentDialog` trả focus khi Cancel/Save; `RecoverySupport` giữ Cancel initial focus + consent/one-shot flow. Không tạo menu/drawer lồng focus trap. |
| W7-CMD-05 | Pending/UNKNOWN vẫn do document close admission/operation state sở hữu; các lệnh layout không tự retry mutation. Unit scope/lock và regression Product/Lab kiểm tra không mất raw/session. |
| W7-CMD-06 | Write-only Sales/Receipt tạo trực tiếp từ header ngay cả sau Inventory Read, không kích hoạt GET danh sách; deny Read ẩn sidebar item, không disable mọi module. |

Files thực: `src/app/workspace/WorkspaceActions.tsx` (new), `WorkspaceHost.tsx`, `ProductionWorkspace.tsx`, `WorkspaceContext.tsx`, `CloseDocumentDialog.tsx` (focus fallback); `ProductHeader.tsx`, `ProductSidebar.tsx`, `moduleNavigation.ts` reuse từ WEB7-02, không viết lại. Thêm `tests/components/WorkspaceActions.test.tsx`, `tests/e2e/product-workspace-actions.spec.ts`, `tests/e2e/helpers/productActions.ts`; di chuyển selectors ở suite Product, giữ nguyên Lab assertions. Không sửa `LocalDraftControls.tsx`/`RecoverySupport.tsx` vì cơ chế stable opener/finalFocus có sẵn.

## 3. Bằng chứng CI và independent review

**Lần kiểm chứng đầu:** [workflow #44751781537](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44751781537), SHA `6fbab63cf956a5f3a02b9c5a8bd18141482e8489`, Ubuntu GitHub-hosted, locked npm, Playwright Chromium DEV + HTTP fixture:

- Typecheck **PASS**; production build **PASS**.
- Vitest **1.803 PASS, 1 SKIP** trên 92 test files.
- Chromium **292 PASS / 6 FAIL (298 total)**. Sáu lỗi nằm ở *selector/expectation* còn trỏ nút pilot Product: 4 ca WEB5 tìm `Sales mới` button, 1 ca WEB7 diagnostics tương tự, 1 helper Inventory giả định Read icon luôn visible dù grant denied. Không kết luận runtime regression từ các lỗi này. Log/traces ở workflow.
- Đã sửa cả sáu trong các thay đổi tiếp theo (dùng menu create và shell-ready assertion; giữ oracle original operation count, no resend, actor/epoch/raw). Không bỏ test hoặc nới tiêu chí nghiệp vụ. **Cần final HEAD CI chứng minh sửa thành công.**

**Lượt kiểm chứng sau sửa selector DEV:** [workflow #44756039305](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44756039305), source HEAD `4dcd509a`: typecheck/build PASS; **1.803 unit PASS / 1 SKIP**; Chromium DEV mock-HTTP **298/298 PASS**, gồm W7-CMD-04 return-focus fallback. Bước production artifact **1/3 PASS, 2 FAIL** tại hai selector `Sales mới` cũ trong `tests/production/runtimeIsolation.spec.ts` (không phải runtime mismatch). Hai selector đã được chuyển sang cùng helper Product Header `createProductDocument` tại commit `53e356d5`. Vẫn cần xác nhận final HEAD chạy lại đủ cả ba production tests và toàn bộ pipeline, không suy ra PASS từ DEV-only.

**Source candidate verified:** [Web checks #44758237005](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44758237005) trên chính commit `609970b0e383f46b7757bddfb22c273805aa56fc` — Ubuntu 24.04, Node 22.14.0/npm 11.6.0, `npm ci` PASS, `npm run typecheck` PASS, `npm run build` PASS; `npm run test:unit`: **1.803 PASS / 1 SKIP (92 files)**; `npm run test:e2e -- --project=chromium --workers=2 --forbid-only`: **298/298 PASS** (HTTP stub DEV); `npm run test:e2e -- --config playwright.production.config.ts --workers=1 --forbid-only`: **3/3 PASS** trên built artifact. Không có failure còn mở trên source SHA này. Sau cập nhật tài liệu, phải kiểm chứng riêng docs-inclusive HEAD; không kế thừa tự động PASS nếu code/runtime thay đổi.

**Pre-review docs-inclusive candidate:** [Pre-review docs-inclusive Web checks #44761375606](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44761375606) on `5a859e62` đạt npm ci/typecheck/production build, **1.803 unit PASS + 1 SKIP**, **298/298 Chromium PASS**, **3/3 built-artifact PASS**. Kết quả này chỉ áp dụng cho commit trước independent review.

**Independent review — 2026-11-20:** Đã comment hai P2 trong PR #48: (1) `Ctrl+Alt+W` dùng chung close reason `command` với menu làm `finalFocus` trả sai về menu trigger khi Cancel; (2) IME/repeat guard gắn vào `onKeyDown` bubbling thay vì capture, có thể chạy sau handler của menu item. Đã sửa bằng close reason `shortcut`, `onKeyDownCapture` và ba browser regression: keyboard Cancel trả focus về editor, menu Close-All Cancel trả về trigger sau admission, IME/repeat Enter không kích hoạt lệnh. Source fixes trong review đến `d3b7b0f` và follow-up focus admission `57cee755`; **CI của post-review docs-inclusive HEAD cần xác nhận trên chính commit đó trước merge**. Theo dõi workflow mới nhất từ [PR #48](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/48/checks); không kế thừa kết quả của SHA cũ.


**Full-CI regression checkpoint (2026-11-20):** [Web checks #44766896210](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44766896210) trên `2d8070d`: npm ci/typecheck/build, Vitest PASS (1.803 PASS, 1 SKIP); Chromium **300/301 PASS, 1 FAIL** ở W7-CMD-04 `menu Close All Cancel returns focus after releasing close admission`. Original button `disabled` trong khi close-all giữ `close.busy`; Base UI không focus được trigger khi dialog unmount, dù trigger được bật lại sau đó. Đây là regression thực được test mới phát hiện, **không** phải stale selector. Production artifact chưa chạy (skipped bởi failure). Fix follow-up `57cee755` giữ nguyên native disabled/busy guards và bổ sung một frame focus restoration sau khi `close.respond` và close-all release, với `isConnected`, `disabled`, `busy` và `decisions` guards; không focus vượt qua nested confirmation hoặc từ shortcut. Toàn bộ pipeline phải chạy lại trên **final docs-inclusive HEAD**, không được ghi PASS từ checkpoint lỗi.

## 4. Giới hạn và handoff

- Chỉ source/unit và browser **mock HTTP / DEV** trên GitHub Actions Linux; không chạy SQL/IIS/live HTTP acceptance, Edge, Windows real zoom, IME/Narrator attended. Không gộp kết quả WEB6 từ SHA cũ vào candidate WEB7-03.
- Không thay JWT/cookie/authorization backend, durable draft, operation fingerprint, idempotency hoặc resend gate. Ordinary resend vẫn OFF, staging NOT ACCEPTED, production NO-GO theo WEB6.
- PR #48 giữ trạng thái IN_REVIEW cho tới khi docs-inclusive HEAD CI và review PASS; không tự merge. Nếu xuất hiện finding mới phải sửa, chạy lại đúng HEAD và cập nhật evidence/risk.

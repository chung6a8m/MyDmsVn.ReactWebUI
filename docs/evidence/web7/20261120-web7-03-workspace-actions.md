# WEB7-03 — Workspace Actions

**Ngày:** 2026-11-20 · **Task:** WEB7-03 · **Acceptance:** W7-CMD-01–06 · **Checkpoint:** IMPLEMENTED / PR #48 DRAFT; **final HEAD CI PENDING, không ghi DONE**.

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
| W7-CMD-04 | Entry `Bản nháp trên thiết bị`/đối soát luôn mounted ngoài popup; `LocalDraftControls` giữ `finalFocus` về opener, `RecoverySupport` giữ Cancel initial focus + consent/one-shot flow. Không tạo menu/drawer lồng focus trap. |
| W7-CMD-05 | Pending/UNKNOWN vẫn do document close admission/operation state sở hữu; các lệnh layout không tự retry mutation. Unit scope/lock và regression Product/Lab kiểm tra không mất raw/session. |
| W7-CMD-06 | Write-only Sales/Receipt tạo trực tiếp từ header ngay cả sau Inventory Read, không kích hoạt GET danh sách; deny Read ẩn sidebar item, không disable mọi module. |

Files thực: `src/app/workspace/WorkspaceActions.tsx` (new), `WorkspaceHost.tsx`, `ProductionWorkspace.tsx`; `ProductHeader.tsx`, `ProductSidebar.tsx`, `moduleNavigation.ts` reuse từ WEB7-02, không viết lại. Thêm `tests/components/WorkspaceActions.test.tsx`, `tests/e2e/product-workspace-actions.spec.ts`, `tests/e2e/helpers/productActions.ts`; di chuyển selectors ở suite Product, giữ nguyên Lab assertions. Không sửa `LocalDraftControls.tsx`/`RecoverySupport.tsx` vì cơ chế stable opener/finalFocus có sẵn.

## 3. Bằng chứng CI đã thu và phần còn chờ

**Lần kiểm chứng đầu:** [workflow #44751781537](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44751781537), SHA `6fbab63cf956a5f3a02b9c5a8bd18141482e8489`, Ubuntu GitHub-hosted, locked npm, Playwright Chromium DEV + HTTP fixture:

- Typecheck **PASS**; production build **PASS**.
- Vitest **1.803 PASS, 1 SKIP** trên 92 test files.
- Chromium **292 PASS / 6 FAIL (298 total)**. Sáu lỗi nằm ở *selector/expectation* còn trỏ nút pilot Product: 4 ca WEB5 tìm `Sales mới` button, 1 ca WEB7 diagnostics tương tự, 1 helper Inventory giả định Read icon luôn visible dù grant denied. Không kết luận runtime regression từ các lỗi này. Log/traces ở workflow.
- Đã sửa cả sáu trong các thay đổi tiếp theo (dùng menu create và shell-ready assertion; giữ oracle original operation count, no resend, actor/epoch/raw). Không bỏ test hoặc nới tiêu chí nghiệp vụ. **Cần final HEAD CI chứng minh sửa thành công.**

**Final candidate:** full GitHub Actions `npm ci`, `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run test:e2e -- --project=chromium --workers=2 --forbid-only`, production artifact isolation trên HEAD cuối PR. Tại checkpoint viết evidence, full Chromium rerun chưa có kết luận; xem checks ở PR #48, **không coi 292/298 là PASS**.

## 4. Giới hạn và handoff

- Chỉ source/unit và browser **mock HTTP / DEV** trên GitHub Actions Linux; không chạy SQL/IIS/live HTTP acceptance, Edge, Windows real zoom, IME/Narrator attended. Không gộp kết quả WEB6 từ SHA cũ vào candidate WEB7-03.
- Không thay JWT/cookie/authorization backend, durable draft, operation fingerprint, idempotency hoặc resend gate. Ordinary resend vẫn OFF, staging NOT ACCEPTED, production NO-GO theo WEB6.
- PR #48 giữ DRAFT cho tới khi final HEAD CI và review PASS. Nếu browser thất bại phải sửa, chạy lại đúng HEAD, cập nhật evidence/risk, không đánh dấu DONE do compile xanh.

# WEB7-02 — Product Shell Nova/Base UI

**Ngày triển khai:** 2026-11-20 · **Task:** WEB7-02 · **Acceptance:** W7-SHL-01–06 · **Trạng thái checkpoint:** IMPLEMENTED / CODE VERIFIED / PR #47 IN_REVIEW (docs HEAD kiểm chứng riêng).

## 1. Provenance, candidate và phạm vi

- Repository: `chung6a8m/MyDmsVn.ReactWebUI`. PR [#47](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/47), branch `codex/web7-02-product-shell`; dựa trên `main` sau WEB7-01 merge `e6c822aa039173ebf38ec8b2599b43f1b062061f`.
- Source-candidate đã kiểm tra: `46ac2664418d44cf93de1baffe6d454585100620` ([GitHub commit](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/commit/46ac2664418d44cf93de1baffe6d454585100620)).
- Node `22.14.0`, npm `11.6.0`, Linux `ubuntu-24.04`; `npm ci` theo lockfile. Playwright Chromium trên runner; viewport `1440×900` và `390×780` trong các case mới. Browser tests sử dụng DEV server + HTTP stub, không phải API/SQL/IIS live.
- Dependencies **không thay**. `@base-ui/react 1.9.0`, `shadcn 4.23.0`, `base-nova`, Tailwind v4, AG Grid Community, Dockview, Floating UI giữ nguyên. Không chạy `shadcn init` hoặc generate registry mới. Bổ sung wrapper `src/components/ui/dropdown-menu.tsx` dùng installed Base UI Menu, reuse Button/Dialog; không sao chép ví dụ Radix `asChild`.

## 2. Implemented behavior và boundary

| Acceptance | Implementation / verification |
| --- | --- |
| W7-SHL-01 | Product Shell dùng Nova sidebar tokens, một nguồn ThemeContext Light/Dark, AG Grid/Dockview giữ theme; `src/app/shell/ProductShell.tsx`, `ProductSidebar.tsx`, `ProductHeader.tsx` |
| W7-SHL-02 | Sidebar Bán hàng, Phiếu nhập, Tồn kho, Thẻ kho theo Read capability; active module/title derive từ `panelState.activeId`; click gọi `workspace.openPanel`, check permission lại trong handler |
| W7-SHL-03 | Collapse/expand, desktop 1440, narrow/mobile drawer; **một** `runtime.content` giữ nguyên trong `ApplicationEntry`, không remount theo theme/menu và không nhân thêm Dockview host; E2E assert cùng `data-session-id`, raw note |
| W7-SHL-04 | `ApplicationEntry` giữ registry/auth/bootstrap/logout admission và default factory `createConfiguredProductionRuntime`. DEV Lab dynamic routes không đổi, not-found/guest dùng `AppHeader` |
| W7-SHL-05 | Base UI Dialog drawer đóng với Escape / focus về trigger; collapsed buttons vẫn có accessible names; Lab direct links được giữ cho Sales/Components ở desktop/mobile |
| W7-SHL-06 | Tạo Sales/Receipt ở header với Write độc lập Read, không dựa active module; Write-only test xác nhận không gửi GET danh sách, chặn nav Read. Các permission checks của runtime/server vẫn là authoritative |

WEB7-03 vẫn sở hữu việc di chuyển và gộp các workspace action trong toolbar pilot; WEB7-02 cố ý không đổi các lệnh Save/Post/close/layout/draft/recovery. Không sửa backend, schemas, IDB namespace, candidate resend flag hoặc auth token/session.

## 3. CI code candidate thực chạy

[PR workflow run #44731629740](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44731629740) trên chính SHA `46ac2664418d44cf93de1baffe6d454585100620`, **SUCCESS**:

| Gate / command `web.yml` | Kết quả thực |
| --- | --- |
| `npm ci`; `npm run typecheck`; `npm run build` | PASS |
| `npm run test:unit` | **1.799 PASS, 1 SKIP**, 91 files |
| `npm run test:e2e -- --project=chromium --workers=2 --forbid-only` | **293/293 PASS** |
| `npm run test:e2e -- --config playwright.production.config.ts --workers=1 --forbid-only` | **3/3 PASS** |

Code run là bằng chứng frontend browser thật trên Chromium với mock HTTP do test harness sở hữu; không chứng nhận integration với SQL/IIS. Sau commit docs này, **kiểm tra final HEAD/PR CI riêng**; không kế thừa tự động trạng thái SUCCESS của source SHA cho docs HEAD mới.

## 4. Findings và regression closure

1. Initial candidate `1476d402`: standalone component tests fail `Cannot read properties of null (reading isServer)` vì TanStack Link mới đòi RouterProvider. Fix ở `3a6cc53`: chỉ tạo DEV links khi có Router context (ứng dụng thực vẫn SPA, không thêm navigation fallback). Component regressions quay lại PASS.
2. Tên accessible của sidebar trùng nút pilot `Tồn kho/Thẻ kho`: dùng `Mở ...` cho riêng sidebar để giữ selector legacy, label hiển thị giữ nguyên.
3. Candidate `3c500b8`: full Chromium **290/293 PASS; 3 FAIL**. Hai case Product Shell mở Inventory thành công nhưng fixture helper chưa hỗ trợ GET balances; một test cũ cần DEV link `Components Lab` khi chuyển Product↔Lab để chứng minh filter state. Fix `46ac266`: thêm exact WEB3 envelopes cho mock GET Inventory và hai DEV links desktop/mobile, giữ toàn bộ assertions. Regression **293/293 PASS** trên source candidate.

## 5. Scope limits, review/handoff

- Edge, zoom browser/OS thực, thao tác attended Telex/VNI/Narrator: **NOT RUN** trong WEB7-02; không tuyên bố accessibility nghiệm thu thủ công.
- HTTP/SQL/IIS, real auth grants, server authorization, durability, multiworker, cutover/recovery và release gates WEB6: **NOT RUN / OUT OF SCOPE**. Production vẫn **NO-GO** theo WEB6, ordinary manual resend không bật.
- Chưa thay toolbar pilot thành WorkspaceActions (WEB7-03). Menu tại WEB7-02 là entry tạo mới và điều hướng, không chứa domain validation/transaction.
- Review cần xác nhận final docs HEAD, không thêm runtime/fake graph, build/typecheck, unit, Chromium và artifact CI trên commit cuối trước khi merge. Không thay test để bỏ finding; số run/failure trước giữ nguyên cho provenance.

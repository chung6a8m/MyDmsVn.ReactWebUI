# WEB7-04 — Shared Field, Validation & Focus

**Ngày triển khai:** 20–21/11/2026 · **Task:** WEB7-04 · **Acceptance:** W7-FLD-01, W7-FLD-02, W7-FLD-03 · **Trạng thái:** IMPLEMENTED / SOURCE CI VERIFIED, PR #49 IN_REVIEW; docs-inclusive HEAD vẫn cần CI riêng trước review/merge.

## 1. Source và ranh giới

- Repository: `chung6a8m/MyDmsVn.ReactWebUI`; base `main` sau PR #48 merge tại `effd901065d0f4680fcc401a135aa250cbad6242`.
- Branch `codex/web7-04-fields-validation`; [PR #49](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/49).
- Verified source checkpoint: `89e0ffd24501c70f1edc992056c3929a3a59a40a`. [PR Web checks #44841014272](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44841014272) **SUCCESS** trên đúng SHA: `npm ci`, typecheck/build PASS, Vitest **1.813 PASS / 1 SKIP (95 files)**, Chromium DEV **305/305 PASS**, production artifact **3/3 PASS**. Source và docs-inclusive HEAD phải được phân biệt.
- `components.json` là `base-nova`, `@base-ui/react@1.9.0`, Tailwind CSS `4.3.3`, AG Grid Community `36.2.0`, Dockview `8.8.2`, React `19.3.1`. **Không thêm dependency, không sửa lockfile, backend, API hoặc IDB schema**.
- `src/components/ui/field.tsx` là **minimal Nova-compatible local primitive**, không chạy CLI generator shadcn. Source provenance này phải được xét khi independent review, không ghi nhầm thành generated output.

## 2. Implementation và acceptance map

| ID | Contract triển khai | Tests |
|---|---|---|
| W7-FLD-01 | `DocumentField` render label/helper/error, required và disabled/read-only; `documentFieldId` dựa module + `documentSessionId` + field; cùng server record ở hai session/module không trùng DOM ID. `ProductLookup` vẫn là owner của label, combobox và Floating UI popup. | `tests/components/fields/DocumentField.test.tsx`, `tests/components/sales/header.test.tsx`, `tests/components/goodsReceipt/header.test.tsx`, `tests/e2e/form-validation.spec.ts`. |
| W7-FLD-02 | `ValidationSummary` hiển thị `session.issues` thực, ID issue theo module/session/field/clientLineId; chọn lỗi nhờ callback feature. `focusValidationIssue` lấy `getRowNode(clientLineId).rowIndex` lúc navigation, `ensureIndexVisible` và `startEditingCell` nếu được phép; không dựa visual row index/product/server ID. Đối với editor đã mở, focus input hiện hữu, không focus lại ô grid. Sales/Receipt grid editors đều nhận stable `documentFieldId(module, session, field:clientLineId)`. Tự focus khi validation được publish sau Save/close, không theo mỗi keystroke. | `tests/components/fields/focusValidationIssue.test.tsx`, `tests/e2e/form-validation.spec.ts`, `tests/e2e/review-round4.spec.ts`, `tests/e2e/web3-receipt.spec.ts`. |
| W7-FLD-03 | Sales/Receipt tiếp tục viết raw/composing vào feature session bằng callback hiện tại; không có local form store, không di chuyển validators. Save barrier, close admission, outstanding HTTP/WEB6 và exact decimal không đổi. | `tests/components/sales/header.test.tsx`, Receipt header component, editorBarrier unit và Sales/Receipt browser existing suites. |

Các file chính: `src/components/ui/field.tsx`, `src/shared/forms/DocumentField.tsx`, `ValidationSummary.tsx`, `fieldIdentity.ts`, `focusValidationIssue.ts`, `src/features/{sales,goodsReceipt}/*HeaderForm.tsx`, `*Feedback.tsx`, `*DocumentPanel.tsx`, receipt `fieldErrors.ts`, Sales decimal/lookup editor ARIA wiring, `ProductLookup.tsx`.

Lab `/lab/components` có `FieldStates` dùng chính `DocumentField` production với normal, required, invalid, helper, disabled, read-only. Đưa vào panel có thể mở riêng để không ép giảm chiều cao Dockview/lookup grid; không có form document mirror trong Lab.

## 3. CI provenance và remediation

GitHub Actions `.github/workflows/web.yml`, runner `ubuntu-24.04`, Node `22.14.0`, npm `11.6.0`, dependencies `npm ci`. Các lệnh bắt buộc:
```bash
npm run typecheck
npm run build
npm run test:unit
npm run test:e2e -- --project=chromium --workers=2 --forbid-only
npm run test:e2e -- --config playwright.production.config.ts --workers=1 --forbid-only
```

Lịch sử phát hiện lỗi (không cộng vào PASS của candidate cuối):

| Source checkpoint | Run | Kết quả và hành động |
|---|---|---|
| `a434182a` | [#44780162037](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44780162037) | Typecheck/build PASS; Vitest 5 FAIL (label text có dấu required, jsdom label activation/ResizeObserver). Đã sửa production marker/accessibility và test fixture. |
| `a47637e4` | [#44781080461](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44781080461) | Vitest PASS; Chromium **289/305 PASS, 16 FAIL**: Receipt/Sales Posted cần giữ disabled; helper thêm `aria-describedby`; Lab grid/layout; close focus. Sửa source và giữ substantive browser assertions. |
| `5de1fb4f` | [#44784097464](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44784097464) | Typecheck/build PASS, **1.811 unit PASS / 1 SKIP (95 files)**; Chromium **304/305 PASS, 1 FAIL** (Receipt close-dialog Save mất editor focus). |
| `d4f39799` | [#44786242675](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44786242675) | Typecheck/build/unit PASS; Chromium **303/305 PASS, 2 FAIL** (cùng Receipt validation editor hiện hữu nhưng bị mất focus). Điều tra xác định double focus navigation giữa Save callback và session issue effect; grid `setFocusedCell` blur input đã mở. |
| `10aa9f47` | [#44840592621](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44840592621) | Source helper sửa double navigation, thêm test editor đã mở; CI trên SHA này bị cancel khi push fix ARIA tiếp theo, không có full PASS. |
| `ccb88d9e` | [#44840850465](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44840850465) | Tách `-lookup-error` khỏi `DocumentField -error` để không trùng ID và thêm test. Không kế thừa kết quả từ commit trước. |
| `89e0ffd2` | [#44841014272](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44841014272) | **SUCCESS on exact source SHA**: typecheck/build PASS; **1.813 unit PASS / 1 SKIP (95 files)**; **305/305 Chromium PASS**; **3/3 production artifact PASS**. Stable ID cho Sales/Receipt grid numeric/product editors đã có regression. |

CI source HEAD hiện xanh, nhưng **merge vẫn cần review độc lập và kiểm chứng docs-inclusive HEAD**. Mọi lần thất bại là bằng chứng phát hiện regression, không được xoá hoặc gắn nhãn PASS.

## 4. Giới hạn và handoff

- Frontend component/Chromium sử dụng Lab fake ports hoặc HTTP stubs; **không** phải live IIS Express/.NET48/SQL, Edge, attended Telex/VNI/Narrator, browser zoom/OS DPI hay production sign-off.
- Không thay WEB6 frozen mutation/recovery, consent/one-shot gate, actor/epoch fences hoặc same-key resend default OFF. WEB6 staging NOT ACCEPTED/production NO-GO giữ nguyên.
- WEB7-05 DateField/calendar và WEB7-06 DecimalInput extraction vẫn là PR riêng; WEB7-04 chỉ thống nhất field presentation/validation focus. Không gộp business validator.
- Trong scoped source review đã phát hiện và sửa duplicate DOM ID giữa `ProductLookup` internal error và shared field error; thêm component test kiểm toàn bộ DOM IDs và accessible description.
- Bằng chứng browser là Playwright Chromium DEV với fake ports/mock HTTP và production artifact static isolation; không phải SQL/Edge/full IIS/attended UX. Chi tiết runner và tất cả lệnh đều nằm trong workflow link trên.
- Trước review/merge: xác nhận final docs-inclusive SHA CI, focused scenarios và full Chromium + production artifact; kiểm tra return-focus khi đóng modal, session identity sau sort/virtualize, header aria-invalid/description, disabled khi Posted. **PR #49 OPEN / IN_REVIEW; không tự merge.**

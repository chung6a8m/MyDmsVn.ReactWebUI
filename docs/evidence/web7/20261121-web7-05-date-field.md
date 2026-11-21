# WEB7-05 — DateField & Calendar

**Ngày triển khai:** 21/11/2026 · **Task:** WEB7-05 · **Acceptance:** W7-DAT-01..04 · **Trạng thái:** IMPLEMENTED / SOURCE CI VERIFIED; PR #50 DRAFT, docs-inclusive HEAD pending.

## Source / design

- Repo: `chung6a8m/MyDmsVn.ReactWebUI`, base `main` SHA `36c8434a0b3d704422c080bd225c04fb51dc164d` (WEB7-04 PR #49 đã merge). Branch `codex/web7-05-date-field`; [PR #50](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/50).
- Source candidate: `4b2ecacbc5d41affb87b2a42df287f1b9b912e31`. `src/shared/inputs/dateOnly.ts` parse `empty | incomplete | invalid | valid`, year/month/day proleptic Gregorian `0001`–`9999`, format ISO `yyyy-MM-dd`; no `Date.parse` / `toISOString` / UTC wire conversion.
- `src/shared/inputs/DateField.tsx`: controlled raw/composing callback; popup trigger, dismissal và return-focus thuộc **Base UI Popover**, một owner. `src/components/ui/calendar.tsx`: locally-authored date grid, month navigation, keyboard arrows/Home/End/PageUp/PageDown, bounded dates. Giữ tokens Nova/Tailwind v4.
- Exact dependency/source provenance: `@base-ui/react@1.9.0` already pinned, `base-nova`, `tailwindcss@4.3.3`; **không** thêm dependency `react-day-picker`/`date-fns`, **không** sửa `package.json`/`package-lock.json`, **không** dùng `shadcn@latest`/registry generator. Popover dùng trực tiếp installed Base UI API; calendar và DateField là source local có review.
- Feature adapters `SalesHeaderForm`, `GoodsReceiptHeaderForm` ghi cùng `writeBuffer`/`writeRaw` đồng bộ, caller sở hữu raw/composing/session/revision/dirty; Save/Post barrier giữ nguyên. Parse helper được dùng lại trong validators; Sales chấp nhận ngày Gregorian valid, Goods Receipt vẫn chặn `0001-01-01` và calendar đặt `min=0001-01-02`. Field required/error association được kế thừa từ WEB7-04.
- UI Lab dùng chính component sản phẩm tại `/lab/components`: leap day, invalid, partial, clear, year 0001, bounded, disabled, read-only. Không tạo fake production import, không thay `SalesListPanel`/Inventory timestamp `yyyy-MM-ddTHH:mm:ss[.fffffff]Z`, backend, security/recovery/WEB6 hoặc dependency graph.

## Kiểm chứng

| Boundary | Lệnh / environment | Trạng thái |
|---|---|---|
| GitHub Actions [source run](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44848061002) | Ubuntu 24.04, Node 22.14.0, npm 11.6.0; `npm ci`, `npm run typecheck`, `npm run build` | PASS typecheck/build |
| Unit/component (full) | `npm run test:unit` + `tests/unit/inputs/dateOnly.test.ts`, `tests/components/inputs/DateField.test.tsx` | **1.820 PASS / 1 SKIP** (97 files) |
| Native Chromium frontend | `npm run test:e2e -- --project=chromium --workers=2 --forbid-only`, gồm `tests/e2e/date-field.spec.ts` | **308/308 PASS** |
| Production artifact | `npm run test:e2e -- --config playwright.production.config.ts --workers=1 --forbid-only` | **3/3 PASS** |
| Windows Edge / attended Telex/VNI/Narrator / OS zoom, IIS Express / SQL | Không thuộc chứng nhận source run này | NOT RUN / NOT CLAIMED |

**Nhật ký fail/fix trung thực:** source SHA `16c33f15` gặp TypeScript errors thiếu import note editor trong Goods Receipt và event composition type. SHA `b5835360` typecheck/build PASS, unit có 1 case sai: `clampDateOnly` trả thừa metadata của parsed bound; SHA `4b2ecacb` đã sửa trả plain year/month/day và bước unit/component CI PASS. Không chuyển các lần fail thành PASS.

**Source CI:** [run #44848061002](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44848061002) đã PASS toàn bộ typecheck/build, 1.820 unit PASS/1 SKIP, 308 Chromium và 3 production artifact trên SHA `4b2ecacbc5d41affb87b2a42df287f1b9b912e31`. Không suy PASS cho các commit fail trước hoặc docs-inclusive HEAD sau khi cập nhật tài liệu.

## Handoff / limits

- Nghiệm thu chỉ tính trên đúng commit/run được ghi. Browser fake/Lab và HTTP-stub có thể kiểm UI path nhưng không phải live Windows/IIS/.NET48/SQL hay production release.
- Chưa mở rộng DateField cho Inventory UTC hoặc date filters của Sales; filter/query thuộc WEB7-07. Không áp Receipt min/business validator sang Sales.
- WEB6 recovery/resend/cutover/workload/production disposition vẫn không đổi; no-auto-retry của mutation, original frozen request/key, actor/epoch/generation vẫn nguyên trạng. PR #50 độc lập, chưa merge.

# WEB7 — Handoff triển khai Product Shell và UI Lab

**2026-11-20: roadmap/design đã được lập; WEB7-01–09 PLANNED, runtime NOT RUN.** Tài liệu này hướng dẫn công việc tiếp theo, không báo đã tạo Product Shell. [Owning plan](../plans/20261120-001-web7-product-shell-ui-lab.md) sở hữu queue/status; [design](../design/WEB7_PRODUCT_SHELL_AND_UI_FOUNDATION.md) sở hữu contract; [acceptance](WEB7_ACCEPTANCE_MATRIX.md) sở hữu assertion; [evidence](../evidence/web7/README.md) sở hữu kết quả.

## 1. Đọc và xác định task

1. Đọc root `AGENTS.md`, [roadmap selector](../plans/README.md), task WEB7 được chọn và dependencies.
2. Đọc phần design/acceptance liên quan, [source baseline](../references/WEB7_SOURCE_BASELINE.md), [Test Policy](../TEST_POLICY.md); đọc source/test hiện tại ở HEAD trước khi sửa.
3. Giữ WEB6 là workstream riêng. Với shell/commands/recovery presentation, đọc `ApplicationEntry.tsx`, `web6CandidateConfig.ts`, `LocalDraftControls.tsx`, `RecoverySupport.tsx` và [WEB6 evidence hiện hành](../evidence/web6/20261110-f04b-measured-quality.md).
4. So sánh HEAD với baseline `c06b1e97d5a476fd790043f75cd9fa826819e1fb`. Nếu implementation đi trước roadmap, ghi nhận và cập nhật task từ evidence thực; không chạy lại công việc đã hoàn thành chỉ vì checkbox cũ.

**Task bắt đầu:** WEB7-01 — diagnostic ownership. Sau đó WEB7-02/03 tạo product chrome/action layout; shared controls đi từ 04. Mỗi control có Lab case ngay cùng PR; 08 hoàn thiện catalog/recipes. Đây là lựa chọn thứ tự kỹ thuật, không yêu cầu xin chọn lại Nova/Base UI, same repo hoặc sidebar-07.

## 2. Phạm vi thay đổi được chọn

Một task gồm source liên quan, tests có ý nghĩa, Lab scenario và evidence/task status. Giữ commit/PR đủ nhỏ để review boundary. Tách file theo trách nhiệm đã ghi trong plan; file mới ở plan là đề xuất, có thể đổi tên khi ghi mapping thống nhất trong plan/matrix.

Giữ runtime registry, configured factory, Dockview admission, actor/epoch/generation/editRevision, raw/composition, exact decimal/date-only và query/paging semantics. Write/Read độc lập: menu tạo Sales/Receipt phải reachable theo Write kể cả không Read, không active panel hoặc đang ở Inventory. Product không import Lab/fake graph. Reuse ProductLookup; không lắp controller popup thứ hai. Một field input không có bản sao document state trong form local.

Không tự bật resend, chạy live SQL/IIS/cutover, thay IDB namespace, archive WEB6, đổi design preset/grid engine hoặc tạo package mới. Nếu task thực sự cần đổi contract thuộc WEB6/backend, làm rõ dependency và thay đổi cụ thể trước khi mở rộng; tiếp tục những phần UI độc lập đã đủ điều kiện. Đừng biến việc chọn roadmap thành vòng xin xác nhận lại các lựa chọn đã chốt.

## 3. Setup và các lệnh dùng khi triển khai

Node pin hiện tại `22.14.0`, npm `11.6.0`; manifest yêu cầu Node `>=22.14.0 <23`. Dùng lockfile. Chạy từ repo root, mỗi server/runner trên port riêng theo config; không reuse server không xác định. Trên PowerShell dùng `npm.cmd` khi truyền args qua `--`.

```bash
npm ci
npm run typecheck
npm run build
```

Đây là lệnh cho PR runtime tương lai, chưa chạy trong đợt tạo roadmap. Chỉ cài package khi implementation cần. Với shadcn, kiểm tra CLI local đã pin và generated source trong config hiện hữu, không dùng `@latest` hoặc `init` để lấy block mới. Calendar cần chốt exact dependency/version sau khi đối chiếu generated source và installed API; ghi lock/source provenance.

### Focused test selection

Ví dụ cho WEB7-01:

```bash
npm run test:e2e -- tests/e2e/sales-editing.spec.ts tests/e2e/review-ui.spec.ts tests/e2e/review-round4.spec.ts tests/e2e/workspace.spec.ts tests/e2e/web3-workspace.spec.ts --project=chromium --workers=2 --forbid-only
npm run test:e2e -- tests/e2e/runtimeIsolation.spec.ts --project=chromium --workers=2 --forbid-only
npm run test:e2e -- --config=playwright.production.config.ts --workers=1 --forbid-only
```

Lệnh artifact cần `npm run build` trước đó; test chạy trên built preview 5174, không phải dev server 5173. Nếu sửa markup khiến selector cũ sai, giữ assertion identity/raw/transmission và chuyển locator sang ngữ nghĩa mới, không xóa testcase để “PASS”. Diagnostic test mới có thể cần thêm vào selection sau khi được tạo.

Ví dụ cho WEB7-02/03, chọn tập tương ứng với boundary thực đổi:

```bash
npm run test:unit -- tests/components/ApplicationEntry.test.tsx tests/components/sales/runtimeInjection.test.tsx tests/unit/http/web6CandidateConfig.test.ts tests/unit/workspace/multiModuleRuntime.test.ts tests/unit/workspace/multiModuleClose.test.ts tests/unit/workspace/restoreCapabilities.test.ts tests/unit/workspace/layoutRuntime.test.ts tests/unit/workspace/epochPropagation.test.ts
npm run test:e2e -- tests/e2e/workspace.spec.ts tests/e2e/web3-workspace.spec.ts tests/e2e/layout-restore.spec.ts --project=chromium --workers=2 --forbid-only
```

Thêm `ProductShell.test.tsx`, `WorkspaceActions.test.tsx`, `product-shell.spec.ts`, `product-workspace-actions.spec.ts` khi đã tạo. Nếu dời recovery/draft entry, chạy thêm component/browser suites đã chỉ ra ở WEB7-03; không suy an toàn focus/consent chỉ từ workspace unit tests.

| Task | Unit/component hiện hữu ưu tiên | Native browser hiện hữu ưu tiên; thêm suite mới trong plan |
|---|---|---|
| 04 field/error | Receipt header; editorBarrier; thêm Sales header/DocumentField | `review-round4`, `sales-editing`, `web3-receipt`; mới form-validation |
| 05 date | Sales validation, Receipt editing; mới dateOnly/DateField | `sales-editing`, `web3-receipt`; mới date-field |
| 06 decimal | Sales/Receipt decimal, Receipt editing, editorBarrier; mới DecimalInput | `sales-editing`, `review-round4`, `web3-receipt` |
| 07 filters/status | SalesListEpoch, lookupState/ProductLookup, inventory queries, web3WireSchemas | `sales-list-layout`, `web3-receipt`, `web3-inventory` |
| 08 catalog | labAuthSnapshot; control tests bị thay đổi | `runtimeIsolation`, `lookup-grid`; mới ui-lab-catalog và production isolation |

Các tên rút gọn trong bảng trỏ tới full paths ở [plan](../plans/20261120-001-web7-product-shell-ui-lab.md) và [matrix](WEB7_ACCEPTANCE_MATRIX.md). Dùng `npm run test:unit -- <test paths>` hoặc `npm run test:e2e -- <spec paths> --project=chromium --workers=2 --forbid-only`. Không tạo test file chỉ để khớp tên gợi ý nếu assertion đã được bổ sung vào suite đúng boundary; ghi mapping thay thế.

### Browser/platform và candidate cuối

Edge cần Microsoft Edge thực trên máy Windows phù hợp, dùng config đã có:

```bash
npm run test:e2e -- --config=playwright.edge.config.ts tests/e2e/workspace.spec.ts tests/e2e/web3-workspace.spec.ts --project=msedge --workers=2 --forbid-only
```

Đây là ví dụ selection, không đại diện đủ WEB7-09. Bổ sung suite WEB7 thực tế và các flows/date/decimal/lookup/recovery bị đổi. Config Edge loại `workspace-zoom.spec.ts` vì suite đó tự launch bundled Chromium; không gọi kết quả zoom của nó là Edge. Real browser zoom, attended Telex/VNI và Narrator phải có bằng chứng riêng; synthetic composition/ARIA test không thay các bước đó. Thiếu môi trường thì ghi NOT RUN/giới hạn, không lấy exception cũ áp tự động.

CI hiện hữu chạy typecheck/build/unit/Chromium/production isolation; không thêm hoặc bỏ gate chỉ để roadmap có trạng thái xanh. Trước handoff cuối, ghi run URL/SHA/kết quả thật. Tập trung test boundary đã đổi, không lặp full suite sau mỗi chỉnh Markdown. Theo Test Policy, đợi browser suite/server kết thúc trước khi ghi docs vì Tailwind có thể theo dõi Markdown và gây rebuild giữa test.

## 4. Prompt khởi động cho implementer

```text
Triển khai WEB7-01 trong docs/plans/20261120-001-web7-product-shell-ui-lab.md.
Đọc AGENTS.md, WEB7 design, acceptance và source baseline; kiểm tra HEAD hiện tại.
Giữ Nova/Base UI, configured runtime, session/raw/close admission và WEB6 default OFF.
Chuyển snapshot/mark diagnostic UI và Ctrl+Alt+M vào Lab qua extension seam;
giữ các snapshot/mark assertions hiện có và Ctrl+Alt+W ở product.
Chỉ sửa source/test/docs thuộc task, chạy focused checks và production isolation,
ghi evidence WEB7 với commit/lệnh/kết quả/giới hạn và mở PR để review.
Không merge, bật resend, đổi backend hoặc tự triển khai task tiếp theo ngoài yêu cầu.
```

Với task tiếp theo, thay ID/mục tiêu theo plan và xác nhận dependencies đã có bằng source/evidence. Nếu Owner yêu cầu thực hiện nhiều task, tiến hành theo thứ tự đã chọn, không dừng xin phép lại từng bước thường lệ.

## 5. Điều kiện handoff một PR

- Scope và kết quả người dùng nhìn thấy rõ; file/dependency mới có lý do và consumer.
- Acceptance IDs có kết quả hoặc limitation cụ thể; không có lỗi mất raw/session, sai command target/quyền, write ngoài ý muốn hoặc Lab leak chưa xử lý.
- Review tập trung contract/lifecycle, input/IME, popup/focus, configured runtime và import boundary; ghi reviewer/findings/fix.
- Evidence phân biệt source review, unit/component, browser fake/mock, artifact, attended và integration thật. Candidate/lock/browser/commands/counts không được mượn từ lần chạy trước.
- Owning plan được cập nhật đúng task; WEB6/history không bị sửa disposition; feature/release flags không đổi. PR title/body dẫn evidence và nêu giới hạn còn lại.

## 6. Gate riêng cho đợt tạo roadmap

Chỉ sửa Markdown trong root entrypoints và `docs/`. Kiểm tra local link/anchor, baseline/source path, task/dependency/acceptance mapping, UTF-8 không BOM, LF, `git diff --check` và diff không chứa source/lock/runtime. Không cần `npm ci` hoặc test UI mới cho một thay đổi chỉ tài liệu; nếu CI tự chạy, báo kết quả CI riêng với đúng commit. Mở PR docs để review; không merge hoặc bắt đầu WEB7-01 trong lượt lập roadmap.

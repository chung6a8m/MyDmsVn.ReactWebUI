# WEB7-01 — Diagnostic UI và shortcuts thuộc DEV Lab

**Ngày triển khai:** 2026-11-20 · **Task:** WEB7-01 · **Acceptance:** W7-DIA-01, W7-DIA-02, W7-DIA-03.

**Checkpoint sau review regression: IMPLEMENTED WITH BROWSER FIX / PR OPEN / FINAL-HEAD VERIFICATION PENDING.** Đây là bằng chứng triển khai frontend, không phải xác nhận production readiness hoặc nghiệm thu WEB6.

- Repo: `chung6a8m/MyDmsVn.ReactWebUI`.
- Source baseline của WEB7: `c06b1e97d5a476fd790043f75cd9fa826819e1fb`. `main` tại lúc rẽ nhánh: `f67e37e0f5b9cc96c8d06c8ef74ee590776f7861` (roadmap docs-only).
- Initial implementation commit: [`80a9c52cc5cb1d274e4a5558e00c5308059051a2`](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/commit/80a9c52cc5cb1d274e4a5558e00c5308059051a2); final implementation tracked at PR HEAD; branch `codex/web7-01-lab-diagnostics`; [PR #46](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/46).
- Không đổi `package.json`/`package-lock.json`, shadcn preset, HTTP/SQL/backend, WEB6 candidate/resend flags, hoặc production auth/runtime composition. CI dùng lockfile có sẵn.

## 1. Source và acceptance mapping

| ID | Source/case | Điều đã thay đổi |
|---|---|---|
| W7-DIA-01 | `WorkspaceHost.tsx`, `SalesDocumentPanel.tsx`; `tests/e2e/web7-diagnostics.spec.ts` và `tests/production/runtimeIsolation.spec.ts` | Product không còn mark toolbar, `Ctrl+Alt+M` handler, snapshot button/JSON, hoặc commandCount debug. Giữ `Ctrl+Alt+W` qua `workspace.closePanel(..., "command")` và Cancel không làm mất raw |
| W7-DIA-02 | `WorkspaceExtensions.tsx`, `src/lab/WorkspaceDiagnostics.tsx`, `src/lab/SalesSnapshotDiagnostics.tsx`, `LabProvider.tsx` | Lab inject component/shortcut; mark capture theo active document và module; snapshot gọi nguyên `workspace.barrier.prepareSave(sessionId)`, không đọc bản sao draft; message đi qua `onFeedback` vào một alert hiện hữu của document |
| W7-DIA-03 | `src/app/router.tsx` DEV import boundary giữ nguyên; production isolation, Lab direct routes | Product không import `src/lab` hoặc fake adapters; Lab `/lab/sales` và `/lab/components` vẫn có scenario/harness. Không CSS-hide diagnostic trong production |

Các browser assertions mới kiểm tra snapshot last-keystroke, hai session và focus mark, Ctrl+Alt+W Cancel, sự vắng mặt diagnostic/KeyM trong Product và không phát business write trong HTTP-stub fixture. Existing browser suites về invalid raw, IME/composition, unmounted buffer, lookup và workspace mark không bị loại bỏ hoặc nới assertion.

**Scope:** UI/extension plumbing và browser regression. Lab sử dụng fake ports; Product browser sử dụng stub `/api/v1/**` qua `productionHttp` để xác nhận presentation/route behavior. Không chạy SQL, IIS/HTTPS live, kiểm chứng authorization ở server hay pair/cutover/recovery WEB6.

## 2. Verification log — GitHub Actions

**Runner:** `ubuntu-24.04`, Node `22.14.0`, npm `11.6.0`, locked `npm ci`; Chromium do Playwright pin cài theo workflow. Máy chạy local của người triển khai không có network tới GitHub, không nhận là một lần local browser PASS.

**[PR run #44720435212](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44720435212)**, code SHA `80a9c52...`, checkpoint lúc ghi tài liệu:

| Lệnh / bước workflow | Trạng thái quan sát được |
|---|---|
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run test:unit` | PASS (toàn bộ bước unit/component) |
| `npm run test:e2e -- --project=chromium --workers=2 --forbid-only` | IN_PROGRESS — chưa gán PASS, chưa có số trường hợp hoàn tất |
| `npm run test:e2e -- --config playwright.production.config.ts --workers=1 --forbid-only` | PENDING — chưa gán PASS |

Lượt [push run #44720338482](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44720338482) trên cùng code SHA và [main baseline #44719993589](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44719993589) đều FAIL một unit `tests/unit/http/web6BoundaryObserver.test.ts` (`eligibility500 waits ...`), với 1796 PASS, 1 FAIL, 1 SKIP mỗi lượt. Unit PR run phía trên đã PASS trên cùng source. Đây là lỗi unit vốn xảy ra ở baseline chưa đổi bởi WEB7-01; không sửa hoặc bỏ WEB6 assertion trong PR UI.

**Browser finding và correction:** PR run #44720435212 trên initial code SHA có **285/289 Chromium PASS; 4 FAIL** (3 ca `review-ui.spec.ts`, 1 ca `sales-editing.spec.ts`). Root cause: snapshot diagnostics tự có `role=alert` đồng thời với `saveMessage` alert cũ, nên Save hoặc thông báo giới hạn 200 dòng để lại hai alerts. Đã sửa source bằng cách cho Lab publish message qua `onFeedback` vào **một notification slot đã tồn tại**, tiếp tục giữ snapshot JSON và barrier trong Lab; thêm case `W7-DIA-02` chống regression. Không đổi assertions cũ hay WEB6. **Fix chưa được tính PASS trước CI trên HEAD đã sửa.**

**Final-head gate:** xem kết quả mới nhất trên PR #46 sau các commits, không dùng các lượt CI cũ làm chứng nhận HEAD mới. Ghi PASS/count chỉ khi job hoàn tất có bằng chứng. Việc ci còn PENDING tại checkpoint này giữ task `IN_REVIEW`, chưa `DONE`.

## 3. Chưa thực hiện và giới hạn

- Final-head Chromium, production artifact và tổng số browser PASS: **PENDING** tại checkpoint tài liệu. CI cuối có thể supersede checkpoint này; PR run/status là nguồn kiểm tra.
- Edge, zoom OS thực, attended Telex/VNI/Narrator: **NOT RUN**, không kế thừa bằng chứng từ các candidate cũ.
- HTTP/SQL/IIS thật, security, data oracle và các WEB6 cutover/workload/recovery gates: **NOT RUN / OUT OF SCOPE**.
- WEB7-02 Product Shell chưa triển khai. Không kết luận product-release GO từ việc ẩn diagnostic.

## 4. Review/handoff

Khác biệt source của PR tập trung vào extension seam mặc định rỗng và các Lab components; không thêm fake branch hoặc runtime mới cho Product. Mark luôn capture identity mới nhất, không fallback về Sales khi panel chỉ đọc. `Ctrl+Alt+W` và close admission dùng đường cũ; snapshot vẫn qua Save barrier thực của feature.

Reviewers kiểm tra final-head checks, browser assertions W7-DIA-01/02/03, production isolation, và giới hạn của WEB6 độc lập trước khi đóng task. Chỉ sau khi WEB7-01 được chấp nhận mới triển khai phụ thuộc WEB7-02 trong PR riêng.

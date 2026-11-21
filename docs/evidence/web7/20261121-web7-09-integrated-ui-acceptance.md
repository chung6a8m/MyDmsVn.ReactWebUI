# WEB7-09 — Integrated UI Acceptance & Handoff

**Ngày thực hiện:** 2026-11-21
**Phạm vi:** Roadmap 07 / `W7-INT-01..05`; Product Shell, Sales, Goods Receipt, Inventory, shared controls và Lab.
**Source baseline đã merge:** `main@4171aff4dd71299f5b7cb5a2217a76a624e42c07` (PR #53 / WEB7-08).
**Branch candidate:** `codex/web7-09-ui-acceptance`. **Source/test checkpoint:** `cdc7e2c9f3bbbb46b4484014030be87accb3251a`; docs-inclusive HEAD và PR CI được ghi khi xác minh.
**Trạng thái:** IMPLEMENTED / CANDIDATE CI & INDEPENDENT REVIEW PENDING. Không suy PASS trên candidate WEB7-09 từ CI `main` trước commit test.

## 1. Candidate và ranh giới

- `package.json`: Node `>=22.14.0 <23`, npm pin `11.6.0`, Playwright `1.64.1`; CI `ubuntu-24.04` với `node 22.14.0`, `npm 11.6.0` và bundled Chromium. Lockfile, dependencies, `src/`, API/backend, `web6CandidateConfig` và flags không đổi.
- Product chạy qua `ApplicationEntry` với HTTP fixture tại `tests/e2e/helpers/durableDraftWorkspaceHttp.ts`. Fixture giả lập `/api/v1/**`; không phải SQL/IIS/production. Browser kiểm tra React, Base UI, Dockview, AG Grid và Chromium thực; `businessWrites/unexpected/errors` phải rỗng trong test chỉ điều hướng.
- Lab `/lab/*` chỉ bật trong DEV, fake ports explicit; không lẫn vào production bundle. Production artifact được kiểm tra qua build + `tests/production/runtimeIsolation.spec.ts`.
- Các case Sales Save/Post, Receipt Save/Post/unknown, Inventory read, 403/actor/epoch, close/reset/restore/recovery có suite hiện hữu và bắt buộc chạy full Chromium một candidate; không dựng HTTP/SQL pilot giả để nhận PASS.
- Không đụng `WEB6` status/cutover/FailedRetained, operation identity, ordinary resend default OFF hay staging/production disposition.

## 2. Mapping nghiệm thu trên candidate

| ID | Browser/verification oracle | Trạng thái candidate |
|---|---|---|
| W7-INT-01 | `web7-integrated-ui.spec.ts`: Shell + Sales/Receipt/Inventory ở 1440×900, 1280×720, Light/Dark, split, desktop collapse, 390px drawer và native Chromium tab zoom 125%/200%; thêm `product-shell`, `foundation`, `web3-inventory`, `date-field`, `form-validation` | PENDING CI |
| W7-INT-02 | `web7-integrated-ui.spec.ts`: hai document session IDs/raw riêng, invalid date, Inventory split, Close All → Cancel, không phát mutation; thêm `workspace`, `lookup-grid`, `durableDraftWorkspace`, `web6ManualResendDialog`, `web3-receipt` | PENDING CI |
| W7-INT-03 | `npm run build`, `tests/production/runtimeIsolation.spec.ts`, config/WEB6 unit suites, Lab graph isolation; no feature flag mutation | PENDING CI |
| W7-INT-04 | Exact SHA, CI link/counts, fixture/platform/version/viewport/native zoom, independent review và NOT RUN ledger trong tệp này; hướng dẫn tại `docs/development/WEB7_UI_ACCEPTANCE_HANDOFF.md` | IN PROGRESS |
| W7-INT-05 | Diff không thay WEB6/archive/backend; đối chiếu `docs/plans/20261103-001-web6-recovery-quality-web.md` và `docs/evidence/web6/20261110-f04b-measured-quality.md` | SOURCE BOUNDARY REVIEW PENDING |

`web7-integrated-ui.spec.ts` bổ sung ba regression tổ hợp thay vì thay thế các suites module đã tồn tại; không bỏ hoặc nới assertion cũ.

## 3. Verification ledger

| Gate | Kết quả | Provenance / lưu ý |
|---|---|---|
| Merge dependency WEB7-08 | **PASS (prerequisite only)** | PR [#53](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/53) merged 2026-11-21; merge SHA `4171aff4d`. [Main CI #44880270205](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44880270205) SUCCESS **chỉ trên main trước WEB7-09** |
| Candidate `npm ci`, typecheck, build | **PENDING** | Workflow `Web checks` trên final candidate SHA |
| Candidate Vitest unit/component | **PENDING** | Ghi thực tế PASS/FAIL/SKIP sau CI |
| Candidate full Playwright Chromium | **PENDING** | Phải thấy `web7-integrated-ui` và suite Sales/Receipt/Inventory/recovery. Chỉ đếm tests của đúng candidate |
| Candidate built artifact isolation | **PENDING** | Dùng `playwright.production.config.ts`, không dùng Vite DEV làm artifact proof |
| Documentation path/anchors/diff | **PENDING** | Link/ID consistency, UTF-8 no BOM, LF và file scope |
| Source review / findings P1/P2 | **PENDING** | Ghi findings, reproducer, fix/regression và exact HEAD khi review |
| Real Windows Microsoft Edge | **NOT RUN** | Môi trường này không có Windows Edge; `playwright.edge.config.ts` dành cho máy có Edge thực |
| Attended Telex / VNI / Narrator | **NOT RUN** | Không thể thay bằng synthetic composition, `fill()`, ARIA/unit hoặc Chromium |
| Windows native Edge 125%/200% + real OS DPI | **NOT RUN** | Chromium extension test chỉ chứng minh Chromium zoom; không tuyên bố Edge/native Windows |
| Real HTTP/IIS/SQL, paired WEB6 cutover/workload/recovery | **NOT RUN / OUT OF WEB7 SCOPE** | Không mượn pilot historical; WEB6 giữ gate của nó |

**Không gọi WEB7-09 DONE, UI nghiệm thu đầy đủ hay production release trước khi candidate gates và independent review có evidence.** Thiếu Windows/attended được ghi rõ cho Owner lựa chọn mức UI acceptance sau khi kiểm chứng tự động.

## 4. Handoff và next action

Đọc [hướng dẫn nghiệm thu/handoff WEB7](../../development/WEB7_UI_ACCEPTANCE_HANDOFF.md) để chạy Product/Lab, Windows Edge, attended IME/Narrator, xác minh zoom và ghi mẫu evidence. Sau CI, cập nhật ngay tệp này với SHA cuối, link run, số suite/test/skip, browser version, PASS/FAIL và findings. Chỉ đánh dấu DONE trong phạm vi được chứng minh; không archive roadmap khi chưa có chỉ đạo Owner.

**WEB6 không thay đổi:** Chromium/Edge pair lịch sử PASS, cutover FAIL/FailedRetained, workload/recovery NOT RUN/NOT MEASURED, `CandidateVerified` absent; ordinary resend OFF, staging NOT ACCEPTED / production NO-GO.

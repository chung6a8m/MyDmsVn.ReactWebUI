# WEB7-09 — Integrated UI Acceptance & Handoff

**Ngày thực hiện:** 2026-11-21
**Phạm vi:** Roadmap 07 / `W7-INT-01..05`; Product Shell, Sales, Goods Receipt, Inventory, shared controls và Lab.
**Source baseline đã merge:** `main@4171aff4dd71299f5b7cb5a2217a76a624e42c07` (PR #53 / WEB7-08).
**Branch candidate:** `codex/web7-09-ui-acceptance`. **Source/test SHA đạt CI:** `b26df2cebdcd6cbb76fe5fc7f7e64f40b5fb9a73`; [CI #44884349768](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44884349768) SUCCESS. Docs-only handoff HEAD tiếp theo ghi riêng.
**Trạng thái:** AUTOMATED SOURCE/TEST CI **PASS**; docs-inclusive HEAD CI và independent review **PENDING**; Windows Edge, Telex/VNI/Narrator **NOT RUN**. WEB7-09 chưa được đánh dấu DONE.

## 1. Candidate và ranh giới

- `package.json`: Node `>=22.14.0 <23`, npm pin `11.6.0`, Playwright `1.64.1`; CI `ubuntu-24.04` với `node 22.14.0`, `npm 11.6.0` và bundled Chromium. Lockfile, dependencies, `src/`, API/backend, `web6CandidateConfig` và flags không đổi.
- Product chạy qua `ApplicationEntry` với HTTP fixture tại `tests/e2e/helpers/durableDraftWorkspaceHttp.ts`. Fixture giả lập `/api/v1/**`; không phải SQL/IIS/production. Browser kiểm tra React, Base UI, Dockview, AG Grid và Chromium thực; `businessWrites/unexpected/errors` phải rỗng trong test chỉ điều hướng.
- Lab `/lab/*` chỉ bật trong DEV, fake ports explicit; không lẫn vào production bundle. Production artifact được kiểm tra qua build + `tests/production/runtimeIsolation.spec.ts`.
- Các case Sales Save/Post, Receipt Save/Post/unknown, Inventory read, 403/actor/epoch, close/reset/restore/recovery có suite hiện hữu và bắt buộc chạy full Chromium một candidate; không dựng HTTP/SQL pilot giả để nhận PASS.
- Không đụng `WEB6` status/cutover/FailedRetained, operation identity, ordinary resend default OFF hay staging/production disposition.

## 2. Mapping nghiệm thu trên candidate

| ID | Browser/verification oracle | Trạng thái candidate |
|---|---|---|
| W7-INT-01 | Product Shell/dual dirty documents/Inventory, 1440×900, 1280×720, 768×720, 390×780, Light/Dark/split, real Chromium native zoom 125%/200%; existing Field/Inventory suites | **PASS — Chromium fixture only**, Windows **NOT RUN** |
| W7-INT-02 | Distinct Sales/Receipt session IDs/raw, invalid date, Close All → Cancel, drawer/theme/zoom, zero unsolicited business writes; full Sales/Receipt/Recovery suites | **PASS — Chromium fixture only** |
| W7-INT-03 | Built artifact isolation, DEV-only Lab graph excluded, no runtime/WEB6 flag changes | **PASS — 3/3 production artifact** |
| W7-INT-04 | Exact SHA/runner/browser/results, initial failure/fix provenance and Windows attended handoff | **AUTOMATED EVIDENCE PASS / independent review PENDING** |
| W7-INT-05 | PR diff touches tests and docs only; no WEB6/backend/dependencies/release changes | **PASS — source diff scope** |

`web7-integrated-ui.spec.ts` bổ sung ba regression tổ hợp thay vì thay thế các suites module đã tồn tại; không bỏ hoặc nới assertion cũ.

## 3. Verification ledger

| Gate | Kết quả | Provenance / lưu ý |
|---|---|---|
| Merge dependency WEB7-08 | **PASS (prerequisite only)** | PR [#53](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/53) merged 2026-11-21; merge SHA `4171aff4d`. [Main CI #44880270205](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44880270205) SUCCESS **chỉ trên main trước WEB7-09** |
| Candidate `npm ci`, typecheck, build | **PASS** | [CI #44884349768](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44884349768), source/test `b26df2cebdcd6cbb76fe5fc7f7e64f40b5fb9a73`, Node 22.14.0/npm 11.6.0, Ubuntu 24.04 |
| Candidate Vitest unit/component | **PASS — 1,839 PASS / 1 SKIP** | 101 test files, unchanged fixtures |
| Candidate full Playwright Chromium | **PASS — 320/320** | Chromium 156.0.8078.4 / Playwright 1.64.1, 2 workers, full suite |
| Candidate built artifact isolation | **PASS — 3/3** | `playwright.production.config.ts`, built assets |
| Documentation path/anchors/diff | **STATIC PATH/ID CHECK PASS; DOCS-HEAD CI PENDING** | 175 relative links, 41 unique W7 IDs, UTF-8 no BOM/LF/no trailing whitespace |
| Source review / findings P1/P2 | **INDEPENDENT REVIEW PENDING** | Initial new-test oracle failures fixed; no production source changes |
| Real Windows Microsoft Edge | **NOT RUN** | Môi trường này không có Windows Edge; `playwright.edge.config.ts` dành cho máy có Edge thực |
| Attended Telex / VNI / Narrator | **NOT RUN** | Không thể thay bằng synthetic composition, `fill()`, ARIA/unit hoặc Chromium |
| Windows native Edge 125%/200% + real OS DPI | **NOT RUN** | Chromium extension test chỉ chứng minh Chromium zoom; không tuyên bố Edge/native Windows |
| Real HTTP/IIS/SQL, paired WEB6 cutover/workload/recovery | **NOT RUN / OUT OF WEB7 SCOPE** | Không mượn pilot historical; WEB6 giữ gate của nó |

**Không gọi WEB7-09 DONE hoặc production release:** CI của source/test PASS nhưng CI docs-inclusive HEAD, independent review và Windows attended/Edge phải được đánh giá riêng.

## 4. Automated verification và finding history

- **Initial test SHA** `817555583f6a08348d15412aeb40daf1aaf50c21`: [CI #44882882713](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44882882713) FAIL — 317/320 Chromium PASS, ba test mới FAIL, artifact SKIPPED; typecheck/build/unit PASS. Lưu FAIL gốc, không gộp như run PASS.
- **Fix** `b26df2cebdcd6cbb76fe5fc7f7e64f40b5fb9a73` chỉ thay `tests/e2e/web7-integrated-ui.spec.ts`: tab locator dùng `.filter({hasText:"Phiếu nhập mới"})` như Receipt test hiện hữu; raw sau zoom là giá trị tích lũy; bổ sung breakpoint 768px. Giữ assertions session/raw/no mutation. [Giải trình findings PR #54](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/54#issuecomment-7059837701).
- **Verified source/test HEAD** `b26df2cebdcd6cbb76fe5fc7f7e64f40b5fb9a73`: [CI #44884349768](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44884349768) **SUCCESS**, locked install/typecheck/build; **101 Vitest files, 1,839 PASS / 1 SKIP; 320/320 Chromium PASS; 3/3 production artifact PASS**. Runner Ubuntu 24.04, Node 22.14.0, npm 11.6.0, Chromium 156.0.8078.4 (Playwright 1.64.1). Browser calls use deterministic fake HTTP fixture; no real SQL/IIS/Windows/production acceptance.
- CI trên docs-inclusive HEAD sau commit tài liệu là gate riêng; independent review và Windows Edge/attended vẫn chưa chạy.

## 5. Handoff và next action

Đọc [handoff Windows/attended](../../development/WEB7_UI_ACCEPTANCE_HANDOFF.md) để chạy Edge, real DPI, Telex/VNI/Narrator trên máy operator. Khi merge cần xác nhận docs-inclusive HEAD CI/independent review, lưu findings, không chuyển NOT RUN thành PASS/Owner accepted nếu chưa có quyết định.

**WEB6 không thay đổi:** Chromium/Edge pair lịch sử PASS, cutover FAIL/FailedRetained, workload/recovery NOT RUN/NOT MEASURED, `CandidateVerified` absent; ordinary resend OFF, staging NOT ACCEPTED / production NO-GO.

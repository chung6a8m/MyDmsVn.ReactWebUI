# WEB7 — Evidence Product Shell, UI Lab và shared UI

**Ngày mở scope: 2026-11-20.** [Owning plan](../../plans/20261120-001-web7-product-shell-ui-lab.md) · [design](../../design/WEB7_PRODUCT_SHELL_AND_UI_FOUNDATION.md) · [acceptance](../../development/WEB7_ACCEPTANCE_MATRIX.md) · [handoff](../../development/WEB7_CODEX_HANDOFF.md) · [source baseline](../../references/WEB7_SOURCE_BASELINE.md).

## 1. Trạng thái tại lần tạo roadmap

| Phạm vi | Trạng thái | Bằng chứng/giới hạn |
|---|---|---|
| Khảo sát source và tạo roadmap | DOCS CREATED | Frontend `main` tại `c06b1e97d5a476fd790043f75cd9fa826819e1fb`; direction do Owner chọn ngày 20/11 |
| Kiểm tra tài liệu | PASS — DOCS ONLY | 9 Markdown files; 236 local links/anchors resolve; 41 acceptance IDs duy nhất và đủ 9 task; UTF-8 không BOM/LF; diff đúng phạm vi |
| WEB7-01–09 implementation | PLANNED | Chưa thay source, dependency hoặc runtime |
| Unit/component/browser/artifact acceptance WEB7 | NOT RUN | Các test paths và assertion trong matrix là kế hoạch |
| Edge, real zoom, attended IME/Narrator WEB7 | NOT RUN | Không kế thừa PASS/exception của candidate trước |
| SQL/IIS/cutover/workload/recovery | Không phải acceptance được chạy bởi đợt WEB7 docs | Owning WEB6 scope giữ trạng thái riêng; không có approval/release mới |

Current entrypoints (`AGENTS.md`, README, roadmap selector) được route tới WEB7 và sửa tóm tắt WEB6 đã cũ. Không thay owning WEB6 plan/evidence hoặc archive cũ. [WEB6 evidence cập nhật 14/11](../web6/20261110-f04b-measured-quality.md) ghi pair PASS, cutover FAIL/FailedRetained, workload/recovery NOT RUN/NOT MEASURED, `CandidateVerified` absent; ordinary resend OFF, staging NOT ACCEPTED, production NO-GO.

### Kiểm tra và review tài liệu ngày 20/11

- Kiểm tra bằng script đọc local links/Markdown anchors, strict UTF-8/no BOM/LF/newline cuối, trailing whitespace, task headings/status và acceptance IDs: không có lỗi; đối chiếu file thay đổi chỉ gồm 6 docs mới + 3 entrypoints.
- `git diff --check`: PASS. Không sửa `src/`, `tests/`, manifest/lock hoặc cấu hình runtime; không chạy `npm ci`, unit/browser/SQL/IIS cho đợt viết roadmap.
- Review độc lập đối chiếu source runtime, WEB6 ownership, task dependencies và Base/Nova/calendar contracts. Đã sửa ba điểm: không gợi ý thêm group-close/nút save-layout chưa có; giữ phần lẻ UTC tùy chọn 1–7 chữ số; giữ entry tạo Sales/Receipt cho Write-only user độc lập Read/active module, kèm W7-CMD-06.
- Review lại finding Write-only: đã giải quyết, không còn finding mở từ review. Đây là review kế hoạch/tài liệu, không phải kiểm chứng implementation hoặc production approval. CI tự chạy sau khi mở PR, nếu có, phải đọc ở đúng commit/run và báo riêng.

### Tiến độ sau lần lập roadmap

WEB7-01 đã hoàn tất: [PR #46](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/46) MERGED 2026-11-20 sau 1.797 unit PASS / 1 SKIP, Chromium 290/290, artifact 3/3 trên source SHA `e4c2a9d7`; [evidence](20261120-web7-01-lab-diagnostics.md) giữ cả lỗi initial 285/289 và việc khắc phục. WEB7-02 đã merge [PR #47](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/47), code SHA `46ac2664` đạt 1.799 unit PASS / 1 SKIP, Chromium 293/293, artifact 3/3 theo [CI](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44731629740), [evidence riêng](20261120-web7-02-product-shell.md); WEB7-02 đã merge vào `main`. WEB7-03 đã triển khai ở [PR #48](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/pull/48), đã đạt full source CI trên `609970b0` ([run #44758237005](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44758237005): 1.803 unit PASS / 1 SKIP, Chromium 298/298, artifact 3/3), pre-review docs-inclusive `5a859e62` đã đạt [CI #44761375606](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44761375606); independent review sửa hai P2 (shortcut focus, IME menu event); final source `b8ed2c47` có [CI #44769316286](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44769316286) **1.803 unit PASS / 1 SKIP, 301/301 Chromium PASS, 3/3 artifact PASS**, PR #48 MERGED; [evidence riêng](20261120-web7-03-workspace-actions.md). WEB7-04 DONE (PR #49 MERGED), WEB7-05 DONE / PR #50 MERGED, WEB7-06 DONE / PR #51 MERGED; WEB7-07 DONE / PR #52 MERGED, WEB7-08 DONE / PR #53 MERGED; WEB7-09 AUTOMATED CI VERIFIED; review fixes awaiting exact-HEAD verification, Windows attended NOT RUN; không đổi disposition WEB6.

## 2. Cách ghi evidence triển khai

Mỗi task/candidate tạo file có ngày và task ID dưới thư mục này, ví dụ `YYYYMMDD-web7-01-lab-diagnostics.md`. Không thêm kết quả WEB7 vào evidence WEB1–06. Thêm link vào bảng dưới khi file thực sự tồn tại; chưa tạo file rỗng để giả lập hoàn thành.

| Task | Evidence runtime |
|---|---|
| WEB7-01 | [Implementation/final verification](20261120-web7-01-lab-diagnostics.md) — DONE / PR #46 MERGED |
| WEB7-02 | [Implementation / code-CI evidence](20261120-web7-02-product-shell.md) — DONE / PR #47 MERGED |
| WEB7-03 | [Implementation / review evidence](20261120-web7-03-workspace-actions.md) — DONE, PR #48 MERGED (`effd9010`); final source `b8ed2c47` CI PASS |
| WEB7-04 | [Implementation / CI evidence](20261120-web7-04-fields-validation.md) — PR #49 MERGED; source `89e0ffd2` CI SUCCESS (1.813 unit PASS/1 SKIP, 305 Chromium PASS, 3 artifact PASS) |
| WEB7-05 | [Implementation / source CI evidence](20261121-web7-05-date-field.md) — PR #50 MERGED; source `4b2ecacb` SUCCESS: 1.820 unit PASS/1 SKIP, Chromium 308/308, artifact 3/3; docs-inclusive HEAD pending |
| WEB7-06 | [DecimalInput evidence](20261121-web7-06-decimal-input.md) — PR #51 MERGED; independent P2 orphaned-IME fixed; exact-head CI recorded on PR |
| WEB7-07 | [Filters & feedback evidence](20261121-web7-07-filters-feedback.md) — PR #52 MERGED; final CI 1,834 unit PASS / 1 SKIP; Chromium 313/313; artifact 3/3 |
| WEB7-08 | [Catalog/recipes evidence](20261121-web7-08-ui-lab-catalog.md) — PR #53 MERGED; final PR CI 1,839 unit PASS / 1 SKIP; Chromium 317/317; artifact 3/3 |
| WEB7-09 | [Integrated acceptance candidate](20261121-web7-09-integrated-ui-acceptance.md) — source/test `b26df2ce` [CI #44884349768](https://github.com/chung6a8m/MyDmsVn.ReactWebUI/actions/runs/44884349768) PASS (1.839 Vitest/1 SKIP, 320 Chromium, 3 artifact); docs-inclusive `cceea6ce` PR/push CI PASS; review zoom focus/cleanup fixes cần CI trên HEAD mới, attended riêng |
| WEB7-09-WIN | [Windows physical acceptance](20261121-web7-09-windows-physical-acceptance.md) — PARTIALLY ACCEPTED. Edge Windows 318 PASS/1 SKIP/0 FAIL; native Edge 100%/125%/200% tại OS scale 100%; artifact 3/3. Telex theo Owner: E01 mất vị trí caret, E02 chưa đủ bằng chứng về composition, E03–E08 PASS. VNI và Narrator NOT RUN. |

### Template tối thiểu cho mỗi lần chạy

1. Task, acceptance IDs, source commit/branch, lock/build identity và file thay đổi; nếu generate shadcn thì exact CLI, registry/source và dependency versions.
2. Môi trường Node/npm/OS/browser version, viewport/theme/zoom; app DEV hay built artifact; fake ports/mock HTTP hay backend thật; feature flags thực tế.
3. Lệnh đầy đủ, suite/case thực chạy, PASS/FAIL/skip/retry, số lượng và artifact/log/screenshot cần thiết. Không suy browser behavior từ unit hoặc screenshot.
4. Assertions về identity/raw/focus/command/transmission tương ứng task; lỗi tìm được, nguyên nhân và regression sau fix.
5. Review và quyết định scope; phần NOT RUN/BLOCKED/NOT APPLICABLE có lý do, residual risks, task kế tiếp. Source review/CI/frontend mock không thay SQL hoặc production acceptance.

Ghi sau khi test/server hoàn tất. Không commit secrets/raw business payload vào screenshot/log; dùng dữ liệu fixture. Với recovery, giữ operation identity dùng chọn đúng row/case; không xóa retained draft hay giảm assertion chỉ để testcase xanh.

## 3. Quy tắc closeout

WEB7-09 tổng hợp một candidate UI cụ thể theo matrix, không gộp PASS từ nhiều commit không tương thích. Historical evidence vẫn hữu ích cho provenance nhưng không tự là kết quả candidate mới. Thiếu Edge/real zoom/attended case ghi NOT RUN và limitation riêng. Không đổi trạng thái WEB6, bật ordinary resend hoặc quyết định staging/production từ PR UI. Roadmap chỉ archive khi Owner yêu cầu sau khi có kết quả/giới hạn cụ thể.

# Bàn giao Codex — Web Workspace and Editing Foundation

**Ngày:** 2026-10-31. **Repo:** `chung6a8m/MyDmsVn.ReactWebUI`, runtime candidate `ac6f1b1` gồm fixes PR #2. WEB-01–WEB-08 DONE; roadmap COMPLETED trong automated fake scope, nhánh kết thúc `codex/web-08-evidence-handoff`. Chưa có task mới active. Tổng hợp cuối 135 unit/component + 78 Chromium PASS; 24/24 bước attended Edge/Telex/VNI/Narrator được Owner xác nhận PASS theo evidence. Đọc [evidence](../evidence/20261031-web-foundation.md), bộ runtime pin ở [Technical Baseline](../references/TECHNICAL_BASELINE.md) và [HTTP integration handoff](HTTP_INTEGRATION_HANDOFF.md).

## Trình tự đọc

1. [AGENTS.md](../../AGENTS.md).
2. [Active roadmap index](../plans/README.md) và [plan chi tiết](../plans/20261031-001-web-workspace-editing-foundation.md).
3. [Web UI Foundation](../design/WEB_UI_FOUNDATION.md).
4. [Workspace](../design/WORKSPACE_BEHAVIOR.md), [Lookup/Grid](../design/LOOKUP_AND_GRID_EDITING.md), [Sales](../design/SALES_PILOT.md), theo task.
5. [Test Policy](../TEST_POLICY.md), [Technical Baseline](../references/TECHNICAL_BASELINE.md), [Evidence](../evidence/20261031-web-foundation.md).

## Prompt cho lần chọn phạm vi tiếp theo

```text
Roadmap nền WEB-01–WEB-08 của chung6a8m/MyDmsVn.ReactWebUI đã hoàn thành
trong automated fake scope. Đọc AGENTS.md, docs/plans/README.md,
docs/evidence/20261031-web-foundation.md và
docs/development/HTTP_INTEGRATION_HANDOFF.md. Không chạy lại task DONE.

Mục tiêu là hành vi nhập liệu và quản lý tài liệu. Dùng React/TypeScript/Vite,
Tailwind CSS v4, shadcn/ui Nova + Base UI mặc định, AG Grid Community,
Dockview và Floating UI trực tiếp cho ProductLookup.

Giữ spec đã chọn: document session độc lập layout; raw buffers tồn tại qua
hide/move; close guard bao phủ mọi đường; Save barrier lấy ký tự cuối;
decimal chính xác; async response không retarget; unknown mutation không retry.
Chạy app và Lab bằng cùng production components qua fake async ports.

Chỉ lập/triển khai roadmap mới theo phạm vi Owner giao. Nếu chọn HTTP,
chốt required decisions về precision/DTO projection, Post acknowledgement,
unknown recovery, auth và host net48 trước khi nối runtime. Không suy endpoint
từ Local interface. Giữ lockfile; kiểm tra browser thật cho boundary bị đổi.

Không áp dụng Business Compact hoặc font 14px bắt buộc. Không đưa Enterprise,
popout/floating, durable drafts, SQL hay HTTP/auth/runtime thật vào roadmap này.
HTTP handoff là đầu vào quyết định, không tự cấp scope backend/migration.

Báo cáo những gì thực chạy, số test, source versions và giới hạn. Nếu thiếu
môi trường IME/Edge attended, ghi riêng PENDING; không suy từ synthetic input.
```

Prompt trên là handoff để người dùng giao Codex, không phải bằng chứng công việc đã được chạy.

## Điểm phải tránh suy diễn

- WEB-01–07 đã có file thực. `WorkspaceProvider` giữ runtime trên route; mở bằng `openSalesDocument`. Close admission gọi `finaliseSession`, không nối finalise vào remove/add. `workspace.barrier.prepareSave` khóa phiên, chuẩn hóa raw/lookup, đợi editor acknowledgement, kiểm tra identity/revision rồi trả snapshot frozen; `salesCommands.requestSave` giữ khóa tới mutation. WEB-06 dùng `createSalesPortCommands` và public SalesPort của fake adapter; không bỏ barrier.
- `DecimalCellEditor` inline công bố raw/composition vào store ngay mỗi event. Product editor gắn `suppressProductLookupKeyboard`; lookup cần host panel/modal. Checkbox chỉ expose provided renderer (click/Space), không provided editor lưu giá trị cục bộ; F2/Enter không mở editor Tặng. `initialDraft` giữ dirty cho chứng từ mới trước khi có baseline. `sessionDirty` so canonical lẫn raw; không xóa raw sai khi prepare blocked.
- Sales Header/Lines đọc nhãn từ summary/buffer, không suy ID từ text. Lookup intent được barrier chuyển vào snapshot Sales; lookup harness field/modal không thuộc Sales field thì vẫn blocked. Create/Save/Post persist dataset trong bộ nhớ; Create liên kết record vào cùng session. Unknown giữ snapshot, khóa mutation/close/Discard. `inspectRecovery` chỉ dùng public Get; người dùng xác nhận `confirmRecovery` khi đủ bằng chứng. Create tìm ứng viên qua public list/Get và liên kết thủ công, không replay. Post recovery ghép dòng theo saleLineId; Save/Create giữ mapping snapshot. Conflict cho đọc lại/review trước khi xác nhận bỏ bản sửa. Fake controls chỉ ở Lab, ngoài vùng sản phẩm.
- Layout dùng allowlist versioned, actor scope và saved record references; không chứa raw/draft/session ID. Reset/restore/actor đi qua closeAll. Route remount dùng memory cùng phiên; reload tạo phiên mới và Get lại. Xem evidence WEB-07; đây không phải durable recovery hoặc auth production.
- Source SHA khảo sát không tương đương npm version đã khóa.
- `prepareSave`, `requestClose`, `SalesPort` là API ứng dụng đề xuất; các API thư viện có tên chính thức được dẫn nguồn riêng.
- Default style cho phép CSS layout/portal/focus cần thiết; không yêu cầu visual parity với WinForms.
- Local port dùng strings cho số/ID không cho phép tự đổi JSON contract server. Handoff phải xác minh mapping.
- Mock capability và simulated Post không chứng minh security hoặc COGS production.

## Báo cáo sau mỗi task

Ghi: task/commit, thay đổi behavior, test commands và số test, browser/viewport/mode, source/dependency versions ảnh hưởng, kết quả từng scenario liên quan, giới hạn/PENDING và task tiếp theo. Tách review tài liệu khỏi runnable evidence.

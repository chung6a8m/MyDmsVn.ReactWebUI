# Bàn giao Codex — Web Workspace and Editing Foundation

**Ngày:** 2026-10-31. **Repo:** `chung6a8m/MyDmsVn.ReactWebUI`, base `main`. WEB-01–WEB-04 đã triển khai; nhánh hiện thực WEB-04 là `codex/web-04-product-lookup`, tiếp nối `237d4d1`. Task kế tiếp **WEB-05**. Đọc [evidence](../evidence/20261031-web-foundation.md) trước khi tiếp tục. Bộ runtime đã pin ở [Technical Baseline](../references/TECHNICAL_BASELINE.md); `dockview-react` là React adapter riêng ở bản 8.8.2.

## Trình tự đọc

1. [AGENTS.md](../../AGENTS.md).
2. [Active roadmap index](../plans/README.md) và [plan chi tiết](../plans/20261031-001-web-workspace-editing-foundation.md).
3. [Web UI Foundation](../design/WEB_UI_FOUNDATION.md).
4. [Workspace](../design/WORKSPACE_BEHAVIOR.md), [Lookup/Grid](../design/LOOKUP_AND_GRID_EDITING.md), [Sales](../design/SALES_PILOT.md), theo task.
5. [Test Policy](../TEST_POLICY.md), [Technical Baseline](../references/TECHNICAL_BASELINE.md), [Evidence](../evidence/20261031-web-foundation.md).

## Prompt triển khai đề xuất

```text
Triển khai active roadmap của chung6a8m/MyDmsVn.ReactWebUI từ main.
Đọc AGENTS.md và docs/plans/README.md; tiếp tục từ task chưa DONE theo
dependencies của docs/plans/20261031-001-web-workspace-editing-foundation.md.

Mục tiêu là hành vi nhập liệu và quản lý tài liệu. Dùng React/TypeScript/Vite,
Tailwind CSS v4, shadcn/ui Nova + Base UI mặc định, AG Grid Community,
Dockview và Floating UI trực tiếp cho ProductLookup.

Giữ spec đã chọn: document session độc lập layout; raw buffers tồn tại qua
hide/move; close guard bao phủ mọi đường; Save barrier lấy ký tự cuối;
decimal chính xác; async response không retarget; unknown mutation không retry.
Chạy app và Lab bằng cùng production components qua fake async ports.

WEB-01 phải xác minh bộ phiên bản tương thích, pin lockfile và ghi kết quả.
Thực hiện từng task có deliverable/checks rõ, commit theo phạm vi và cập nhật
evidence + trạng thái task. Chạy browser thực cho Dockview/AG Grid/Floating UI.
Không thay integration đó bằng mocks để kết luận PASS.

Không áp dụng Business Compact hoặc font 14px bắt buộc. Không đưa Enterprise,
popout/floating, durable drafts, SQL hay HTTP/auth/runtime thật vào roadmap này.
WEB-08 bàn giao các điều kiện tích hợp HTTP tiếp theo, không tự hiện thực backend.

Báo cáo những gì thực chạy, số test, source versions và giới hạn. Nếu thiếu
môi trường IME/Edge attended, ghi riêng PENDING; không suy từ synthetic input.
```

Prompt trên là handoff để người dùng giao Codex, không phải bằng chứng công việc đã được chạy.

## Điểm phải tránh suy diễn

- Các file WEB-01/02/03/04 đã tồn tại; file của task sau trong plan vẫn là cấu trúc đích. `WorkspaceProvider` giữ runtime phía trên route; `createWorkspaceRuntime().openSalesDocument` là entry mở phiên. `workspaceController` đã nối admission trước khi gọi `finaliseSession`; tuyệt đối không nối finalise vào Dockview remove/add. Edit harness hiện giữ raw note/qty ngoài draft; WEB-05 bổ sung normalization/barrier thay vì đọc DOM. `salesCommands` hiện chỉ chuẩn bị note của chứng từ mẫu cho Save stub; chặn chứng từ mới và raw qty đã sửa. Thay preparation này ở WEB-05 và nối full fake port/recovery ở WEB-06; stub không ghi lại dataset. Pending/unknown giữ snapshot và khóa phiên; không retry. WEB-04 `ProductLookup` controlled giữ selected ID/display/query/composition trong `lookupBuffers` của session, đồng thời công bố raw/revision. `publishLookup` ghi intent, `restoreLookup` phục hồi điểm bắt đầu edit; WEB-05 mới chuyển selection vào Sales draft/barrier. Product column phải gắn cả `ProductLookupCellEditor` và `suppressProductLookupKeyboard`; popup cần `LookupOverlayHost` của panel/modal, không fallback body. Harness đọc selection hiển thị từ session, không từ row data tạm.
- Source SHA khảo sát không tương đương npm version đã khóa.
- `prepareSave`, `requestClose`, `SalesPort` là API ứng dụng đề xuất; các API thư viện có tên chính thức được dẫn nguồn riêng.
- Default style cho phép CSS layout/portal/focus cần thiết; không yêu cầu visual parity với WinForms.
- Local port dùng strings cho số/ID không cho phép tự đổi JSON contract server. Handoff phải xác minh mapping.
- Mock capability và simulated Post không chứng minh security hoặc COGS production.

## Báo cáo sau mỗi task

Ghi: task/commit, thay đổi behavior, test commands và số test, browser/viewport/mode, source/dependency versions ảnh hưởng, kết quả từng scenario liên quan, giới hạn/PENDING và task tiếp theo. Tách review tài liệu khỏi runnable evidence.

# Hành vi workspace

**Trạng thái:** thiết kế cho roadmap đầu; chưa triển khai. Runtime và toàn bộ kịch bản dưới đây: **NOT RUN**.

Đọc cùng [WEB_UI_FOUNDATION.md](WEB_UI_FOUNDATION.md), [LOOKUP_AND_GRID_EDITING.md](LOOKUP_AND_GRID_EDITING.md), [SALES_PILOT.md](SALES_PILOT.md), [TEST_POLICY.md](../TEST_POLICY.md) và [TECHNICAL_BASELINE.md](../references/TECHNICAL_BASELINE.md).

## 1. Phạm vi

Roadmap đầu có tab, dock, split, resize trong cùng cửa sổ; đóng có bảo vệ; khôi phục layout; pilot Sales đầy đủ với fake-async. Floating, popout cửa sổ ngoài, HTTP runtime thật và backend xác thực để sau. Giao diện dùng mặc định Tailwind v4, shadcn Nova và AG Grid Community; bỏ Business Compact và ép cỡ chữ 14px. Tiêu chí nghiệm thu là hành vi đúng.

## 2. Danh tính và đích lệnh

`documentSessionId: DocumentSessionId` do ứng dụng cấp cho một phiên chỉnh sửa, độc lập với panel và `recordId`. Mở lại cùng loại chứng từ, cùng `recordId`, cùng actor đang dùng phải kích hoạt phiên hiện có, kể cả phiên đang dirty; không tạo bản sửa trùng. Chứng từ mới có session riêng trước khi có `recordId`; Save đầu bổ sung ánh xạ record nhưng giữ session và `clientLineId`.

`sessionGeneration` tăng khi phiên kết thúc hoặc bị thay thế. Mỗi request chụp session, generation và actor giả lập lúc bắt đầu. Phản hồi cũ không được gắn lại vào phiên mới. Actor demo không chứng minh xác thực hay phân quyền. `clientLineId` ổn định suốt vòng đời dòng; không dùng row index làm danh tính.

Hai group có thể cùng hiển thị. Lệnh dùng phiên có focus gần nhất trong group đang active; khi chuyển focus sang toolbar, giữ đích vừa xác định. Toolbar và phím tắt chung đi qua `commandRouter`, chụp đích trước dialog/await. Không có đích hợp lệ thì vô hiệu hóa lệnh. Không chọn đích chỉ vì panel đang visible.

## 3. Trạng thái và vòng đời

| Lớp | Nội dung và chủ sở hữu |
| --- | --- |
| Phiên Sales | Store giữ raw edit buffer, draft đã chuẩn hóa, baseline, edit revision, lỗi và trạng thái request. |
| View | Focus, scroll, column state theo session; không chứa bản dữ liệu duy nhất. |
| Layout | Group, tab, kích thước, vị trí và tham chiếu an toàn; không chứa draft. |

Raw buffer cập nhật theo từng thay đổi, kể cả chuỗi sai hoặc chưa nhập xong. Dirty tính cả raw buffer khác baseline, không chỉ draft hợp lệ. Quy tắc chuyển buffer thành snapshot thuộc [LOOKUP_AND_GRID_EDITING.md](LOOKUP_AND_GRID_EDITING.md).

Dockview mặc định `onlyWhenVisible`: tháo DOM khi ẩn nhưng panel instance vẫn sống; không suy ra React tự unmount. `always` giữ DOM và dùng `visibility: hidden`; subscription vẫn chạy. Pilot chọn `always` cho panel chỉnh sửa, tạm dừng tác vụ nền không cần thiết theo visibility; không tháo editor để tối ưu sớm. [Nguồn rendering][dv-render]

Hide, đổi tab, di chuyển và resize không kết thúc session. `onDidRemovePanel` cũng phát khi chuyển group, nên không dùng nó để xóa draft. Controller chỉ finalise phiên sau quyết định đóng thành công; cleanup phiên thực hiện một lần, cleanup view chỉ hủy tài nguyên view sở hữu. Không để hai cleanup cùng xóa session. [Nguồn events][dv-events]

Giữ column order/width, scroll và ô đang sửa qua hide/move/resize. Không fit-to-size theo từng pixel resize; chỉ áp dụng sizing theo chủ đích. Không ghi đè state bằng kích thước 0 lúc ẩn; khôi phục scroll sau khi view đo được kích thước hữu ích. Không refetch chỉ vì panel được hiện lại.

## 4. Save và đóng an toàn

Các API sau **thuộc ứng dụng**, không phải API Dockview; kiểu chuẩn do [WEB_UI_FOUNDATION.md](WEB_UI_FOUNDATION.md) sở hữu:

```ts
declare function requestClose(sessionId: DocumentSessionId, reason: CloseReason):
  Promise<'closed' | 'cancelled' | 'blocked'>;
declare function requestSave(sessionId: DocumentSessionId): Promise<SaveOutcome>;
```

`CloseReason` phân biệt nút đóng, middle-click, lệnh menu/phím tắt, đóng hàng loạt và thay layout. `prepareSave` trả `PrepareSaveResult`: `ready` chứa snapshot kèm `editRevision`, hoặc `blocked` chứa issues. `SaveOutcome` có `saved` kèm document, `blocked` kèm issues, `failed` kèm error, hoặc `outcome-unknown`. Không thêm kiểu cạnh tranh ở workspace.

Mọi đường đóng phải đi qua controller trước khi loại panel: X, middle-click, menu, phím tắt, đóng group và close-all. `DockviewDefaultTab.closeActionOverride` bao phủ X/middle-click; chưa xác minh được hook hủy remove phổ quát. Vì vậy không expose đường đóng khác chưa được nối guard; spike phải chứng minh việc bao phủ. Không đợi remove rồi dựng lại panel để “hoàn tác”. [Nguồn defaultTab][dv-tab]

Trình tự `requestClose`:

1. Khóa một luồng quyết định mỗi session; yêu cầu lặp dùng chung kết quả, không mở nhiều dialog.
2. Mutation đang pending hoặc outcome chưa rõ: trả `blocked`, giữ panel và hướng dẫn recovery. Không cho Discard hay đóng trong trạng thái này.
3. Phiên clean: đóng. Phiên dirty: hỏi **Lưu / Bỏ thay đổi / Tiếp tục sửa** tương ứng Save/Discard/Cancel, trước khi bắt buộc validation.
4. **Save:** chạy `requestSave`; `prepareSave` kiểm tra raw buffer và draft. Có issues thì giữ phiên, đưa focus tới lỗi. Lỗi lưu cũng giữ dữ liệu. Chỉ đóng sau `saved` và revision hiện tại đã được xác nhận; sửa mới sau snapshot vẫn dirty, trả `blocked`.
5. **Discard:** xóa cả raw buffer sai/chưa hoàn chỉnh và draft, rồi đóng; không yêu cầu buffer hợp lệ. **Cancel:** giữ nguyên và trả `cancelled`.

`requestSave` chống gửi lặp, gắn response với session/generation/revision đã chụp. Timeout/abort phía client không đủ chứng minh mutation chưa xảy ra; `outcome-unknown` phải recovery theo [SALES_PILOT.md](SALES_PILOT.md). Hủy read/lookup được phép khi đóng, nhưng response muộn không được tái tạo phiên.

`closeAll` chụp danh sách session, xử lý tuần tự, dừng ngay ở `cancelled` hoặc `blocked`. Các phiên đã đóng trước đó vẫn đóng; không hứa atomic rollback. Không đóng song song rồi thu thập quyết định sau.

Refresh/đóng cửa sổ trình duyệt không thuộc async close guard. Lưu draft qua refresh ngoài roadmap đầu. Chỉ cảnh báo trình duyệt theo khả năng cho phép; không hứa chặn được mọi lần thoát. Hiển thị rõ: **“Bản nháp chưa lưu sẽ mất khi tải lại hoặc đóng trang. Bố cục được nhớ, nội dung chưa lưu không được khôi phục.”**

## 5. Lưu và khôi phục layout

`layoutPersistence` nghe `onDidLayoutChange`, debounce rồi lấy `toJSON()`. Đây là lưu bố cục, không phải lưu chứng từ. Envelope có `schemaVersion`, phiên bản registry và scope actor giả lập; chỉ nhận cấu trúc, hình học và định danh đã allowlist. Loại bỏ draft, raw text, dữ liệu chứng từ, bí mật và params tùy ý. Tiêu đề phải được dựng từ mẫu an toàn. [Nguồn save][dv-save]

Khôi phục theo thứ tự: kiểm tra scope/schema → kiểm tra component/tham chiếu → áp dụng layout → tạo session mới → tải lại chứng từ đã lưu qua fake-async. Không tin dữ liệu local như quyền truy cập. `documentSessionId` cũ không phục sinh phiên trước. Tab chứng từ mới chưa lưu bị loại khỏi bản restore; thông báo rõ thay vì dựng một chứng từ trắng mang danh bản gốc.

Component lạ bị bỏ nếu cấu trúc còn hợp lệ; nếu không, từ chối toàn bộ và dùng layout mặc định. Không resolve component bằng tên tùy ý. Bọc parse/`fromJSON` trong xử lý lỗi; Dockview có thể throw khi layout hỏng. Thiếu chứng từ khi refetch hiện lỗi tại panel, cho thử lại/đóng, không giả lập đã tải thành công. [Nguồn load][dv-load]

Restore/reset hoặc đổi scope actor phải qua guarded close-all; chỉ thay layout khi mọi phiên đã giải quyết. Dirty chưa được quyết định hoặc mutation busy/unknown đều chặn thao tác. Không gọi `fromJSON` hoặc xóa layout trước guard vì có thể phá phiên hiện tại.

## 6. Điểm triển khai dự kiến

Các đường dẫn sau chưa phải mã đã triển khai:

| Đường dẫn | Trách nhiệm |
| --- | --- |
| `src/app/workspace/WorkspaceHost.tsx` | Adapter Dockview, focus và visibility. |
| `src/app/workspace/workspaceController.ts` | Close guard, close-all, finalise một lần. |
| `src/app/workspace/panelRegistry.ts` | Allowlist, ánh xạ panel/session, mở lại cùng record. |
| `src/app/workspace/layoutPersistence.ts` | Schema, sanitize, scope, restore/fallback. |
| `src/app/workspace/commandRouter.ts` | Chụp đích lệnh theo focus/active. |
| `src/features/sales/salesSessionStore.ts` | Buffer/draft/revision/generation và request state. |
| `src/features/sales/salesCommands.ts` | Prepare/save và recovery theo contract chung. |

## 7. Kịch bản nghiệm thu

Test dự kiến tại `tests/unit/workspace/*` và `tests/e2e/workspace.spec.ts`, theo [TEST_POLICY.md](../TEST_POLICY.md). **Tất cả NOT RUN**; đọc source thư viện không thay thế kiểm thử runtime.

| ID | Bằng chứng phải có |
| --- | --- |
| WKS-01 | Mở lại cùng record kích hoạt đúng session, giữ dirty. |
| WKS-02 | Hai group visible; toolbar/phím tắt chỉ tác động phiên đã chụp. |
| WKS-03 | Dock/tab/split/resize giữ buffer, clientLineId, column state và scroll. |
| WKS-04 | Hide/move không finalise; cleanup cuối chỉ chạy một lần. |
| WKS-05 | X/middle-click/menu/phím tắt/group close đều qua guard. |
| WKS-06 | Buffer sai: Save báo lỗi, Discard đóng được, Cancel giữ nguyên. |
| WKS-07 | Pending/unknown chặn đóng/Discard; recovery xác định kết quả. |
| WKS-08 | Save lặp không gửi trùng; response muộn không gắn vào generation mới. |
| WKS-09 | Close-all tuần tự, dừng tại cancel/blocked; không đổi nhầm đích. |
| WKS-10 | Restore refetch record cùng reference summaries, kể cả inactive ngoài trang search; không phục sinh draft hoặc tab mới chưa lưu. |
| WKS-11 | JSON hỏng/component lạ/sai scope fallback; dirty/busy chặn reset. |
| WKS-12 | Refresh có copy giới hạn rõ; không tuyên bố draft được khôi phục. |

[dv-render]: https://github.com/dockview/dockview/blob/18a975de67631ac2dafe5a5719fb132eb36ed392/packages/docs/docs/core/panels/rendering.mdx
[dv-events]: https://github.com/dockview/dockview/blob/18a975de67631ac2dafe5a5719fb132eb36ed392/packages/docs/docs/core/events.mdx
[dv-tab]: https://github.com/dockview/dockview/blob/18a975de67631ac2dafe5a5719fb132eb36ed392/packages/dockview-react/src/dockview/defaultTab.tsx
[dv-save]: https://github.com/dockview/dockview/blob/18a975de67631ac2dafe5a5719fb132eb36ed392/packages/docs/docs/core/state/save.mdx
[dv-load]: https://github.com/dockview/dockview/blob/18a975de67631ac2dafe5a5719fb132eb36ed392/packages/docs/docs/core/state/load.mdx

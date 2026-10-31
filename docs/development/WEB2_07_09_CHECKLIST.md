# WEB2-07–09 — checklist triển khai

Ngày 2026-10-31. Thực thi theo [roadmap](../plans/20261031-002-http-jwt-sales-vertical-slice.md) và [spec](../design/WEB2_FRONTEND_INTEGRATION.md); không tạo hợp đồng thay thế.

- [x] WEB2-07: `src/infrastructure/http/{authApi,httpTransport}.ts`, browser auth store, `src/app/runtime/ApplicationEntry.tsx`: authoritative me/capabilities, access localStorage, refresh cookie-only, single-flight/Web Locks, epoch fencing, protected rendering và logout admission. RED/GREEN unit/component cho refresh race, read retry một lần, write không replay, logout Cancel, actor isolation.
- [x] WEB2-08: HTTP Zod schemas/mappers và Sales/Catalog ports; nối production composition. RED/GREEN cho canonical backend corpus, exact IDs/decimal/date, inactive references, catalog 403, list filter/cursor, stale actor response. Không copy rồi sửa golden fixtures.
- [x] WEB2-09: PostAcknowledgement contract, fake compatibility, session command/store/UI và HTTP writes; RED/GREEN cho ordered duplicate lines, validation index, conflict/raw, ack trước Get, unknown/no replay và actor fencing.
- [x] Kiểm chứng tích hợp: typecheck, build, unit/component; browser HTTP harness và regression Lab liên quan, production isolation. Ghi số test thực chạy; IIS/SQL/attended tách riêng WEB2-10.
- [x] Review độc lập diff; sửa findings; cập nhật roadmap/handoff/WEB2 evidence. Không sửa evidence WEB-01–08, không merge/push tự động.

Rà soát giao diện: 07 cung cấp auth + transport cho 08; 08 cung cấp codec/read và composition cho 09; 09 đổi Post result có chủ ý và cập nhật mọi fake consumer. Các task dùng chung runtime/contracts nên thực hiện tuần tự. Capability UI không thay server authorization. Khi forced expiry, giữ runtime cũ riêng trong RAM, không gắn nó vào phiên mới. Không thay storage/framework/preset hoặc backend business handlers.

Review focus: refresh/login/logout chạy chéo tab; stale auth response ghi lại token; logout khi editor dirty/pending; HTTP malformed success sau mutation; Post ack thành công nhưng Get bị từ chối.

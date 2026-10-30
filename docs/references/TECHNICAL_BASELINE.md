# Technical baseline và nguồn

**Khảo sát:** 2026-10-31, Asia/Bangkok. Repo ReactWebUI ban đầu rỗng, default branch `main`; chưa có package manifest hoặc lockfile. Các Git SHA dưới đây ghi mốc nguồn đọc, **không phải phiên bản dependency đã cài**. WEB-01 phải kiểm tra release stable phù hợp và cập nhật bảng phiên bản thực tế.

## 1. Quyết định Owner và phạm vi

Owner chọn Tailwind CSS v4 + Nova defaults, AG Grid Community, Dockview và cho phép Floating UI cho lookup; mục tiêu ưu tiên behavior. Business Compact và font 14px bắt buộc đã được bỏ khỏi hướng Web. Quyết định chi tiết ở [Foundation](../design/WEB_UI_FOUNDATION.md).

## 2. Nguồn đã kiểm tra

| Nguồn | Mốc khảo sát | Điều được nguồn hỗ trợ |
|---|---|---|
| [shadcn/ui](https://github.com/shadcn-ui/ui/tree/b8d7baa15b1dca5716f13153e63795fc3d741f6b) | `b8d7baa15b1dca5716f13153e63795fc3d741f6b` | Nova style, component source; preset không tự trở thành policy nghiệp vụ |
| [AG Grid](https://github.com/ag-grid/ag-grid/tree/026e1513b7620fd01faa8e68a106609c5c0e4439) | `026e1513b7620fd01faa8e68a106609c5c0e4439` | Quartz; Community editors; editing lifecycle và popup class |
| [Dockview](https://github.com/dockview/dockview/tree/18a975de67631ac2dafe5a5719fb132eb36ed392) | `18a975de67631ac2dafe5a5719fb132eb36ed392` | Rendering, panel move events, default-tab override và serialization |
| [Floating UI](https://github.com/floating-ui/floating-ui/tree/93ea014e0344ec0169e9a03db8aee70e90fd5a09) | `93ea014e0344ec0169e9a03db8aee70e90fd5a09` | Positioning, autoUpdate cleanup, virtual list navigation, portal root/focus primitives |
| [MyDmsVn](https://github.com/chung6a8m/MyDmsVn/tree/5b9f960ee4048581f107e9ee6350e1dfad462b53) | `5b9f960ee4048581f107e9ee6350e1dfad462b53` | Sales/Contracts: độc lập dòng, decimal/date/version, quyền và recovery; chưa có HTTP host trong baseline đã đọc |

### Đường dẫn hữu ích

- Tailwind: [Vite integration](https://tailwindcss.com/docs/installation/using-vite), [theme](https://tailwindcss.com/docs/theme).
- shadcn: [Nova/style choices](https://github.com/shadcn-ui/ui/blob/b8d7baa15b1dca5716f13153e63795fc3d741f6b/apps/v4/content/docs/changelog/2025-12-shadcn-create.mdx), [Nova source](https://github.com/shadcn-ui/ui/blob/b8d7baa15b1dca5716f13153e63795fc3d741f6b/apps/v4/registry/styles/style-nova.css).
- AG Grid: [themes](https://github.com/ag-grid/ag-grid/blob/026e1513b7620fd01faa8e68a106609c5c0e4439/documentation/ag-grid-docs/src/content/docs/themes/index.mdoc), [provided editors](https://github.com/ag-grid/ag-grid/blob/026e1513b7620fd01faa8e68a106609c5c0e4439/documentation/ag-grid-docs/src/content/docs/provided-cell-editors/index.mdoc), [editing lifecycle](https://github.com/ag-grid/ag-grid/blob/026e1513b7620fd01faa8e68a106609c5c0e4439/documentation/ag-grid-docs/src/content/docs/cell-editing-start-stop/index.mdoc), [custom editors](https://github.com/ag-grid/ag-grid/blob/026e1513b7620fd01faa8e68a106609c5c0e4439/documentation/ag-grid-docs/src/content/docs/cell-editors/index.mdoc).
- Dockview: [rendering](https://github.com/dockview/dockview/blob/18a975de67631ac2dafe5a5719fb132eb36ed392/packages/docs/docs/core/panels/rendering.mdx), [events](https://github.com/dockview/dockview/blob/18a975de67631ac2dafe5a5719fb132eb36ed392/packages/docs/docs/core/events.mdx), [tab source](https://github.com/dockview/dockview/blob/18a975de67631ac2dafe5a5719fb132eb36ed392/packages/dockview-react/src/dockview/defaultTab.tsx), [save](https://github.com/dockview/dockview/blob/18a975de67631ac2dafe5a5719fb132eb36ed392/packages/docs/docs/core/state/save.mdx), [load](https://github.com/dockview/dockview/blob/18a975de67631ac2dafe5a5719fb132eb36ed392/packages/docs/docs/core/state/load.mdx).
- Floating UI: [React](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/react.mdx), [autoUpdate](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/autoUpdate.mdx), [portal](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/FloatingPortal.mdx), [list navigation](https://github.com/floating-ui/floating-ui/blob/93ea014e0344ec0169e9a03db8aee70e90fd5a09/website/pages/docs/useListNavigation.mdx). Các sources bổ sung ở Lookup spec.
- React: [state update semantics](https://github.com/reactjs/react.dev/blob/main/src/content/reference/react/useState.md).
- MyDmsVn: [Sales](https://github.com/chung6a8m/MyDmsVn/blob/5b9f960ee4048581f107e9ee6350e1dfad462b53/docs/DIRECT_SALES.md), [Contracts](https://github.com/chung6a8m/MyDmsVn/blob/5b9f960ee4048581f107e9ee6350e1dfad462b53/docs/CONTRACTS.md), [Architecture](https://github.com/chung6a8m/MyDmsVn/blob/5b9f960ee4048581f107e9ee6350e1dfad462b53/docs/ARCHITECTURE.md).

## 3. Giới hạn dùng nguồn

Source của nhánh phát triển có thể có API chưa phát hành. Chỉ sử dụng API có trong version đã cài; nếu close override hoặc event semantics khác, ghi phương án tương đương và kiểm chứng trước khi expose affordance. Không tự nâng major để khớp một đoạn tài liệu.

Các tài liệu MyDmsVn giữ nhiều trạng thái lịch sử. Repo này chỉ lấy business/contract semantics đã nêu; không kế thừa acceptance hoặc execution queue. Không sửa repo backend trong roadmap đầu.

## 4. Inventory cần điền tại WEB-01

| Thành phần | Hiện tại | Bằng chứng phải bổ sung |
|---|---|---|
| Node/npm/Vite/React/TypeScript | NOT INSTALLED | Exact version, engine constraints, lockfile |
| Tailwind/shadcn Base+Nova | NOT INSTALLED | CLI version + generation command/config, generated source |
| Dockview | NOT INSTALLED | Package version, rendering/events/close/theme APIs thực có |
| AG Grid Community | NOT INSTALLED | Version, module registration, no Enterprise dependency/features |
| Floating UI | NOT INSTALLED | Version, peer compatibility, portal/focus/navigation API |
| Query/Router/Zustand/RHF/Zod | NOT INSTALLED | Exact versions và ownership phù hợp spec |
| Test tools | NOT INSTALLED | Vitest/Testing Library/Playwright + Chromium version |

Giữ bảng này là record thực tế; không đổi NOT INSTALLED chỉ vì plan đã chọn tên thư viện.

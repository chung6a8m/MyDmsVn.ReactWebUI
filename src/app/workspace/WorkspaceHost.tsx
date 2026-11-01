import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type FunctionComponent,
  type ReactNode,
} from "react";
import { useStore } from "zustand";
import { DockviewReact } from "dockview-react";
import {
  themeDark,
  themeLight,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from "dockview";
import { useTheme } from "../theme";
import { useWorkspace } from "./WorkspaceContext";
import { hasModuleCapability } from "../runtime/moduleCapabilities";
import type { PanelComponents } from "./featurePanels";
import { Button } from "../../components/ui/button";
import { DocumentTab } from "./DocumentTab";
import { useWorkspaceExtensions } from "./WorkspaceExtensions";
import { getStyleNonce } from "../styleNonce";
export function WorkspaceHost({
  catalogComponent,
  catalogTitle = "Danh mục mẫu",
  documentComponents,
  newDocumentModule,
  toolbar,
}: {
  catalogComponent: FunctionComponent<IDockviewPanelProps>;
  catalogTitle?: string;
  documentComponents: PanelComponents;
  newDocumentModule?: "sales" | "goods-receipt";
  toolbar?: ReactNode;
}) {
  const workspace = useWorkspace();
  const auth = useSyncExternalStore(workspace.auth.subscribe, workspace.auth.getSnapshot);
  const extensions = useWorkspaceExtensions();
  const { mode } = useTheme();
  const layout = useStore(workspace.layouts.state);
  const panels = useStore(workspace.panelState);
  const closing = useStore(workspace.close.state, state => state.busy);
  const target = panels.activeId ? panels.panels[panels.activeId] : undefined;
  const writableModule = newDocumentModule ?? (target?.module === "goods-receipt" ? "goods-receipt" : target?.module === "sales" || !target ? "sales" : null);
  const [host, setHost] = useState<DockviewApi>();
  const components = useMemo(
    () => ({ catalog: catalogComponent, ...documentComponents, ...extensions.panelComponents }),
    [catalogComponent, documentComponents, extensions.panelComponents],
  );
  const onReady = useCallback(
    ({ api }: DockviewReadyEvent) => {
      api.addPanel({
        id: "foundation-catalog",
        component: "catalog",
        title: catalogTitle,
        renderer: "always",
      });
      setHost(api);
    },
    [catalogTitle],
  );
  useEffect(
    () => (host ? workspace.attach(host, catalogTitle) : undefined),
    [host, workspace, catalogTitle],
  );
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        !event.isComposing &&
        !event.repeat &&
        event.ctrlKey &&
        event.altKey &&
        (event.code === "KeyM" || event.code === "KeyW")
      ) {
        const activeId = workspace.panelState.getState().activeId;
        const captured = workspace.commands.capture();
        if (event.code === "KeyW" && activeId) {
          event.preventDefault(); void workspace.closePanel(activeId, "command");
        } else if (captured) { event.preventDefault(); workspace.commands.mark(captured); }
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [workspace]);
  if (!workspace.isCurrentScope(layout.scope)) return <p role="status" className="p-4">Phiên Workspace đã khóa. Đăng nhập lại để tiếp tục.</p>;
  return (
    <>
      <div
        role="toolbar"
        aria-label="Workspace"
        className="flex flex-wrap items-center gap-2 border-b px-4 py-2"
      >
        {extensions.toolbar}
        {toolbar}
        <Button variant="outline" disabled={layout.busy || closing || !hasModuleCapability(auth, workspace.portContext(), "sales", "read")}
          onClick={() => void workspace.openPanel("sales")}>Danh sách Sales</Button>
        <Button
          variant="outline"
          disabled={layout.busy || closing || !writableModule || !hasModuleCapability(auth, workspace.portContext(), writableModule, "write")}
          onClick={() => { if (writableModule) void workspace.openDocument(writableModule, null); }}
        >
          {writableModule === "goods-receipt" ? "Nhập kho mới" : "Sales mới"}
        </Button>
        <Button
          variant="outline"
          disabled={!target?.ready}
          onClick={() => workspace.splitActive()}
        >
          Tách sang phải
        </Button>
        <Button
          variant="outline"
          disabled={!target?.ready || target.kind !== "document"}
          onClick={() => {
            const captured = workspace.commands.capture();
            if (captured) workspace.commands.mark(captured);
          }}
        >
          Đánh dấu phiên
        </Button>
        <Button
          variant="outline"
          disabled={!target?.ready}
          onClick={() => {
            const id = workspace.panelState.getState().activeId;
            if (id) void workspace.closePanel(id, "command");
          }}
        >
          Đóng tài liệu
        </Button>
        <Button
          variant="outline"
          onClick={() => void workspace.close.closeAll("close-all")}
        >
          Đóng tất cả
        </Button>
        <Button
          variant="outline"
          disabled={layout.busy || closing}
          onClick={() => void workspace.layouts.restore()}
        >
          Khôi phục bố cục
        </Button>
        <Button
          variant="outline"
          disabled={layout.busy || closing}
          onClick={() => void workspace.layouts.reset()}
        >
          Đặt lại bố cục
        </Button>
        <span className="w-full text-muted-foreground">
          Bản nháp chưa lưu sẽ mất khi tải lại hoặc đóng trang. Bố cục được nhớ,
          nội dung chưa lưu không được khôi phục.
        </span>
      </div>
      {layout.message && (
        <p role="status" className="px-4 py-2">
          {layout.message}
        </p>
      )}
      <div
        className="min-h-0 flex-1"
        aria-label="Workspace mẫu"
        onKeyDownCapture={(event) => {
          if (!["Delete", "Backspace"].includes(event.key)) return;
          const target = event.target as HTMLElement;
          if (target.getAttribute("role") !== "tab") return;
          // Dockview's native tablist handler closes directly, bypassing the
          // default tab's closeActionOverride. Admit before that handler runs.
          event.preventDefault();
          event.stopPropagation();
          const id = target.querySelector<HTMLElement>(
            "[data-workspace-panel-id]",
          )?.dataset.workspacePanelId;
          if (id && !event.nativeEvent.isComposing && !event.repeat)
            void workspace.closePanel(id, "tab");
        }}
      >
        <DockviewReact
          nonce={getStyleNonce}
          components={components}
          theme={mode === "dark" ? themeDark : themeLight}
          defaultTabComponent={DocumentTab}
          disableFloatingGroups
          getTabContextMenuItems={() => []}
          getTabGroupChipContextMenuItems={() => []}
          onReady={onReady}
        />
      </div>
    </>
  );
}

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type FunctionComponent,
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
import { SalesDocumentPanel } from "../../features/sales/SalesDocumentPanel";
import { Button } from "../../components/ui/button";
import { DocumentTab } from "./DocumentTab";
import { useWorkspaceExtensions } from "./WorkspaceExtensions";
import { getStyleNonce } from "../styleNonce";
export function WorkspaceHost({
  catalogComponent,
  catalogTitle = "Danh mục mẫu",
}: {
  catalogComponent: FunctionComponent<IDockviewPanelProps>;
  catalogTitle?: string;
}) {
  const workspace = useWorkspace();
  const auth = useSyncExternalStore(workspace.auth.subscribe, workspace.auth.getSnapshot);
  const extensions = useWorkspaceExtensions();
  const { mode } = useTheme();
  const layout = useStore(workspace.layouts.state);
  const target = useStore(workspace.store, (state) =>
    state.activeSessionId ? state.sessions[state.activeSessionId] : undefined,
  );
  const [host, setHost] = useState<DockviewApi>();
  const components = useMemo(
    () => ({ catalog: catalogComponent, sales: SalesDocumentPanel }),
    [catalogComponent],
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
        const captured = workspace.commands.capture();
        if (captured) {
          event.preventDefault();
          if (event.code === "KeyW")
            void workspace.close.requestClose(captured.sessionId, "command");
          else workspace.commands.mark(captured);
        }
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [workspace]);
  return (
    <>
      <div
        role="toolbar"
        aria-label="Workspace"
        className="flex flex-wrap items-center gap-2 border-b px-4 py-2"
      >
        {extensions.toolbar}
        <Button
          variant="outline"
          disabled={layout.busy || !auth.capabilities.write}
          onClick={() => void workspace.openSalesDocument(null)}
        >
          Chứng từ mới
        </Button>
        <Button
          variant="outline"
          disabled={target?.status !== "ready"}
          onClick={() => workspace.splitActive()}
        >
          Tách sang phải
        </Button>
        <Button
          variant="outline"
          disabled={target?.status !== "ready"}
          onClick={() => {
            const captured = workspace.commands.capture();
            if (captured) workspace.commands.mark(captured);
          }}
        >
          Đánh dấu phiên
        </Button>
        <Button
          variant="outline"
          disabled={target?.status !== "ready"}
          onClick={() => {
            const captured = workspace.commands.capture();
            if (captured)
              void workspace.close.requestClose(captured.sessionId, "command");
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
          disabled={layout.busy}
          onClick={() => void workspace.layouts.restore()}
        >
          Khôi phục bố cục
        </Button>
        <Button
          variant="outline"
          disabled={layout.busy}
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
            "[data-document-session-id]",
          )?.dataset.documentSessionId;
          if (id && !event.nativeEvent.isComposing && !event.repeat)
            void workspace.close.requestClose(id, "tab");
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

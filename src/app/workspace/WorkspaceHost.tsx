import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FunctionComponent,
} from "react";
import { useStore } from "zustand";
import { DockviewDefaultTab, DockviewReact } from "dockview-react";
import {
  themeDark,
  themeLight,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
} from "dockview";
import { useTheme } from "../theme";
import { useWorkspace } from "./WorkspaceContext";
import { SalesDocumentPanel } from "../../features/sales/SalesDocumentPanel";
import { Button } from "../../components/ui/button";

function DocumentTab(props: IDockviewPanelHeaderProps) {
  return (
    <DockviewDefaultTab {...props} hideClose closeActionOverride={() => {}} />
  );
}
export function WorkspaceHost({
  catalogComponent,
}: {
  catalogComponent: FunctionComponent<IDockviewPanelProps>;
}) {
  const workspace = useWorkspace();
  const { mode } = useTheme();
  const target = useStore(workspace.store, (state) =>
    state.activeSessionId ? state.sessions[state.activeSessionId] : undefined,
  );
  const [host, setHost] = useState<DockviewApi>();
  const components = useMemo(
    () => ({ catalog: catalogComponent, sales: SalesDocumentPanel }),
    [catalogComponent],
  );
  const onReady = useCallback(({ api }: DockviewReadyEvent) => {
    api.addPanel({
      id: "foundation-catalog",
      component: "catalog",
      title: "Danh mục mẫu",
      renderer: "always",
    });
    setHost(api);
  }, []);
  useEffect(
    () => (host ? workspace.attach(host) : undefined),
    [host, workspace],
  );
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        !event.isComposing &&
        !event.repeat &&
        event.ctrlKey &&
        event.altKey &&
        event.code === "KeyM"
      ) {
        const captured = workspace.commands.capture();
        if (captured) {
          event.preventDefault();
          workspace.commands.mark(captured);
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
        <Button
          variant="outline"
          onClick={() => void workspace.openSalesDocument("1001")}
        >
          Mở mẫu 1001
        </Button>
        <Button
          variant="outline"
          onClick={() => void workspace.openSalesDocument("1002")}
        >
          Mở mẫu 1002
        </Button>
        <Button
          variant="outline"
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
        <span className="text-muted-foreground">
          Edit harness · Bản nháp mất khi tải lại trang.
        </span>
      </div>
      <div className="min-h-0 flex-1" aria-label="Workspace mẫu">
        <DockviewReact
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

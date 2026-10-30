import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
const OverlayContext = createContext<{
  host: HTMLDivElement | null;
  visible: boolean;
}>({ host: null, visible: false });
export const useLookupOverlay = () => useContext(OverlayContext);
export function LookupOverlayHost({
  children,
  visible = true,
}: {
  children: ReactNode;
  visible?: boolean;
}) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [measurable, setMeasurable] = useState(false);
  useLayoutEffect(() => {
    if (!root) return;
    const measure = () =>
      setMeasurable(
        root.getBoundingClientRect().width > 0 &&
          root.getBoundingClientRect().height > 0,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [root]);
  return (
    <div ref={setRoot} className="relative h-full min-h-0">
      <OverlayContext.Provider value={{ host, visible: visible && measurable }}>
        {children}
        <div
          ref={setHost}
          data-lookup-overlay-host
          className="pointer-events-none absolute inset-0 z-50"
        />
      </OverlayContext.Provider>
    </div>
  );
}

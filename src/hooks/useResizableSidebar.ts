import { useCallback, useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

export type SidebarLabelMode = "compact" | "comfortable" | "expanded";

interface UseResizableSidebarOptions {
  storageKey: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

function clampWidth(width: number, minWidth: number, maxWidth: number): number {
  return Math.min(maxWidth, Math.max(minWidth, Math.round(width)));
}

function readStoredWidth(storageKey: string, defaultWidth: number, minWidth: number, maxWidth: number): number {
  if (typeof window === "undefined") return defaultWidth;
  const stored = window.localStorage.getItem(storageKey);
  const parsed = stored ? Number(stored) : NaN;
  return Number.isFinite(parsed) ? clampWidth(parsed, minWidth, maxWidth) : defaultWidth;
}

export function useResizableSidebar({
  storageKey,
  defaultWidth = 320,
  minWidth = 240,
  maxWidth = 560,
}: UseResizableSidebarOptions) {
  const [width, setWidth] = useState(() => readStoredWidth(storageKey, defaultWidth, minWidth, maxWidth));

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, String(width));
  }, [storageKey, width]);

  const startResize = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setWidth(clampWidth(startWidth + moveEvent.clientX - startX, minWidth, maxWidth));
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [maxWidth, minWidth, width]);

  const resetWidth = useCallback(() => setWidth(defaultWidth), [defaultWidth]);

  const labelMode: SidebarLabelMode = width >= 420 ? "expanded" : width >= 300 ? "comfortable" : "compact";

  const sidebarStyle = useMemo<CSSProperties>(() => ({
    width,
    minWidth: width,
    maxWidth: width,
  }), [width]);

  const resizeHandleStyle = useMemo<CSSProperties>(() => ({
    width: 7,
    flexShrink: 0,
    cursor: "col-resize",
    background: "transparent",
    touchAction: "none",
    marginLeft: -4,
    marginRight: -3,
    zIndex: 2,
  }), []);

  return {
    width,
    labelMode,
    sidebarStyle,
    resizeHandleProps: {
      className: "oscal-sidebar-resize-handle",
      role: "separator",
      "aria-orientation": "vertical" as const,
      "aria-label": "Resize navigation sidebar",
      title: "Drag to resize navigation. Double-click to reset.",
      onPointerDown: startResize,
      onDoubleClick: resetWidth,
    },
    resizeHandleStyle,
  };
}

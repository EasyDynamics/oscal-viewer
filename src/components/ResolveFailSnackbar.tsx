/* ═══════════════════════════════════════════════════════════════════════════
   ResolveFailSnackbar — non-blocking notification shown when OSCAL
   cross-model dependency resolution fails (timeout, CORS, bad content).

   Auto-dismisses after 3 seconds. Shows the URL/source that failed.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { colors, fonts, radii, shadows } from "../theme/tokens";
import type { ResolveStatus } from "../hooks/useImportResolver";

export interface FailableItem {
  label: string;
  status: ResolveStatus;
  resolvedUrl?: string | null;
  error?: string | null;
}

interface Props {
  /** Items being resolved — watched for error status */
  items: FailableItem[];
}

export default function ResolveFailSnackbar({ items }: Props) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const failed = items.filter((i) => i.status === "error");
    if (failed.length === 0) return;

    const parts = failed.map(
      (f) => f.resolvedUrl ?? f.label,
    );
    setMessage(`Could not resolve: ${parts.join(", ")}`);
    setVisible(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [items.map((i) => `${i.label}:${i.status}`).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  return (
    <div style={S.snackbar} role="alert">
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={() => setVisible(false)}
        style={S.close}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  snackbar: {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 20px",
    borderRadius: radii.md,
    backgroundColor: colors.navy,
    color: colors.white,
    fontSize: 13,
    fontFamily: fonts.sans,
    boxShadow: shadows.lg,
    zIndex: 9999,
    maxWidth: "90vw",
    wordBreak: "break-word",
  },
  close: {
    background: "none",
    border: "none",
    color: colors.white,
    fontSize: 18,
    cursor: "pointer",
    padding: "0 2px",
    lineHeight: 1,
    opacity: 0.7,
  },
};

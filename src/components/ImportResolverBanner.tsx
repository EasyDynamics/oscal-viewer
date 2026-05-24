/* ═══════════════════════════════════════════════════════════════════════════
   ImportResolverBanner — visual indicator shown while a cross-model
   OSCAL import is being fetched and validated.

   States:
     • loading  — animated pulsing bar + spinner
     • success  — green confirmation with model name
     • error    — red error with message
   ═══════════════════════════════════════════════════════════════════════════ */

import type { CSSProperties } from "react";
import { Check, Link2, LoaderCircle, XCircle } from "lucide-react";
import { colors, fonts, radii, alpha } from "../theme/tokens";
import type { ResolveStatus } from "../hooks/useImportResolver";

interface Props {
  /** What model is being resolved, e.g. "Profile", "Catalog", "SSP" */
  modelLabel: string;
  /** Current resolution status */
  status: ResolveStatus;
  /** Error message when status is "error" */
  error?: string | null;
  /** Resolved resource label (shown on success) */
  resolvedLabel?: string | null;
  /** Optional additional style */
  style?: CSSProperties;
}

/* ── Keyframe animation injected once ── */
let injected = false;
function injectKeyframes() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const sheet = document.createElement("style");
  sheet.textContent = `
    @keyframes oscal-resolve-pulse {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @keyframes oscal-resolve-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes oscal-resolve-fade-in {
      0% { opacity: 0; transform: translateY(-4px); }
      100% { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(sheet);
}

function Spinner({ size = 18, color }: { size?: number; color: string }) {
  return <LoaderCircle size={size} color={color} style={{ animation: "oscal-resolve-spin 0.8s linear infinite", flexShrink: 0 }} />;
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return <Check size={size} strokeWidth={2.5} />;
}

function ErrorIcon({ size = 16 }: { size?: number }) {
  return <XCircle size={size} />;
}

function LinkIcon({ size = 14 }: { size?: number }) {
  return <Link2 size={size} />;
}

export default function ImportResolverBanner({ modelLabel, status, error, resolvedLabel, style }: Props) {
  injectKeyframes();

  if (status === "idle") return null;

  const isLoading = status === "loading";
  const isSuccess = status === "success";
  const isError = status === "error";

  const bgColor = isLoading
    ? alpha(colors.cobalt, 6)
    : isSuccess
      ? alpha(colors.successFg, 6)
      : alpha(colors.dangerFg, 6);

  const borderColor = isLoading
    ? colors.cobalt
    : isSuccess
      ? colors.successFg
      : colors.dangerFg;

  const textColor = isLoading
    ? colors.cobalt
    : isSuccess
      ? colors.successFg
      : colors.dangerFg;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: radii.md,
        border: `1px solid ${borderColor}`,
        backgroundColor: bgColor,
        padding: "12px 16px",
        marginBottom: 12,
        animation: "oscal-resolve-fade-in 0.25s ease-out",
        ...style,
      }}
    >
      {/* Animated shimmer bar for loading */}
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${borderColor}, transparent)`,
            backgroundSize: "200% 100%",
            animation: "oscal-resolve-pulse 1.5s ease-in-out infinite",
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Status icon */}
        {isLoading && <Spinner color={textColor} />}
        {isSuccess && (
          <span style={{ color: textColor, display: "inline-flex" }}>
            <CheckIcon />
          </span>
        )}
        {isError && (
          <span style={{ color: textColor, display: "inline-flex" }}>
            <ErrorIcon />
          </span>
        )}

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <LinkIcon size={13} />
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: textColor,
                letterSpacing: 0.3,
              }}
            >
              {isLoading && `Resolving ${modelLabel}…`}
              {isSuccess && `${modelLabel} Loaded`}
              {isError && `${modelLabel} Resolution Failed`}
            </span>
          </div>
          {isLoading && (
            <div style={{ fontSize: 11, color: colors.gray, marginTop: 3 }}>
              Fetching and validating the referenced document
            </div>
          )}
          {isSuccess && resolvedLabel && (
            <div
              style={{
                fontSize: 11,
                color: colors.gray,
                marginTop: 3,
                fontFamily: fonts.mono,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {resolvedLabel}
            </div>
          )}
          {isError && error && (
            <div style={{ fontSize: 11, color: textColor, marginTop: 3, lineHeight: 1.4 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

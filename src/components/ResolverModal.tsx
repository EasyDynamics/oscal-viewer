/* ═══════════════════════════════════════════════════════════════════════════
   ResolverModal — blocking modal popup shown while the viewer
   auto-resolves cross-model OSCAL dependencies.

   Shows live per-dependency status with the full source URL, source-
   specific icons (GitHub, oscal.io, generic), and uses the color
   scheme from the How It Works help page.  Requires the user to click
   "Continue" before they can interact with the page.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { CheckCircle2, Ellipsis, ExternalLink, GitFork, Link2, LoaderCircle, Settings, XCircle } from "lucide-react";
import { colors, fonts, radii, shadows, alpha } from "../theme/tokens";
import type { ResolveStatus } from "../hooks/useImportResolver";

/* ── Types ── */

export interface ResolverItem {
  /** Human label, e.g. "Catalog", "Profile", "SSP" */
  label: string;
  /** Live status of this dependency */
  status: ResolveStatus;
  /** Error text when status is "error" */
  error?: string | null;
  /** Resolved file/resource name shown on success */
  resolvedLabel?: string | null;
  /** Full URL that was fetched */
  resolvedUrl?: string | null;
}

interface Props {
  /** Array of dependencies being resolved */
  items: ResolverItem[];
  /** Called when the user clicks "Skip" to abort in-flight fetches */
  onSkip?: () => void;
}

/* ── Color scheme matching How-It-Works page ── */
const MODEL_COLORS: Record<string, string> = {
  catalog: colors.navy,
  profile: colors.brightBlue,
  ssp: colors.darkGreen,
  "system security plan": colors.darkGreen,
  "component definition": colors.cobalt,
  "assessment plan": colors.purple,
  "assessment results": colors.purple,
  "poa&m": colors.red,
  poam: colors.red,
};

function modelColor(label: string): string {
  return MODEL_COLORS[label.toLowerCase()] ?? colors.cobalt;
}

/* ── Source detection ── */

function isGitHub(url: string): boolean {
  try { const h = new URL(url).hostname; return h === "github.com" || h === "raw.githubusercontent.com" || h.endsWith(".github.io"); } catch { return false; }
}

function isOscalIo(url: string): boolean {
  try { const h = new URL(url).hostname; return h === "oscal.io" || h.endsWith(".oscal.io"); } catch { return false; }
}

/* ── Keyframes (injected once) ── */
let injected = false;
function injectKeyframes() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const sheet = document.createElement("style");
  sheet.textContent = `
    @keyframes resolver-modal-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes resolver-modal-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @keyframes resolver-modal-fade-in {
      0% { opacity: 0; transform: scale(0.96) translateY(8px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes resolver-modal-check-pop {
      0% { transform: scale(0); opacity: 0; }
      60% { transform: scale(1.3); }
      100% { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(sheet);
}

/* ── Icon helpers ── */

function Spinner({ size = 18, color }: { size?: number; color: string }) {
  return <LoaderCircle size={size} color={color} style={{ animation: "resolver-modal-spin 0.8s linear infinite", flexShrink: 0 }} />;
}

function CheckCircle({ size = 20 }: { size?: number }) {
  return <CheckCircle2 size={size} style={{ animation: "resolver-modal-check-pop 0.35s ease-out", color: colors.successFg }} />;
}

function ErrorCircle({ size = 20 }: { size?: number }) {
  return <XCircle size={size} style={{ color: colors.dangerFg }} />;
}

function WaitingDots({ size = 20 }: { size?: number }) {
  return <Ellipsis size={size} style={{ color: colors.gray }} />;
}

function GitHubIcon({ size = 18 }: { size?: number }) {
  return <GitFork size={size} style={{ flexShrink: 0 }} />;
}

function OscalIoIcon({ size = 18 }: { size?: number }) {
  return <Settings size={size} style={{ flexShrink: 0 }} />;
}

function ExternalIcon({ size = 18 }: { size?: number }) {
  return <ExternalLink size={size} style={{ flexShrink: 0 }} />;
}

function SourceIcon({ url }: { url: string }) {
  if (isGitHub(url)) return <GitHubIcon />;
  if (isOscalIo(url)) return <OscalIoIcon />;
  return <ExternalIcon />;
}

/* ── Component ── */

export default function ResolverModal({ items, onSkip }: Props) {
  injectKeyframes();

  // "activated" latches to true once any item goes non-idle,
  // and only resets when the user clicks Continue.
  const [activated, setActivated] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Snapshot each item at its "best" state so that if the hook
  // resets to idle after setting context, we still display success/error.
  const snapshotRef = useRef<Map<string, ResolverItem>>(new Map());

  // Track the item identities that were dismissed so we don't re-trigger
  // for the same resolution set.
  const dismissedKeyRef = useRef<string | null>(null);

  const anyNonIdle = items.some((i) => i.status !== "idle");
  const itemKey = items
    .map((i) => `${i.label}:${i.resolvedUrl ?? ""}`)
    .sort()
    .join("|");

  // Latch activated when any item goes non-idle, but not if we just dismissed this set
  useEffect(() => {
    if (anyNonIdle && !activated && !dismissed && dismissedKeyRef.current !== itemKey) {
      setActivated(true);
      setDismissed(false);
      snapshotRef.current = new Map();
    }
  }, [anyNonIdle, activated, dismissed, itemKey]);

  // Reset dismissed flag when items go back to all-idle (new document load)
  useEffect(() => {
    if (!anyNonIdle && dismissed) {
      setDismissed(false);
      dismissedKeyRef.current = null;
    }
  }, [anyNonIdle, dismissed]);

  // Update snapshots: keep the most "advanced" state per item
  useEffect(() => {
    if (!activated) return;
    const ORDER: Record<ResolveStatus, number> = { idle: 0, loading: 1, error: 2, success: 3 };
    for (const item of items) {
      const existing = snapshotRef.current.get(item.label);
      if (!existing || ORDER[item.status] > ORDER[existing.status]) {
        snapshotRef.current.set(item.label, { ...item });
      }
    }
  }, [items, activated]);

  // When dismissed, record the key so we don't re-trigger for the same items
  function handleContinue() {
    setDismissed(true);
    setActivated(false);
    dismissedKeyRef.current = itemKey;
    snapshotRef.current = new Map();
  }

  if (!activated || dismissed) return null;

  // Use snapshot items for display (fall back to live items).  Chain resolvers
  // can reset to idle immediately after storing a resolved document in context;
  // keep the modal content visible until the user clicks Continue.
  const displayItems = items.length > 0
    ? items.map((item) => snapshotRef.current.get(item.label) ?? item)
    : Array.from(snapshotRef.current.values());

  const anyLoading = displayItems.some((i) => i.status === "loading");
  const anyError = displayItems.some((i) => i.status === "error");
  const successCount = displayItems.filter((i) => i.status === "success").length;
  const doneCount = displayItems.filter((i) => i.status === "success" || i.status === "error").length;
  const totalCount = displayItems.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div style={S.overlay} role="dialog" aria-modal="true" aria-label="Resolving OSCAL dependencies">
      <div style={S.modal}>
        {/* Shimmer bar at top when loading */}
        {anyLoading && <div style={S.shimmer} />}

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: radii.md, backgroundColor: alpha(colors.navy, 10), color: colors.navy, flexShrink: 0 }}>
            <Link2 size={22} />
          </div>
          <div>
            <h2 style={S.title}>Resolving OSCAL Dependencies</h2>
            <p style={S.subtitle}>
              {anyLoading
                ? "Fetching and validating referenced documents\u2026"
                : anyError
                  ? "Some dependencies could not be resolved"
                  : "All dependencies resolved"}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div style={S.progressTrack}>
          <div
            style={{
              ...S.progressFill,
              width: `${progressPct}%`,
              backgroundColor: anyLoading ? colors.cobalt : anyError ? colors.dangerFg : colors.successFg,
            }}
          />
        </div>
        <div style={S.progressLabel}>
          {anyLoading
            ? `${doneCount} of ${totalCount} resolved`
            : anyError
              ? `${successCount} of ${totalCount} resolved successfully`
              : `${totalCount} of ${totalCount} resolved`}
        </div>

        {/* Item list */}
        <div style={S.itemList}>
          {displayItems.map((item, i) => {
            const mc = modelColor(item.label);
            return (
              <div key={i} style={{ ...S.item, borderLeft: `3px solid ${mc}` }}>
                {/* Status icon */}
                <div style={S.itemIcon}>
                  {item.status === "idle" && <WaitingDots />}
                  {item.status === "loading" && <Spinner color={mc} />}
                  {item.status === "success" && <CheckCircle />}
                  {item.status === "error" && <ErrorCircle />}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: item.status === "success" ? colors.successFg
                      : item.status === "error" ? colors.dangerFg
                      : mc,
                  }}>
                    {item.status === "loading" && `Resolving ${item.label}\u2026`}
                    {item.status === "success" && `${item.label} loaded`}
                    {item.status === "error" && `${item.label} failed`}
                    {item.status === "idle" && `${item.label}`}
                  </div>

                  {/* Full source URL with source icon */}
                  {item.resolvedUrl && (
                    <div style={S.urlRow}>
                      <span style={{ color: colors.gray }}>
                        <SourceIcon url={item.resolvedUrl} />
                      </span>
                      <span style={S.urlText}>{item.resolvedUrl}</span>
                    </div>
                  )}

                  {/* Error message */}
                  {item.status === "error" && item.error && (
                    <div style={S.errorText}>{item.error}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, padding: "8px 24px 24px" }}>
          {anyLoading && (
            <button
              style={{ ...S.btn, margin: 0, flex: 1, backgroundColor: colors.gray }}
              onClick={() => { onSkip?.(); handleContinue(); }}
            >
              Skip
            </button>
          )}
          <button
            style={{
              ...S.btn,
              margin: 0,
              flex: 1,
              ...(anyLoading ? S.btnDisabled : {}),
            }}
            disabled={anyLoading}
            onClick={handleContinue}
          >
            {anyLoading ? "Please wait\u2026" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const S: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
    backdropFilter: "blur(3px)",
  },
  modal: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    boxShadow: shadows.lg,
    width: "100%",
    maxWidth: 520,
    margin: "0 16px",
    animation: "resolver-modal-fade-in 0.3s ease-out",
  },
  shimmer: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: `linear-gradient(90deg, transparent, ${colors.cobalt}, transparent)`,
    backgroundSize: "200% 100%",
    animation: "resolver-modal-shimmer 1.5s ease-in-out infinite",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "24px 24px 0",
  },
  title: {
    fontSize: 17,
    fontWeight: 700,
    color: colors.navy,
    margin: 0,
  },
  subtitle: {
    fontSize: 12,
    color: colors.gray,
    margin: "3px 0 0",
  },
  progressTrack: {
    margin: "16px 24px 0",
    height: 4,
    backgroundColor: alpha(colors.gray, 15),
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    transition: "width 0.4s ease, background-color 0.3s ease",
  },
  progressLabel: {
    fontSize: 11,
    color: colors.gray,
    textAlign: "right" as const,
    padding: "4px 24px 0",
  },
  itemList: {
    padding: "12px 24px 8px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  item: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "10px 12px",
    backgroundColor: alpha(colors.gray, 5),
    borderRadius: radii.sm,
  },
  itemIcon: {
    flexShrink: 0,
    marginTop: 1,
  },
  resolvedName: {
    fontSize: 11,
    color: colors.gray,
    fontFamily: fonts.mono,
    marginTop: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  urlRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  urlText: {
    fontSize: 10.5,
    fontFamily: fonts.mono,
    color: colors.gray,
    wordBreak: "break-all" as const,
    flex: 1,
    minWidth: 0,
  },
  errorText: {
    fontSize: 11,
    color: colors.dangerFg,
    marginTop: 2,
    wordBreak: "break-all" as const,
  },
  btn: {
    display: "block",
    width: "calc(100% - 48px)",
    margin: "8px 24px 24px",
    padding: "10px 0",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.sans,
    color: colors.white,
    backgroundColor: colors.navy,
    border: "none",
    borderRadius: radii.sm,
    cursor: "pointer",
    transition: "background-color 0.2s ease",
  },
  btnDisabled: {
    backgroundColor: alpha(colors.navy, 40),
    cursor: "not-allowed",
  },
};

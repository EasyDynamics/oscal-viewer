/* ═══════════════════════════════════════════════════════════════════════════
   Home Page — Dashboard with cards linking to each OSCAL model viewer.
   ═══════════════════════════════════════════════════════════════════════════ */

import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { GitFork, Grid3X3, Shield, TriangleAlert, Upload } from "lucide-react";
import { alpha, colors, fonts, oscalModels, shadows, radii, brand } from "../theme/tokens";
import useIsMobile from "../hooks/useIsMobile";
import { useOscal, type Catalog } from "../context/OscalContext";

type UploadModelKey = "catalog" | "profile" | "component-definition" | "ssp" | "assessment-plan" | "assessment-results" | "poam";

interface DetectedOscalDocument {
  modelKey: UploadModelKey;
  payload: unknown;
}

const MODEL_PATHS: Record<UploadModelKey, string> = {
  catalog: "/catalog",
  profile: "/profile",
  "component-definition": "/component-definition",
  ssp: "/ssp",
  "assessment-plan": "/assessment-plan",
  "assessment-results": "/assessment-results",
  poam: "/poam",
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function detectOscalDocument(json: unknown): DetectedOscalDocument | null {
  const obj = asObject(json);
  if (!obj) return null;

  if (asObject(obj.catalog)) return { modelKey: "catalog", payload: obj.catalog };
  if (asObject(obj.profile)) return { modelKey: "profile", payload: obj.profile };
  if (asObject(obj["component-definition"])) return { modelKey: "component-definition", payload: obj["component-definition"] };
  if (asObject(obj["system-security-plan"])) return { modelKey: "ssp", payload: json };
  if (asObject(obj["assessment-plan"])) return { modelKey: "assessment-plan", payload: json };
  if (asObject(obj["assessment-results"])) return { modelKey: "assessment-results", payload: obj["assessment-results"] };
  if (asObject(obj["plan-of-action-and-milestones"])) return { modelKey: "poam", payload: obj["plan-of-action-and-milestones"] };

  if (asObject(obj.metadata)) {
    if (Array.isArray(obj.groups) || Array.isArray(obj.controls)) return { modelKey: "catalog", payload: json };
    if (Array.isArray(obj.imports)) return { modelKey: "profile", payload: json };
    if (Array.isArray(obj.components) || Array.isArray(obj.capabilities)) return { modelKey: "component-definition", payload: json };
    if (obj["system-characteristics"] || obj["system-implementation"] || obj["control-implementation"] || obj["import-profile"]) return { modelKey: "ssp", payload: json };
    if (obj["import-ssp"] && (obj["reviewed-controls"] || obj.tasks || obj["assessment-assets"])) return { modelKey: "assessment-plan", payload: json };
    if (obj["import-ap"] || obj.results) return { modelKey: "assessment-results", payload: json };
    if (obj.risks || obj.findings || obj["poam-items"] || obj["local-definitions"]) return { modelKey: "poam", payload: json };
  }

  return null;
}

function hasDraggedFiles(dataTransfer: DataTransfer | null): boolean {
  return Boolean(dataTransfer && Array.from(dataTransfer.types).includes("Files"));
}

function isFileDrag(e: DragEvent): boolean {
  return hasDraggedFiles(e.dataTransfer);
}

export default function HomePage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const oscal = useOscal();
  const [notesOpen, setNotesOpen] = useState(false);
  const [draggingFile, setDraggingFile] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const dragDepth = useRef(0);

  const storeDetectedDocument = useCallback((detected: DetectedOscalDocument, fileName: string) => {
    switch (detected.modelKey) {
      case "catalog": oscal.setCatalog(detected.payload as Catalog, fileName); break;
      case "profile": oscal.setProfile(detected.payload, fileName); break;
      case "component-definition": oscal.setComponentDefinition(detected.payload, fileName); break;
      case "ssp": oscal.setSsp(detected.payload, fileName); break;
      case "assessment-plan": oscal.setAssessmentPlan(detected.payload, fileName); break;
      case "assessment-results": oscal.setAssessmentResults(detected.payload, fileName); break;
      case "poam": oscal.setPoam(detected.payload, fileName); break;
    }
    navigate(MODEL_PATHS[detected.modelKey]);
  }, [navigate, oscal]);

  const uploadFile = useCallback((file: File) => {
    setUploadError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(String(e.target?.result ?? ""));
        const detected = detectOscalDocument(json);
        if (!detected) throw new Error("Could not identify the OSCAL model in this JSON file.");
        storeDetectedDocument(detected, file.name);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed to upload OSCAL document.");
      }
    };
    reader.onerror = () => setUploadError("Failed to read file.");
    reader.readAsText(file);
  }, [storeDetectedDocument]);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setDraggingFile(true);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setDraggingFile(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDraggingFile(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDraggingFile(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  useEffect(() => {
    const handleWindowDragEnter = (e: globalThis.DragEvent) => {
      if (!hasDraggedFiles(e.dataTransfer)) return;
      e.preventDefault();
      setDraggingFile(true);
    };
    const handleWindowDragOver = (e: globalThis.DragEvent) => {
      if (!hasDraggedFiles(e.dataTransfer)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setDraggingFile(true);
    };
    const handleWindowDrop = (e: globalThis.DragEvent) => {
      if (!hasDraggedFiles(e.dataTransfer)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDraggingFile(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) uploadFile(file);
    };
    const handleWindowDragLeave = (e: globalThis.DragEvent) => {
      if (e.clientX > 0 && e.clientY > 0 && e.clientX < window.innerWidth && e.clientY < window.innerHeight) return;
      dragDepth.current = 0;
      setDraggingFile(false);
    };
    const handleWindowDragEnd = () => {
      dragDepth.current = 0;
      setDraggingFile(false);
    };

    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("dragend", handleWindowDragEnd);
    return () => {
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("dragend", handleWindowDragEnd);
    };
  }, [uploadFile]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={styles.pageWrap}
    >
      {draggingFile && (
        <div style={styles.dragOverlay}>
          <div style={styles.dragFrame}>
            <div style={styles.dropHint}>
              <Upload size={18} />
              <span>Drop OSCAL JSON to upload</span>
            </div>
          </div>
        </div>
      )}
      {uploadError && <div style={styles.uploadError}>{uploadError}</div>}

      {/* Welcome banner */}
      <div style={{ ...styles.banner, ...(isMobile ? { padding: "12px 14px", marginBottom: 16 } : {}) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isMobile ? 2 : 4 }}>
          {brand.favicon ? (
            <img src={brand.favicon} alt="" style={{ height: isMobile ? 22 : 28 }} />
          ) : (
            <Shield size={isMobile ? 22 : 28} style={{ color: colors.orange }} />
          )}
          <h1 style={{ ...styles.heading, ...(isMobile ? { fontSize: "1.1rem" } : {}) }}>{brand.heading}</h1>
          <a
            href="https://github.com/EasyDynamics/oscal-viewer"
            target="_blank"
            rel="noopener noreferrer"
            title="View on GitHub"
            style={{ display: "inline-flex", marginLeft: 8, color: colors.navy }}
          >
            <GitFork size={isMobile ? 20 : 24} />
          </a>
        </div>
        <p style={{ ...styles.subtitle, ...(isMobile ? { fontSize: 13, lineHeight: 1.4, marginBottom: 0 } : {}) }}>
          {isMobile
            ? "View and explore OSCAL documents. Select a model below."
            : "A client-side tool for viewing and exploring OSCAL (Open Security Controls Assessment Language) documents. Select a model below to get started."}
        </p>

        {/* Notes — full on desktop, collapsible on mobile */}
        {isMobile ? (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setNotesOpen((v) => !v)}
              style={styles.notesToggle}
            >
              <Shield size={12} style={{ color: colors.navy, flexShrink: 0 }} />
              <span>Privacy &amp; Heads&nbsp;up</span>
              <span style={{ marginLeft: "auto", fontSize: 10 }}>{notesOpen ? "▲" : "▼"}</span>
            </button>
            {notesOpen && (
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                <div style={{ ...styles.noteCard, padding: "8px 10px" }}>
                  <div style={styles.noteHeader}>
                    <Shield size={14} style={{ color: colors.navy, flexShrink: 0 }} />
                    <span style={styles.noteLabel}>Privacy</span>
                  </div>
                  <p style={{ ...styles.noteText, fontSize: 12 }}>
                    Everything runs in your browser. No server, no database, no cookies. 🍪
                  </p>
                </div>
                <div style={{ ...styles.noteCard, padding: "8px 10px" }}>
                  <div style={styles.noteHeader}>
                    <TriangleAlert size={14} style={{ color: colors.yellow, flexShrink: 0 }} />
                    <span style={styles.noteLabel}>Heads up</span>
                  </div>
                  <p style={{ ...styles.noteText, fontSize: 12 }}>
                    Downstream models reference <em>catalogs</em> for control info, not profiles.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.notesRow}>
            <div style={styles.noteCard}>
              <div style={styles.noteHeader}>
                <Shield size={16} style={{ color: colors.navy, flexShrink: 0 }} />
                <span style={styles.noteLabel}>Privacy</span>
              </div>
              <p style={styles.noteText}>
                This tool is self-contained in your browser. Your OSCAL data never leaves your machine.
                There is no server. There is no database. There is no cloud.
                There is only your browser tab, doing all the work, asking for nothing in return. 🛡️
              </p>
            </div>
            <div style={styles.noteCard}>
              <div style={styles.noteHeader}>
                <TriangleAlert size={16} style={{ color: colors.yellow, flexShrink: 0 }} />
                <span style={styles.noteLabel}>Heads up</span>
              </div>
              <p style={styles.noteText}>
                Profile support is available for viewing profile documents, but all
                downstream models (SSP, Component Definition, etc.) reference <em>catalogs</em> for
                control information — not profiles.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Model cards grid */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isMobile ? 8 : 16 }}>
        <Grid3X3 size={16} style={{ color: colors.gray }} />
        <h2 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: colors.black, margin: 0 }}>
          OSCAL Models
        </h2>
      </div>

      <div style={{ ...styles.grid, ...(isMobile ? { gridTemplateColumns: "1fr 1fr", gap: 8 } : {}) }}>
        {oscalModels.map((m) => {
          const inner = (
            <div
              style={{
                ...(isMobile ? styles.cardMobile : styles.card),
                borderTop: `${isMobile ? 3 : 4}px solid ${m.disabled ? colors.gray : m.color}`,
                ...(m.disabled ? { opacity: 0.45, cursor: "default", filter: "grayscale(50%)" } : {}),
              }}
            >
              {!isMobile && (
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: m.disabled ? colors.gray : m.color,
                    marginBottom: 8,
                  }}
                />
              )}
              <h3 style={{
                ...(isMobile ? styles.cardTitleMobile : styles.cardTitle),
                color: m.disabled ? colors.gray : m.color,
              }}>{m.label}</h3>
              {!isMobile && <p style={styles.cardDesc}>{m.description}</p>}
              {m.disabled
                ? <span style={{ fontSize: isMobile ? 10 : 12, fontWeight: 500, color: colors.gray, fontStyle: "italic" }}>Coming soon</span>
                : <span style={{ ...(isMobile ? styles.cardLinkMobile : styles.cardLink) }}>Open →</span>}
            </div>
          );
          return m.disabled ? (
            <div key={m.key} style={{ textDecoration: "none" }}>{inner}</div>
          ) : (
            <Link key={m.key} to={m.path} style={{ textDecoration: "none" }}>{inner}</Link>
          );
        })}
      </div>

      {/* Subtle link to Docs */}
      <div style={{ textAlign: "center", marginTop: isMobile ? 20 : 32, paddingBottom: 8 }}>
        <Link
          to="/docs"
          style={{ fontSize: 12, color: colors.gray, textDecoration: "none", fontFamily: fonts.sans }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = colors.brightBlue; (e.target as HTMLElement).style.textDecoration = "underline"; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = colors.gray; (e.target as HTMLElement).style.textDecoration = "none"; }}
        >
          View documentation →
        </Link>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  pageWrap: {
    minHeight: "calc(100vh - 160px)",
    position: "relative",
  },
  dropHint: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: radii.pill,
    backgroundColor: alpha(colors.navy, 92),
    color: colors.white,
    boxShadow: shadows.lg,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.01em",
  },
  dragOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    padding: 18,
    backgroundColor: alpha(colors.navy, 16),
    pointerEvents: "none",
  },
  dragFrame: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `2px dashed ${alpha(colors.brightBlue, 70)}`,
    borderRadius: radii.lg,
    backgroundColor: alpha(colors.brightBlue, 7),
    boxShadow: `inset 0 0 0 9999px ${alpha(colors.white, 6)}`,
  },
  uploadError: {
    marginBottom: 12,
    padding: "8px 10px",
    borderRadius: radii.sm,
    backgroundColor: alpha(colors.red, 10),
    border: `1px solid ${alpha(colors.red, 30)}`,
    color: colors.red,
    fontSize: 12,
    fontFamily: fonts.sans,
    fontWeight: 600,
  },
  banner: {
    backgroundColor: colors.card,
    borderLeft: `5px solid ${colors.orange}`,
    borderRadius: radii.md,
    padding: "28px 32px",
    marginBottom: 32,
    boxShadow: shadows.sm,
  },
  heading: {
    fontSize: "1.8rem",
    fontFamily: fonts.sans,
    fontWeight: 700,
    color: colors.navy,
    margin: 0,
  },
  subtitle: {
    fontSize: 15,
    color: colors.black,
    lineHeight: 1.7,
    marginTop: 4,
    marginBottom: 0,
  },
  notesRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginTop: 20,
  },
  noteCard: {
    backgroundColor: colors.bg,
    border: `1px solid ${colors.paleGray}`,
    borderRadius: radii.sm,
    padding: "12px 14px",
  },
  noteHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: colors.navy,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 1.6,
    color: colors.black,
    margin: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: "20px 24px",
    boxShadow: shadows.sm,
    transition: "box-shadow .2s, transform .15s",
    cursor: "pointer",
    height: "100%",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    fontFamily: fonts.sans,
    margin: 0,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.black,
    lineHeight: 1.6,
    marginBottom: 12,
  },
  cardLink: {
    fontSize: 13,
    fontWeight: 500,
    color: colors.orange,
  },

  /* Mobile-specific */
  notesToggle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: "100%",
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 600,
    fontFamily: fonts.sans,
    color: colors.navy,
    backgroundColor: colors.bg,
    border: `1px solid ${colors.paleGray}`,
    borderRadius: radii.sm,
    cursor: "pointer",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  } as CSSProperties,
  cardMobile: {
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    padding: "10px 10px",
    boxShadow: shadows.sm,
    cursor: "pointer",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "flex-start",
  } as CSSProperties,
  cardTitleMobile: {
    fontSize: 13,
    fontWeight: 600,
    fontFamily: fonts.sans,
    margin: "0 0 4px",
    lineHeight: 1.2,
  } as CSSProperties,
  cardLinkMobile: {
    fontSize: 11,
    fontWeight: 500,
    color: colors.orange,
  } as CSSProperties,
};

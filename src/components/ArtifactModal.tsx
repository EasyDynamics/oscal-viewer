import { useEffect, useMemo, useState, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { colors, fonts, radii, shadows } from "../theme/tokens";

export interface ArtifactItem {
  title: string;
  href: string;
  mediaType?: string;
  fileName?: string;
  description?: string;
  textContent?: string;
}

function normalizedMediaType(artifact: ArtifactItem): string {
  const mediaType = artifact.mediaType?.toLowerCase() ?? "";
  if (mediaType) return mediaType;

  const href = artifact.href.toLowerCase().split(/[?#]/)[0];
  if (href.startsWith("data:")) {
    const meta = href.slice(5, href.indexOf(",") === -1 ? undefined : href.indexOf(","));
    return meta.split(";")[0] || "application/octet-stream";
  }
  if (/\.(md|markdown)$/.test(href)) return "text/markdown";
  if (/\.(txt|log)$/.test(href)) return "text/plain";
  if (/\.json$/.test(href)) return "application/json";
  if (/\.pdf$/.test(href)) return "application/pdf";
  if (/\.svg$/.test(href)) return "image/svg+xml";
  if (/\.png$/.test(href)) return "image/png";
  if (/\.(jpg|jpeg)$/.test(href)) return "image/jpeg";
  if (/\.gif$/.test(href)) return "image/gif";
  if (/\.webp$/.test(href)) return "image/webp";
  return "application/octet-stream";
}

function dataUrlText(url: string): string {
  const comma = url.indexOf(",");
  if (!url.startsWith("data:") || comma === -1) return "";
  const meta = url.slice(0, comma).toLowerCase();
  const data = url.slice(comma + 1);
  if (!meta.includes(";base64")) return decodeURIComponent(data);

  const bytes = Uint8Array.from(atob(data.replace(/\s+/g, "")), (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function isTextMedia(mediaType: string): boolean {
  return (
    mediaType.startsWith("text/") ||
    mediaType.includes("markdown") ||
    mediaType.includes("json") ||
    mediaType.includes("yaml") ||
    mediaType.includes("xml")
  );
}

function isMarkdownMedia(mediaType: string, href: string): boolean {
  const lowerHref = href.toLowerCase().split(/[?#]/)[0];
  return mediaType.includes("markdown") || lowerHref.endsWith(".md") || lowerHref.endsWith(".markdown");
}

function downloadName(artifact: ArtifactItem): string {
  if (artifact.fileName) return artifact.fileName;
  try {
    const url = new URL(artifact.href);
    const segment = url.pathname.split("/").filter(Boolean).pop();
    if (segment) return segment;
  } catch {
    // data URLs and relative paths fall through to title
  }
  return artifact.title || "artifact";
}

function TextArtifact({ artifact, mediaType }: { artifact: ArtifactItem; mediaType: string }) {
  const [text, setText] = useState(artifact.textContent ?? "");
  const [error, setError] = useState("");
  const markdown = isMarkdownMedia(mediaType, artifact.href);

  useEffect(() => {
    if (artifact.textContent !== undefined) {
      setText(artifact.textContent);
      setError("");
      return;
    }
    if (artifact.href.startsWith("data:")) {
      try {
        setText(dataUrlText(artifact.href));
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to decode embedded artifact.");
      }
      return;
    }

    let cancelled = false;
    setText("");
    setError("");
    fetch(artifact.href)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.text();
      })
      .then((body) => {
        if (!cancelled) setText(body);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load artifact.");
      });
    return () => {
      cancelled = true;
    };
  }, [artifact.href, artifact.textContent]);

  if (error) return <ArtifactPlaceholder message={error} />;
  if (!text) return <ArtifactPlaceholder message="Loading artifact…" />;

  if (markdown) {
    return (
      <div className="oscal-markup" style={markdownPaneStyle}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    );
  }

  const displayText = mediaType.includes("json") ? formatJson(text) : text;
  return <pre style={textPaneStyle}>{displayText}</pre>;
}

function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function ArtifactPlaceholder({ message }: { message: string }) {
  return (
    <div style={{ height: "100%", minHeight: 280, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, color: colors.gray, fontSize: 13, backgroundColor: colors.surfaceSubtle }}>
      {message}
    </div>
  );
}

function ArtifactBody({ artifact }: { artifact: ArtifactItem }) {
  const mediaType = useMemo(() => normalizedMediaType(artifact), [artifact]);

  if (mediaType.startsWith("image/")) {
    return (
      <div style={centerPaneStyle}>
        <img src={artifact.href} alt={artifact.title} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
      </div>
    );
  }

  if (mediaType.includes("pdf")) {
    return <iframe title={artifact.title} src={artifact.href} style={{ width: "100%", height: "100%", border: 0, backgroundColor: colors.white }} />;
  }

  if (isTextMedia(mediaType)) {
    return <TextArtifact artifact={artifact} mediaType={mediaType} />;
  }

  return (
    <ArtifactPlaceholder message={`Preview is not available for ${mediaType || "this artifact type"}. Use Open source to view or download it.`} />
  );
}

export default function ArtifactModal({ artifact, onClose }: { artifact: ArtifactItem | null; onClose: () => void }) {
  if (!artifact) return null;
  const mediaType = normalizedMediaType(artifact);
  const name = downloadName(artifact);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={artifact.title}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 2200, backgroundColor: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
    >
      <div onClick={(event) => event.stopPropagation()} style={{ width: "min(1180px, 98vw)", height: "min(900px, 96vh)", backgroundColor: colors.card, borderRadius: radii.lg, boxShadow: shadows.lg, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${colors.paleGray}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: colors.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{artifact.title}</div>
            <div style={{ fontSize: 10, color: colors.gray, fontFamily: fonts.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mediaType} · {artifact.href}</div>
          </div>
          <a href={artifact.href} target="_blank" rel="noopener noreferrer" style={modalActionStyle}>Open source</a>
          <a href={artifact.href} download={name} style={modalActionStyle}>Download</a>
          <button onClick={onClose} aria-label="Close artifact viewer" style={{ border: "none", background: "none", fontSize: 22, lineHeight: 1, cursor: "pointer", color: colors.gray }}>×</button>
        </div>
        {artifact.description && (
          <div style={{ padding: "8px 16px", borderBottom: `1px solid ${colors.paleGray}`, fontSize: 12, color: colors.gray, lineHeight: 1.5 }}>
            {artifact.description}
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, backgroundColor: colors.surfaceSubtle }}>
          <ArtifactBody artifact={artifact} />
        </div>
      </div>
    </div>
  );
}

const modalActionStyle: CSSProperties = {
  fontSize: 12,
  color: colors.cobalt,
  fontWeight: 700,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const centerPaneStyle: CSSProperties = {
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const markdownPaneStyle: CSSProperties = {
  height: "100%",
  overflow: "auto",
  maxWidth: 900,
  margin: "0 auto",
  padding: "28px 32px",
  backgroundColor: colors.card,
  color: colors.black,
  fontSize: 14,
  lineHeight: 1.75,
};

const textPaneStyle: CSSProperties = {
  height: "100%",
  overflow: "auto",
  margin: 0,
  padding: 20,
  backgroundColor: colors.card,
  color: colors.black,
  fontSize: 12,
  lineHeight: 1.6,
  fontFamily: fonts.mono,
  whiteSpace: "pre-wrap",
};

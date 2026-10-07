import { createContext, useContext, useMemo, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { colors } from "../theme/tokens";
import { isPlainLine, markupLineSource, renderMarkupLine, renderProse, type ProseParam } from "../utils/markup";

/** OSCAL markup fields hold either a string or a `{ prose }` object. */
function markupText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "prose" in value) return String(value.prose);
  return String(value);
}

/**
 * Opens the view a `#fragment` link in markup points at (a control, a
 * resource, a finding, ...) and returns true, or returns false to leave the
 * link alone. Each page provides one through <MarkupLinks>.
 */
export type FragmentLinkResolver = (id: string) => boolean;

const FragmentLinkContext = createContext<FragmentLinkResolver | null>(null);

/** Makes `#fragment` links in the markup below open views inside the viewer. */
export function MarkupLinks({ resolve, children }: { resolve: FragmentLinkResolver; children: ReactNode }) {
  return <FragmentLinkContext.Provider value={resolve}>{children}</FragmentLinkContext.Provider>;
}

/**
 * Renders an OSCAL description / prose value (Markdown) as sanitized HTML.
 * With `params`, each `{{ insert: param, id }}` shows as a parameter pill.
 * `inline` renders a span, for prose that follows a part's label.
 */
export default function MarkupBlock({ value, style, params, inline }: {
  value: unknown;
  style?: CSSProperties;
  params?: (id: string) => ProseParam | null | undefined;
  inline?: boolean;
}) {
  const raw = markupText(value);
  const html = useMemo(() => renderProse(raw, params), [raw, params]);
  const resolveLink = useContext(FragmentLinkContext);
  if (!raw) return null;

  const onClick = resolveLink
    ? (e: MouseEvent<HTMLElement>) => {
        const link = (e.target as Element).closest?.("a[href^='#']");
        if (!link || !e.currentTarget.contains(link)) return;
        const id = decodeURIComponent((link.getAttribute("href") ?? "").slice(1));
        if (id && resolveLink(id)) e.preventDefault();
      }
    : undefined;
  const props = {
    className: "oscal-markup",
    style: { fontSize: 13, color: colors.black, lineHeight: 1.75, ...style },
    onClick,
    dangerouslySetInnerHTML: { __html: html },
  };
  return inline ? <span {...props} /> : <div {...props} />;
}

/**
 * An OSCAL title (markup-line): sanitized inline formatting. A title with no
 * Markdown renders as plain text. For a title in a string (a label, tooltip
 * or search text), use markupLineText() instead.
 */
export function MarkupLine({ text }: { text: unknown }) {
  const raw = markupLineSource(text);
  if (isPlainLine(raw)) return <>{raw}</>;
  return <span className="oscal-markup-line" dangerouslySetInnerHTML={{ __html: renderMarkupLine(raw) }} />;
}

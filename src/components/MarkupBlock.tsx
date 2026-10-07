import { useMemo, type CSSProperties } from "react";
import { colors } from "../theme/tokens";
import { renderMarkup } from "../utils/markup";

/** OSCAL markup fields hold either a string or a `{ prose }` object. */
function markupText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "prose" in value) return String(value.prose);
  return String(value);
}

/** Renders an OSCAL description / prose value (Markdown) as sanitized HTML. */
export default function MarkupBlock({ value, style }: { value: unknown; style?: CSSProperties }) {
  const raw = markupText(value);
  const html = useMemo(() => renderMarkup(raw), [raw]);
  if (!raw) return null;
  return (
    <div
      className="oscal-markup"
      style={{ fontSize: 13, color: colors.black, lineHeight: 1.75, ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Inline variant for prose fragments that sit between parameter pills. */
export function InlineMarkup({ text }: { text: string }) {
  const html = useMemo(() => renderMarkup(text), [text]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

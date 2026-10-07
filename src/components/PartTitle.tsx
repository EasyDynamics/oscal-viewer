import type { CSSProperties } from "react";
import { colors } from "../theme/tokens";
import { MarkupLine } from "./MarkupBlock";

/**
 * A part's own `title`, shown on its own line above the part's label and
 * prose. Renders nothing when the part has no title.
 */
export default function PartTitle({ title, style }: { title?: unknown; style?: CSSProperties }) {
  const text = typeof title === "string" ? title.trim() : "";
  if (!text) return null;
  return (
    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, color: colors.navy, marginBottom: 2, ...style }}>
      <MarkupLine text={text} />
    </div>
  );
}

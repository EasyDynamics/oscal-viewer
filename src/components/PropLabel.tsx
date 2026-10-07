import { colors, fonts, radii } from "../theme/tokens";
import { propColor, propDescription, propValueText, shortNamespace, type PropLike } from "../utils/propLabel";

/**
 * An OSCAL prop as a two-part scoped label: the name on a solid colour picked
 * from the name, then the value. A namespace other than NIST's shows as a
 * short prefix; ns and class are in the tooltip and accessible name.
 */
export default function PropLabel({ prop, size = "md" }: { prop: PropLike; size?: "sm" | "md" }) {
  const c = propColor(prop.name);
  const nsShort = shortNamespace(prop.ns);
  const description = propDescription(prop);
  const pad = size === "sm" ? "1px 6px" : "2px 8px";
  return (
    <span
      role="group"
      title={description}
      aria-label={description}
      style={{
        display: "inline-flex", maxWidth: "100%", verticalAlign: "middle",
        border: `1px solid ${c}`, borderRadius: radii.pill, overflow: "hidden",
        fontFamily: fonts.mono, fontSize: size === "sm" ? 10 : 11, lineHeight: 1.5,
      }}
    >
      <span aria-hidden="true" style={{ background: c, color: colors.card, padding: pad, fontWeight: 500, flexShrink: 0, maxWidth: "100%", overflowWrap: "anywhere" }}>
        {nsShort && <span style={{ opacity: 0.78 }}>{nsShort} · </span>}
        {prop.name}
      </span>
      <span aria-hidden="true" style={{ background: colors.card, color: c, padding: pad, fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>
        {propValueText(prop.value)}
      </span>
    </span>
  );
}

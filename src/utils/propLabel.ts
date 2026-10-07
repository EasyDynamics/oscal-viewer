/*
 * Display helpers for OSCAL props, shown as two-part scoped labels
 * (`name` | `value`) by components/PropLabel.
 */

import { colors } from "../theme/tokens";
import { isOscalNamespace } from "./oscalVisuals";

export interface PropLike {
  name: string;
  value: unknown;
  ns?: string;
  class?: string;
}

/**
 * Accents for the name segment. Each one has at least 4.5:1 contrast with
 * `colors.card` in every theme and mode, since the label uses that pair both
 * ways (card text on the accent, accent text on card). brightBlue, yellow,
 * orange and mint fall short in a light theme.
 */
export const PROP_PALETTE_TOKENS = ["navy", "cobalt", "darkGreen", "purple", "blueGray", "red"] as const;
export const PROP_PALETTE = PROP_PALETTE_TOKENS.map((token) => colors[token]);

/** A stable palette index for a prop name (32-bit FNV-1a), so a name has one colour everywhere. */
export function propColorIndex(name: string, size: number = PROP_PALETTE.length): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % size;
}

export function propColor(name: string): string {
  return PROP_PALETTE[propColorIndex(name)];
}

// Top-level domains dropped from a namespace's host: fedramp.gov → fedramp.
const GENERIC_TLDS = new Set(["gov", "mil", "com", "org", "net", "edu", "int", "us"]);

/**
 * A short prefix for a prop namespace, or null for the default NIST OSCAL
 * namespace (and for no namespace). For a URL it is the host's name without
 * `www.` and a generic top-level domain (`https://fedramp.gov/ns/oscal` →
 * `fedramp`, `http://oscal.io/ns` → `oscal.io`); otherwise the last segment.
 */
export function shortNamespace(ns: string | undefined): string | null {
  const value = (ns ?? "").trim();
  if (!value || isOscalNamespace(value)) return null;
  try {
    const url = new URL(value);
    const labels = url.hostname.replace(/^www\./, "").split(".").filter(Boolean);
    if (labels.length >= 2 && GENERIC_TLDS.has(labels[labels.length - 1])) return labels[labels.length - 2];
    if (labels.length > 0) return labels.join(".");
  } catch {
    // Not a URL (a URN, say): fall through to its last segment.
  }
  const segments = value.split(/[:/#]/).filter(Boolean);
  return segments[segments.length - 1] ?? value;
}

/** A prop value as text (documents may hold non-string junk). */
export function propValueText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** Tooltip and accessible name: name, value, then ns and class when present. */
export function propDescription(prop: PropLike): string {
  return [
    `name: ${prop.name}`,
    `value: ${propValueText(prop.value)}`,
    prop.ns ? `ns: ${prop.ns}` : null,
    prop.class ? `class: ${prop.class}` : null,
  ].filter(Boolean).join("\n");
}

/* ═══════════════════════════════════════════════════════════════════════════
   OSCAL markup → sanitized HTML
   OSCAL documents are untrusted input (dropped files, ?url= links), so every
   HTML string the viewer injects with dangerouslySetInnerHTML comes from here.
   ═══════════════════════════════════════════════════════════════════════════ */

import DOMPurify, { type Config } from "dompurify";
import { Marked, type TokenizerAndRendererExtension } from "marked";

/**
 * Accepts http(s) and mailto URLs, plus values with no scheme: #fragments,
 * relative paths, and plain values such as align="center" or type="checkbox"
 * (DOMPurify tests every attribute that is not known to be URI-safe against
 * this pattern). It is DOMPurify's default minus ftp, tel, sms and its other
 * extra schemes, so javascript:, vbscript:, data: and the rest fail it.
 */
const SAFE_URI = /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

// Private instances: mermaid adds its own hooks to the shared default one.
const markupPurify = DOMPurify();
const svgPurify = DOMPurify();

// DOMPurify keeps data: URIs in the src of <img>, <video> and other media
// whatever ALLOWED_URI_REGEXP says. Markup has no need for them, so drop
// those too. SVG keeps them: they cannot run script there, and Mermaid draws
// some icons (C4 people) as data: images.
markupPurify.addHook("uponSanitizeAttribute", (_node, attr) => {
  if (/^(?:src|href|xlink:href)$/.test(attr.attrName) && /^data:/i.test(attr.attrValue)) attr.keepAttr = false;
});

const MARKUP_CONFIG: Config = {
  USE_PROFILES: { html: true },
  // A document's <style> would restyle the whole viewer, an inline style can
  // lay a fake page over it, and a <form> could post what users type to
  // another site. OSCAL markup has no use for any of them.
  FORBID_TAGS: ["style", "form"],
  FORBID_ATTR: ["style"],
  ALLOWED_URI_REGEXP: SAFE_URI,
};

const SVG_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true, html: true },
  // Mermaid draws most labels as HTML inside <foreignObject>, which the SVG
  // profile removes along with its content. Allow it as mermaid's own
  // sanitizer does.
  ADD_TAGS: ["foreignObject"],
  HTML_INTEGRATION_POINTS: { foreignobject: true },
  ALLOWED_URI_REGEXP: SAFE_URI,
};

const marked = new Marked({ async: false, gfm: true, breaks: false });

/**
 * Render OSCAL markup (Markdown, possibly with inline HTML) to sanitized HTML.
 * A lone paragraph is unwrapped so one-line values sit inline.
 */
export function renderMarkup(text: string): string {
  let html = (marked.parse(text) as string).trim();
  if (html.startsWith("<p>") && html.endsWith("</p>") && html.indexOf("<p>", 1) === -1)
    html = html.slice(3, -4);
  return markupPurify.sanitize(html, MARKUP_CONFIG);
}

/** A parameter as shown inside prose: its rendered text, and whether it is a selection. */
export interface ProseParam {
  text: string;
  selection?: boolean;
}

const PARAM_INSERT = /\{\{\s*insert:\s*param\s*,\s*([^}]+?)\s*\}\}/g;
// Private-use characters around a pill's index: they pass through Markdown
// and sanitizing as plain text, and documents have no use for them.
const PILL = /\uE000(\d+)\uE001/g;

/**
 * Render OSCAL prose: Markdown like renderMarkup(), with each
 * `{{ insert: param, id }}` shown as a parameter pill. The Markdown is
 * rendered once around placeholders, so formatting that spans a parameter
 * still works; the pills (escaped text) go in after sanitizing.
 */
export function renderProse(text: string, param?: (id: string) => ProseParam | null | undefined): string {
  if (!param) return renderMarkup(text);
  const pills: string[] = [];
  const withPlaceholders = text.replace(PARAM_INSERT, (_m, rawId: string) => {
    const id = rawId.trim();
    const p = param(id) ?? { text: `[Assignment: ${id}]` };
    const cls = p.selection ? "oscal-param oscal-param-selection" : "oscal-param";
    pills.push(`<span class="${cls}" title="Parameter: ${escapeHtml(id)}">${escapeHtml(p.text)}</span>`);
    return `\uE000${pills.length - 1}\uE001`;
  });
  return renderMarkup(withPlaceholders).replace(PILL, (_m, i: string) => pills[Number(i)] ?? "");
}

/** The plain text of OSCAL prose, for previews and other places that need a string. */
export function markupPlainText(text: string): string {
  if (!text) return "";
  const fragment = markupPurify.sanitize(marked.parse(text) as string, { ...MARKUP_CONFIG, RETURN_DOM_FRAGMENT: true });
  return (fragment.textContent ?? "").replace(/\s+/g, " ").trim();
}

/* ── Titles (markup-line) ── */

/** OSCAL Markdown writes subscript as ~text~ and superscript as ^text^. */
function oscalScript(tag: "sub" | "sup", mark: "~" | "^"): TokenizerAndRendererExtension {
  const m = mark === "^" ? "\\^" : mark;
  // One mark on each side (two tildes stay strikethrough), no space inside.
  const rule = new RegExp(`^${m}(?!${m})([^\\s${m}](?:[^${m}]*[^\\s${m}])?)${m}(?!${m})`);
  return {
    name: tag,
    level: "inline",
    start: (src) => (src.includes(mark) ? src.indexOf(mark) : undefined),
    tokenizer(src) {
      const match = rule.exec(src);
      if (match) return { type: tag, raw: match[0], tokens: this.lexer.inlineTokens(match[1]) };
    },
    renderer(token) {
      return `<${tag}>${this.parser.parseInline(token.tokens ?? [])}</${tag}>`;
    },
  };
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Every OSCAL title is markup-line: inline Markdown only, with OSCAL's sub-
// and superscript. A title is a name, and it often sits inside a clickable
// row, where a link would navigate away mid-click, so links show their text
// and images their alt text.
const lineMarked = new Marked({
  async: false,
  gfm: true,
  breaks: false,
  extensions: [oscalScript("sub", "~"), oscalScript("sup", "^")],
  renderer: {
    link({ tokens }) { return this.parser.parseInline(tokens); },
    image({ text }) { return escapeHtml(text); },
  },
});

// Raw HTML in a title gets the same treatment: inline formatting only.
const linePurify = DOMPurify();
const LINE_CONFIG: Config = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "code", "del", "s", "sub", "sup", "q"],
  ALLOWED_ATTR: [],
};

// Pages render the same titles over and over (sidebars, lists, breadcrumbs).
const LINE_CACHE_LIMIT = 5000;
const lineHtmlCache = new Map<string, string>();
const lineTextCache = new Map<string, string>();

function remember(cache: Map<string, string>, key: string, value: string): string {
  if (cache.size >= LINE_CACHE_LIMIT) cache.clear();
  cache.set(key, value);
  return value;
}

/** A title value as a string (documents may hold non-string junk). */
export function markupLineSource(value: unknown): string {
  if (typeof value === "string") return value;
  return value === null || value === undefined ? "" : String(value);
}

/**
 * True when a title has no character that inline Markdown or HTML gives a
 * meaning to, so it renders as itself. Most titles are like this.
 */
export function isPlainLine(text: string): boolean {
  return !/[\\`*_~^[<&]/.test(text);
}

/** Render an OSCAL markup-line value (a title) to sanitized inline HTML. */
export function renderMarkupLine(text: string): string {
  const hit = lineHtmlCache.get(text);
  if (hit !== undefined) return hit;
  const html = lineMarked.parseInline(text) as string;
  return remember(lineHtmlCache, text, linePurify.sanitize(html, LINE_CONFIG));
}

/**
 * The plain text of an OSCAL markup-line value, for places that need a
 * string: sidebar labels, breadcrumbs, tooltips, search and sorting.
 */
export function markupLineText(value: unknown): string {
  const text = markupLineSource(value);
  if (isPlainLine(text)) return text;
  const hit = lineTextCache.get(text);
  if (hit !== undefined) return hit;
  const html = lineMarked.parseInline(text) as string;
  const fragment = linePurify.sanitize(html, { ...LINE_CONFIG, RETURN_DOM_FRAGMENT: true });
  return remember(lineTextCache, text, fragment.textContent ?? "");
}

/** Sanitize a rendered Mermaid diagram before it is inlined into the page. */
export function sanitizeSvg(svg: string): string {
  return svgPurify.sanitize(svg, SVG_CONFIG);
}

/* ═══════════════════════════════════════════════════════════════════════════
   OSCAL markup → sanitized HTML
   OSCAL documents are untrusted input (dropped files, ?url= links), so every
   HTML string the viewer injects with dangerouslySetInnerHTML comes from here.
   ═══════════════════════════════════════════════════════════════════════════ */

import DOMPurify, { type Config } from "dompurify";
import { Marked } from "marked";

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

/** Sanitize a rendered Mermaid diagram before it is inlined into the page. */
export function sanitizeSvg(svg: string): string {
  return svgPurify.sanitize(svg, SVG_CONFIG);
}

/*
 * Display labels for OSCAL links.
 *
 * A link's own `text` is the label written at the point of reference, so it
 * wins over the name of whatever the link points to (a back-matter resource's
 * title, a control's ID), which is the same for every link to that target.
 * The target's name moves to the tooltip when the link text is shown.
 */

import { markupLineText } from "./markup";

export interface LinkTextLike {
  text?: string;
}

export interface LinkedResourceLike {
  title?: string;
  citation?: { text?: string };
}

/** A back-matter resource's display name: its title as plain text, else its citation text. */
export function resourceName(resource: LinkedResourceLike | undefined): string | undefined {
  return markupLineText(resource?.title) || resource?.citation?.text || undefined;
}

/**
 * Display label for a link: the link's `text`, else the name of its target,
 * else `fallback` (usually the href). Uses `||` so empty strings fall through.
 */
export function linkLabel(link: LinkTextLike, targetName: string | undefined, fallback: string): string {
  return link.text || targetName || fallback;
}

/**
 * The target's name, for a tooltip, when the label shows the link's `text`
 * instead. Returns undefined when the label already is that name.
 */
export function linkTooltip(link: LinkTextLike, targetName: string | undefined): string | undefined {
  return link.text && targetName && targetName !== link.text ? targetName : undefined;
}

/**
 * Label and tooltip for a link in catalog content (control links and links in
 * control parts), where `#<uuid>` names a back-matter resource and any other
 * `#<id>` names a control, shown by its upper-cased ID.
 */
export function catalogLinkDisplay(
  link: LinkTextLike & { href: string },
  resources: Record<string, LinkedResourceLike>,
): { label: string; tooltip?: string } {
  const refId = link.href.startsWith("#") ? link.href.slice(1) : "";
  const resource = refId && Object.prototype.hasOwnProperty.call(resources, refId) ? resources[refId] : undefined;
  const targetName = resource ? resourceName(resource) : refId.toUpperCase() || undefined;
  return { label: linkLabel(link, targetName, refId || link.href), tooltip: linkTooltip(link, targetName) };
}

/** {@link linkLabel} for a link that resolves to a back-matter resource. */
export function resourceLinkLabel(
  link: LinkTextLike,
  resource: LinkedResourceLike | undefined,
  fallback: string,
): string {
  return linkLabel(link, resourceName(resource), fallback);
}

/** {@link linkTooltip} for a link that resolves to a back-matter resource. */
export function resourceLinkTooltip(
  link: LinkTextLike,
  resource: LinkedResourceLike | undefined,
): string | undefined {
  return linkTooltip(link, resourceName(resource));
}

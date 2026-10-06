export interface LinkTextLike {
  text?: string;
}

export interface LinkedResourceLike {
  title?: string;
  citation?: { text?: string };
}

/**
 * Display label for a link that resolves to a back-matter resource.
 *
 * The link's own `text` is the label written at the point of reference, so it
 * wins over the resource's `title`, which names the target and is the same for
 * every link to it. Falls back to `citation.text`, then `fallback`. Uses `||`
 * so an empty string falls through, matching the SSP page.
 */
export function resourceLinkLabel(
  link: LinkTextLike,
  resource: LinkedResourceLike,
  fallback: string,
): string {
  return link.text || resource.title || resource.citation?.text || fallback;
}

/**
 * The resource's own name, for a tooltip, when the label shows something else
 * (the link's `text`). Returns undefined when the label already is that name.
 */
export function resourceLinkTooltip(
  link: LinkTextLike,
  resource: LinkedResourceLike,
): string | undefined {
  const name = resource.title || resource.citation?.text;
  return name && name !== link.text && link.text ? name : undefined;
}

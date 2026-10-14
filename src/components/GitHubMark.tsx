import githubMark from "../assets/github-mark.png";

/**
 * The GitHub logo, drawn in the current text color so it follows the theme.
 * The PNG is a solid shape on a transparent background, used as a mask.
 */
export default function GitHubMark({ size = 24 }: { size?: number }) {
  const mask = `url(${githubMark}) center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-block", width: size, height: size, flexShrink: 0, backgroundColor: "currentColor", mask, WebkitMask: mask }}
    />
  );
}

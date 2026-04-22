import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LinkChips, { type ResolvedLink } from "./LinkChips";

describe("<LinkChips />", () => {
  it("renders nothing when the links list is empty", () => {
    const { container } = render(<LinkChips links={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the default section label with a count when no label is given", () => {
    render(
      <LinkChips
        links={[{ text: "A", href: "https://a.example" }]}
      />,
    );
    expect(screen.getByText(/Links \(1\)/)).toBeInTheDocument();
  });

  it("renders a custom string label wrapped as a styled header", () => {
    render(
      <LinkChips
        links={[{ text: "A", href: "https://a.example" }]}
        label="Related Refs"
      />,
    );
    expect(screen.getByText("Related Refs")).toBeInTheDocument();
  });

  it("renders a custom ReactNode label as-is", () => {
    render(
      <LinkChips
        links={[{ text: "A", href: "https://a.example" }]}
        label={<span data-testid="custom-label">Hand-crafted</span>}
      />,
    );
    expect(screen.getByTestId("custom-label")).toBeInTheDocument();
  });

  it("renders an href link as an <a target=_blank>", () => {
    render(
      <LinkChips
        links={[{ text: "Docs", href: "https://docs.example/p" }]}
      />,
    );
    const a = screen.getByRole("link", { name: /Docs/ });
    expect(a).toHaveAttribute("href", "https://docs.example/p");
    expect(a).toHaveAttribute("target", "_blank");
  });

  it("renders a click-handler link as a span and fires onClick", () => {
    const spy = vi.fn();
    render(
      <LinkChips links={[{ text: "Internal", onClick: spy }]} />,
    );
    const span = screen.getByText("Internal");
    expect(span.tagName).toBe("SPAN");
    fireEvent.click(span);
    expect(spy).toHaveBeenCalledOnce();
  });

  const categoryCases: Array<{
    name: string;
    link: ResolvedLink;
    expectedTitleMatch: RegExp | null;
  }> = [
    {
      name: "mitre by rel",
      link: { text: "T1059", rel: "mitre", href: "https://ex" },
      expectedTitleMatch: /mitre/,
    },
    {
      name: "mitre by attack.mitre.org in href",
      link: { text: "T1059", href: "https://attack.mitre.org/techniques/T1059" },
      expectedTitleMatch: null,
    },
    {
      name: "reference",
      link: { text: "Ref", rel: "reference", href: "https://ex" },
      expectedTitleMatch: /reference/,
    },
    {
      name: "related",
      link: { text: "Rel", rel: "related", href: "https://ex" },
      expectedTitleMatch: /related/,
    },
    {
      name: "required",
      link: { text: "Req", rel: "required", href: "https://ex" },
      expectedTitleMatch: /required/,
    },
    {
      name: "unknown rel falls through to _default",
      link: { text: "Other", rel: "something-else", href: "https://ex" },
      expectedTitleMatch: /something-else/,
    },
    {
      name: "no rel, no attack.mitre.org — _default",
      link: { text: "Bare", href: "https://ex" },
      expectedTitleMatch: null,
    },
  ];

  categoryCases.forEach(({ name, link, expectedTitleMatch }) => {
    it(`categorises: ${name}`, () => {
      render(<LinkChips links={[link]} />);
      const rendered = screen.getByText(link.text);
      if (expectedTitleMatch) {
        const title = rendered.closest("a, span")?.getAttribute("title");
        expect(title).toMatch(expectedTitleMatch);
      } else {
        // No rel → title is just the text
        const title = rendered.closest("a, span")?.getAttribute("title");
        expect(title).toBe(link.text);
      }
    });
  });

  it("forwards the optional style prop to the wrapper", () => {
    const { container } = render(
      <LinkChips
        links={[{ text: "A", href: "https://a.example" }]}
        style={{ marginTop: 42 }}
      />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.marginTop).toBe("42px");
  });
});

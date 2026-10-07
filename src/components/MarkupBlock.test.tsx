import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import MarkupBlock, { InlineMarkup, MarkupLine } from "./MarkupBlock";
import { XSS_PAYLOADS, expectNoActiveContent } from "../test/xss";

describe("<MarkupBlock />", () => {
  it.each(XSS_PAYLOADS)("neutralizes %s", (payload) => {
    const { container } = render(<MarkupBlock value={payload} />);
    expectNoActiveContent(container);
  });

  it("renders ordinary markdown", () => {
    const { container } = render(
      <MarkupBlock value={"Some **bold** text with `code` and a [link](https://example.com).\n\n- one\n- two"} />,
    );
    const block = container.querySelector(".oscal-markup");
    expect(block?.querySelector("strong")?.textContent).toBe("bold");
    expect(block?.querySelector("code")?.textContent).toBe("code");
    expect(block?.querySelector("a")?.getAttribute("href")).toBe("https://example.com");
    expect([...(block?.querySelectorAll("li") ?? [])].map((li) => li.textContent)).toEqual(["one", "two"]);
  });

  it("reads { prose } values and renders nothing for an empty one", () => {
    const { container, rerender } = render(<MarkupBlock value={{ prose: "**prose**" }} />);
    expect(container.querySelector("strong")?.textContent).toBe("prose");
    rerender(<MarkupBlock value="" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("<InlineMarkup />", () => {
  it.each(XSS_PAYLOADS)("neutralizes %s", (payload) => {
    const { container } = render(<InlineMarkup text={payload} />);
    expectNoActiveContent(container);
  });

  it("renders a prose fragment inline", () => {
    const { container } = render(<InlineMarkup text="protect the **confidentiality** of [data](#sc-8)" />);
    const span = container.firstElementChild;
    expect(span?.tagName).toBe("SPAN");
    expect(span?.querySelector("p")).toBeNull();
    expect(span?.querySelector("strong")?.textContent).toBe("confidentiality");
    expect(span?.querySelector("a")?.getAttribute("href")).toBe("#sc-8");
  });
});

describe("<MarkupLine />", () => {
  it.each(XSS_PAYLOADS)("neutralizes %s", (payload) => {
    const { container } = render(<MarkupLine text={payload} />);
    expectNoActiveContent(container);
  });

  it("renders a plain title as text, with no wrapper", () => {
    const { container } = render(<MarkupLine text="Account Management" />);
    expect(container.innerHTML).toBe("Account Management");
  });

  it("renders a title's inline formatting, and links as their text", () => {
    const { container } = render(<MarkupLine text="Use of **Cryptography** in [TLS](https://example.com)" />);
    const span = container.firstElementChild;
    expect(span?.tagName).toBe("SPAN");
    expect(span?.querySelector("strong")?.textContent).toBe("Cryptography");
    expect(span?.querySelector("a")).toBeNull();
    expect(span?.textContent).toBe("Use of Cryptography in TLS");
  });

  it("renders nothing for a missing title", () => {
    const { container } = render(<MarkupLine text={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});

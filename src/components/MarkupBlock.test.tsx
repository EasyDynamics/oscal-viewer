import { describe, it, expect } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import MarkupBlock, { MarkupLine, MarkupLinks } from "./MarkupBlock";
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

describe("<MarkupBlock inline />", () => {
  it.each(XSS_PAYLOADS)("neutralizes %s", (payload) => {
    const { container } = render(<MarkupBlock value={payload} inline />);
    expectNoActiveContent(container);
  });

  it("renders one-paragraph prose in a span, to sit after a part's label", () => {
    const { container } = render(<MarkupBlock value="protect the **confidentiality** of [data](#sc-8)" inline />);
    const span = container.firstElementChild;
    expect(span?.tagName).toBe("SPAN");
    expect(span?.querySelector("p")).toBeNull();
    expect(span?.querySelector("strong")?.textContent).toBe("confidentiality");
    expect(span?.querySelector("a")?.getAttribute("href")).toBe("#sc-8");
  });
});

describe("<MarkupBlock params />", () => {
  const params = (id: string) =>
    id === "ac-1_prm_1" ? { text: "[Assignment: personnel]" } : id === "ac-1_prm_2" ? { text: "[Selection: daily; weekly]", selection: true } : null;

  it("shows each parameter insert as a pill, inside the rendered Markdown", () => {
    const { container } = render(
      <MarkupBlock value="Notify **{{ insert: param, ac-1_prm_1 }} at once**, {{ insert: param, ac-1_prm_2 }}." params={params} />,
    );
    const pills = [...container.querySelectorAll(".oscal-param")];
    expect(pills.map((p) => p.textContent)).toEqual(["[Assignment: personnel]", "[Selection: daily; weekly]"]);
    expect(pills[0].closest("strong")).not.toBeNull();
    expect(pills[1].classList.contains("oscal-param-selection")).toBe(true);
    expect(pills[0].getAttribute("title")).toBe("Parameter: ac-1_prm_1");
  });

  it("falls back to the parameter id, and escapes parameter text", () => {
    const { container } = render(
      <MarkupBlock value="{{ insert: param, missing }} {{ insert: param, ac-1_prm_1 }}" params={(id) => (id === "missing" ? null : { text: '<img src=x onerror="alert(1)">' })} />,
    );
    const pills = [...container.querySelectorAll(".oscal-param")];
    expect(pills[0].textContent).toBe("[Assignment: missing]");
    expect(pills[1].textContent).toBe('<img src=x onerror="alert(1)">');
    expectNoActiveContent(container);
  });
});

describe("<MarkupLinks />", () => {
  it("opens a #fragment link's view inside the viewer", () => {
    const opened: string[] = [];
    const { container } = render(
      <MarkupLinks resolve={(id) => { opened.push(id); return id === "au-2"; }}>
        <MarkupBlock value="See [AU-02](#au-2), [AU-99](#au-99) and [NIST](https://www.nist.gov)." />
      </MarkupLinks>,
    );
    const [au2, au99, nist] = [...container.querySelectorAll("a")];
    expect(fireEvent.click(au2)).toBe(false); // handled: default prevented
    expect(fireEvent.click(au99)).toBe(true); // unknown target: left alone
    expect(fireEvent.click(nist)).toBe(true); // external link: never resolved
    expect(opened).toEqual(["au-2", "au-99"]);
  });

  it("leaves links alone without a resolver", () => {
    const { container } = render(<MarkupBlock value="[AU-02](#au-2)" />);
    expect(fireEvent.click(container.querySelector("a")!)).toBe(true);
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

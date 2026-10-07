import { describe, it, expect } from "vitest";
import { markupLineText, markupPlainText, renderMarkup, renderMarkupLine, renderProse, sanitizeSvg } from "./markup";
import { XSS_PAYLOADS, expectNoActiveContent } from "../test/xss";

/** Parse an HTML string into a detached element that tests can query. */
function parse(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
}

describe("renderMarkup()", () => {
  it.each(XSS_PAYLOADS)("neutralizes %s", (payload) => {
    expectNoActiveContent(parse(renderMarkup(payload)));
  });

  it("keeps the harmless parts of a payload", () => {
    const el = parse(renderMarkup('Hello <img src=x onerror="alert(1)"> and [x](javascript:alert(1))'));
    expect(el.querySelector("img")?.getAttribute("src")).toBe("x");
    expect(el.querySelector("a")?.textContent).toBe("x");
    expect(el.querySelector("a")?.hasAttribute("href")).toBe(false);
    expect(el.textContent).toBe("Hello  and x");
  });

  it("renders ordinary markdown", () => {
    const el = parse(renderMarkup([
      "# Heading",
      "",
      "Some **bold**, _emphasis_, ~~struck~~ and `inline code`.",
      "",
      "- one",
      "- two",
      "",
      "3. three",
      "4. four",
      "",
      "- [x] done",
      "",
      "| Left | Center |",
      "|:-----|:------:|",
      "| a    | b      |",
      "",
      "> quoted",
      "",
      "```",
      "code block",
      "```",
    ].join("\n")));

    expect(el.querySelector("h1")?.textContent).toBe("Heading");
    expect(el.querySelector("strong")?.textContent).toBe("bold");
    expect(el.querySelector("em")?.textContent).toBe("emphasis");
    expect(el.querySelector("del")?.textContent).toBe("struck");
    expect(el.querySelector("p code")?.textContent).toBe("inline code");
    expect([...el.querySelectorAll("ul")[0].children].map((li) => li.textContent)).toEqual(["one", "two"]);
    expect(el.querySelector("ol")?.getAttribute("start")).toBe("3");
    const checkbox = el.querySelector("input");
    expect(checkbox?.getAttribute("type")).toBe("checkbox");
    expect(checkbox?.hasAttribute("checked")).toBe(true);
    expect(checkbox?.hasAttribute("disabled")).toBe(true);
    expect(el.querySelectorAll("th")[1]?.getAttribute("align")).toBe("center");
    expect(el.querySelector("blockquote")?.textContent?.trim()).toBe("quoted");
    expect(el.querySelector("pre code")?.textContent).toBe("code block\n");
  });

  it("keeps http(s), mailto, fragment and relative URLs", () => {
    const el = parse(renderMarkup(
      "[a](https://example.com/a) [b](http://example.com/b) [c](mailto:team@example.com) " +
      "[d](#ac-2) [e](docs/guide.html) ![f](https://example.com/f.png)",
    ));
    expect([...el.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
      "https://example.com/a",
      "http://example.com/b",
      "mailto:team@example.com",
      "#ac-2",
      "docs/guide.html",
    ]);
    expect(el.querySelector("img")?.getAttribute("src")).toBe("https://example.com/f.png");
  });

  it("drops every other URL scheme, data: images included", () => {
    const el = parse(renderMarkup(
      "[a](vbscript:msgbox(1)) [b](data:text/html,hi) [c](tel:+15555550100) [d](file:///etc/passwd) " +
      "![e](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)",
    ));
    expect(el.querySelectorAll("a")).toHaveLength(4);
    expect(el.querySelector("a[href]")).toBeNull();
    expect(el.querySelector("img")?.hasAttribute("src")).toBe(false);
  });

  it("removes styles, forms and SVG, which OSCAL markup has no use for", () => {
    const el = parse(renderMarkup(
      '<style>body{display:none}</style><span style="position:fixed;inset:0">overlay</span>' +
      '<form action="https://example.com/collect"><input name="token"></form><svg><circle r="1"></circle></svg>',
    ));
    expect(el.querySelector("style, [style], form, svg")).toBeNull();
    expect(el.textContent).toBe("overlay");
  });

  it("unwraps a lone paragraph so one-line values sit inline", () => {
    expect(renderMarkup("Plain **text**")).toBe("Plain <strong>text</strong>");
    expect(renderMarkup("One\n\nTwo")).toBe("<p>One</p>\n<p>Two</p>");
  });
});

describe("renderProse()", () => {
  const params = (id: string) => (id === "p1" ? { text: "[Assignment: <b>x</b> & y]" } : null);

  it.each(XSS_PAYLOADS)("neutralizes %s", (payload) => {
    expectNoActiveContent(parse(renderProse(`${payload} {{ insert: param, p1 }}`, params)));
  });

  it("renders Markdown and parameter pills together", () => {
    const el = parse(renderProse("Review **{{ insert: param, p1 }}** and [AU-02](#au-2).", params));
    expect(el.querySelector("strong .oscal-param")?.textContent).toBe("[Assignment: <b>x</b> & y]");
    expect(el.querySelector("a")?.getAttribute("href")).toBe("#au-2");
    expect(el.querySelector("b")).toBeNull();
  });

  it("is renderMarkup() without a parameter resolver", () => {
    expect(renderProse("Plain **text** {{ insert: param, p1 }}")).toBe(renderMarkup("Plain **text** {{ insert: param, p1 }}"));
  });
});

describe("markupPlainText()", () => {
  it("strips Markdown to its text, on one line", () => {
    expect(markupPlainText("In accordance with [AU-02](#au-2).\n\n- **one**\n- two")).toBe("In accordance with AU-02. one two");
    expect(markupPlainText("")).toBe("");
  });

  it("drops scripts, content included", () => {
    expect(markupPlainText("Hi <script>alert(1)</script>there")).toBe("Hi there");
  });
});

describe("renderMarkupLine()", () => {
  it.each(XSS_PAYLOADS)("neutralizes %s", (payload) => {
    expectNoActiveContent(parse(renderMarkupLine(payload)));
  });

  it("renders inline formatting", () => {
    const el = parse(renderMarkupLine("Use **strong**, _emphasis_, `code` and ~~struck~~ text"));
    expect(el.querySelector("strong")?.textContent).toBe("strong");
    expect(el.querySelector("em")?.textContent).toBe("emphasis");
    expect(el.querySelector("code")?.textContent).toBe("code");
    expect(el.querySelector("del")?.textContent).toBe("struck");
  });

  it("leaves block syntax alone, since a title is one line", () => {
    expect(renderMarkupLine("1. Introduction")).toBe("1. Introduction");
    expect(renderMarkupLine("# of accounts")).toBe("# of accounts");
    expect(renderMarkupLine("- item")).toBe("- item");
  });

  it("renders OSCAL subscript and superscript, and keeps ~~strikethrough~~", () => {
    const el = parse(renderMarkupLine("H~2~O, E = mc^2^, ~~struck~~"));
    expect(el.querySelector("sub")?.textContent).toBe("2");
    expect(el.querySelector("sup")?.textContent).toBe("2");
    expect(el.querySelector("del")?.textContent).toBe("struck");
    expect(renderMarkupLine("about ~5 minutes, up ^ 2")).toBe("about ~5 minutes, up ^ 2");
  });

  it("shows a link's text and an image's alt text", () => {
    const el = parse(renderMarkupLine(
      'See [FIPS 199](https://example.com), ![the logo](https://example.com/x.png) <a href="https://example.com">here</a>',
    ));
    expect(el.querySelector("a, img")).toBeNull();
    expect(el.textContent).toBe("See FIPS 199, the logo here");
  });

  it("drops block HTML and styles, keeping their text", () => {
    const el = parse(renderMarkupLine('<div style="position:fixed;inset:0">over</div><h1>lay</h1>'));
    expect(el.querySelector("div, h1, [style]")).toBeNull();
    expect(el.textContent).toBe("overlay");
  });
});

describe("markupLineText()", () => {
  it("returns a plain title as it is", () => {
    expect(markupLineText("Account Management")).toBe("Account Management");
    expect(markupLineText("Review {{ insert: param, ac-1_prm_1 }}")).toBe("Review {{ insert: param, ac-1_prm_1 }}");
  });

  it("strips Markdown and decodes entities", () => {
    expect(markupLineText("Use of **Cryptography** in `TLS`")).toBe("Use of Cryptography in TLS");
    expect(markupLineText("[FIPS 199](#a1b2) Categorization")).toBe("FIPS 199 Categorization");
    expect(markupLineText("AT&amp;T &lt;b&gt;")).toBe("AT&T <b>");
    expect(markupLineText("a < b")).toBe("a < b");
    expect(markupLineText("\\*not emphasis\\*")).toBe("*not emphasis*");
    expect(markupLineText("H~2~O")).toBe("H2O");
  });

  it("drops scripts, content included", () => {
    expect(markupLineText("Hi <script>alert(1)</script>there")).toBe("Hi there");
  });

  it("accepts missing and non-string values", () => {
    expect(markupLineText(undefined)).toBe("");
    expect(markupLineText(null)).toBe("");
    expect(markupLineText(42)).toBe("42");
  });
});

describe("sanitizeSvg()", () => {
  // The shape of a Mermaid flowchart render, trimmed to one node.
  const diagram =
    '<svg id="mermaid-1" width="100%" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
    'class="flowchart" style="max-width: 120px;" viewBox="0 0 120 60" role="graphics-document document" aria-roledescription="flowchart-v2">' +
    '<style>#mermaid-1 .node rect{fill:#ECECFF;stroke:#9370DB;}</style>' +
    '<g><marker id="mermaid-1_flowchart-v2-pointEnd" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto">' +
    '<path d="M 0 0 L 10 5 L 0 10 z" class="arrowMarkerPath"></path></marker>' +
    '<g class="node default" transform="translate(60, 30)"><rect class="basic label-container" x="-40" y="-20" width="80" height="40"></rect>' +
    '<g class="label" transform="translate(-20, -12)"><foreignObject width="40" height="24">' +
    '<div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; text-align: center;">' +
    '<span class="nodeLabel"><p>Start</p></span></div></foreignObject></g></g>' +
    '<text dominant-baseline="middle" x="4" y="4">edge</text><a href="https://example.com"><text>link</text></a>' +
    // C4 diagrams draw people as data: images.
    '<image width="48" height="48" xlink:href="data:image/png;base64,iVBORw0KGgo="></image></g></svg>';

  const svgPayloads = [
    '<svg onload="alert(1)"><script>alert(1)</script><rect onclick="alert(1)"></rect></svg>',
    '<svg><a xlink:href="javascript:alert(1)"><text>a</text></a><a href="javascript:alert(1)"><text>b</text></a></svg>',
    '<svg><foreignObject><img src=x onerror="alert(1)"><iframe src="javascript:alert(1)"></iframe></foreignObject></svg>',
    '<svg><animate attributeName="href" values="javascript:alert(1)"></animate><set attributeName="onclick" to="alert(1)"></set></svg>',
  ];

  it.each([...svgPayloads, ...XSS_PAYLOADS])("neutralizes %s", (payload) => {
    expectNoActiveContent(parse(sanitizeSvg(payload)));
  });

  it("keeps Mermaid's diagram markup, styles and HTML labels", () => {
    const el = parse(sanitizeSvg(diagram));
    const svg = el.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 120 60");
    expect(svg?.getAttribute("style")).toBe("max-width: 120px;");
    expect(svg?.getAttribute("role")).toBe("graphics-document document");
    expect(el.querySelector("style")?.textContent).toContain(".node rect");
    expect(el.querySelector("marker path")?.getAttribute("d")).toBe("M 0 0 L 10 5 L 0 10 z");
    expect(el.querySelector("foreignObject div")?.getAttribute("style")).toContain("table-cell");
    expect(el.querySelector("foreignObject span.nodeLabel")?.textContent).toBe("Start");
    expect(el.querySelector("text")?.getAttribute("dominant-baseline")).toBe("middle");
    expect(el.querySelector("a")?.getAttribute("href")).toBe("https://example.com");
    expect(el.querySelector("image")?.getAttribute("xlink:href")).toBe("data:image/png;base64,iVBORw0KGgo=");
  });
});

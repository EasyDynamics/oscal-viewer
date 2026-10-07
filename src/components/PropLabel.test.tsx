import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PropLabel from "./PropLabel";
import { propColor } from "../utils/propLabel";

const segments = (label: HTMLElement) => [...label.children] as HTMLElement[];

describe("<PropLabel />", () => {
  it("shows the name and the value in separate segments", () => {
    render(<PropLabel prop={{ name: "label", value: "AC-1" }} />);
    const label = screen.getByRole("group");
    const [name, value] = segments(label);
    expect(name).toHaveTextContent("label");
    expect(value).toHaveTextContent("AC-1");
    expect(name.style.background).toBe(propColor("label"));
    expect(value.style.color).toBe(propColor("label"));
  });

  it("prefixes a namespace other than NIST's, and not NIST's own", () => {
    const { rerender } = render(<PropLabel prop={{ name: "control-origination", value: "sp-corporate", ns: "https://fedramp.gov/ns/oscal" }} />);
    expect(segments(screen.getByRole("group"))[0]).toHaveTextContent("fedramp · control-origination");
    rerender(<PropLabel prop={{ name: "sort-id", value: "ac-01", ns: "http://csrc.nist.gov/ns/oscal" }} />);
    expect(segments(screen.getByRole("group"))[0]).toHaveTextContent(/^sort-id$/);
  });

  it("puts name, value, ns and class in the tooltip and accessible name", () => {
    render(<PropLabel prop={{ name: "method", value: "TEST", ns: "http://example.com/ns", class: "sp800-53a" }} />);
    const label = screen.getByRole("group", { name: /name: method/ });
    const text = "name: method\nvalue: TEST\nns: http://example.com/ns\nclass: sp800-53a";
    expect(label.getAttribute("title")).toBe(text);
    expect(label.getAttribute("aria-label")).toBe(text);
  });

  it("has a smaller size for dense lists", () => {
    render(<PropLabel prop={{ name: "asset-type", value: "os" }} size="sm" />);
    expect(screen.getByRole("group").style.fontSize).toBe("10px");
  });
});

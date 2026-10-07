import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PartTitle from "./PartTitle";

describe("<PartTitle />", () => {
  it("shows the title as plain text", () => {
    const { container } = render(<PartTitle title="  Control <b>Statement</b>  " />);
    expect(container).toHaveTextContent("Control <b>Statement</b>");
    expect(container.querySelector("b")).toBeNull();
  });

  it.each([undefined, null, "", "   ", 42])("renders nothing for %j", (title) => {
    const { container } = render(<PartTitle title={title} />);
    expect(container).toBeEmptyDOMElement();
  });
});

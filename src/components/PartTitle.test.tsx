import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PartTitle from "./PartTitle";

describe("<PartTitle />", () => {
  it("shows the title with its inline formatting", () => {
    const { container } = render(<PartTitle title="  Control **Statement**  " />);
    expect(container).toHaveTextContent("Control Statement");
    expect(container.querySelector("strong")?.textContent).toBe("Statement");
  });

  it.each([undefined, null, "", "   ", 42])("renders nothing for %j", (title) => {
    const { container } = render(<PartTitle title={title} />);
    expect(container).toBeEmptyDOMElement();
  });
});

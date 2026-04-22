import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PageStub from "./PageStub";

describe("<PageStub />", () => {
  it("renders the title it's given", () => {
    render(
      <PageStub
        title="Catalog"
        description="desc"
        accentColor="#000"
        icon={null}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Catalog" }),
    ).toBeInTheDocument();
  });
});

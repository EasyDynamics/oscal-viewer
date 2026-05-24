import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ResolverModal, { type ResolverItem } from "./ResolverModal";

const loadingProfile: ResolverItem = {
  id: "profile",
  label: "Profile",
  modelKey: "profile",
  relation: "import-profile",
  status: "loading",
  error: null,
  resolvedUrl: "https://registry.oscal.io/api/v1/pirooz-javan/profiles/e6d7ea45-0d45-481a-8d02-855cfd60d8a8",
};

describe("ResolverModal", () => {
  it("replaces a loading snapshot with a live error state", async () => {
    const { rerender } = render(<ResolverModal items={[loadingProfile]} />);

    expect(await screen.findByText("Resolving Profile…")).toBeInTheDocument();

    rerender(<ResolverModal items={[{
      ...loadingProfile,
      status: "error",
      error: "Timed out resolving profile from registry after 8 seconds",
    }]} />);

    expect(await screen.findByText("Profile failed")).toBeInTheDocument();
    expect(screen.getByText("Timed out resolving profile from registry after 8 seconds")).toBeInTheDocument();
    expect(screen.queryByText("Resolving Profile…")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument();
  });
});

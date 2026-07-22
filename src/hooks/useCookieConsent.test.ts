import { describe, it, expect } from "vitest";
import { sanitizedAnalyticsPath, viewerAnalyticsPath } from "./useCookieConsent";

describe("sanitizedAnalyticsPath()", () => {
  it("returns the pathname unchanged when search and hash are empty", () => {
    expect(sanitizedAnalyticsPath("/profile")).toBe("/profile");
  });

  it("masks the 'url' search param value to 'loaded'", () => {
    expect(
      sanitizedAnalyticsPath("/ssp", "?url=https://example.com/secret.json"),
    ).toBe("/ssp?url=loaded");
  });

  it("preserves other search params unchanged while masking 'url'", () => {
    expect(
      sanitizedAnalyticsPath(
        "/ssp",
        "?url=https://example.com/secret.json&theme=dark",
      ),
    ).toBe("/ssp?url=loaded&theme=dark");
  });

  it("leaves search params unchanged when no 'url' key is present", () => {
    expect(sanitizedAnalyticsPath("/catalog", "?theme=dark")).toBe(
      "/catalog?theme=dark",
    );
  });

  it("appends the hash unchanged", () => {
    expect(sanitizedAnalyticsPath("/poam", "?url=foo", "#section-2")).toBe(
      "/poam?url=loaded#section-2",
    );
  });

  it("does not introduce a '?' when search is empty but hash is set", () => {
    expect(sanitizedAnalyticsPath("/poam", "", "#top")).toBe("/poam#top");
  });
});

describe("viewerAnalyticsPath()", () => {
  it("appends a 'view' parameter with the supplied viewId", () => {
    expect(viewerAnalyticsPath("/profile", "", "tree")).toBe(
      "/profile?view=tree",
    );
  });

  it("masks the 'url' search param value to 'loaded'", () => {
    expect(
      viewerAnalyticsPath("/ssp", "?url=https://example.com/x.json", "json"),
    ).toBe("/ssp?url=loaded&view=json");
  });

  it("preserves other search params while masking 'url' and appending 'view'", () => {
    expect(
      viewerAnalyticsPath(
        "/ssp",
        "?url=https://example.com/x.json&theme=dark",
        "json",
      ),
    ).toBe("/ssp?url=loaded&theme=dark&view=json");
  });

  it("overwrites an existing 'view' param with the supplied viewId", () => {
    expect(viewerAnalyticsPath("/profile", "?view=old", "new")).toBe(
      "/profile?view=new",
    );
  });

  it("always appends '?' followed by the view param even when search is empty", () => {
    expect(viewerAnalyticsPath("/catalog", "", "list")).toBe(
      "/catalog?view=list",
    );
  });
});

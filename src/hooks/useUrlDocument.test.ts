import { describe, it, expect } from "vitest";
import { fileNameFromUrl } from "./useUrlDocument";

describe("fileNameFromUrl()", () => {
  it("returns the last path segment of an absolute URL", () => {
    expect(fileNameFromUrl("https://example.com/a/b/catalog.json")).toBe(
      "catalog.json",
    );
  });

  it("ignores a trailing slash when picking the segment", () => {
    expect(fileNameFromUrl("https://example.com/a/b/c/")).toBe("c");
  });

  it("falls back to the raw input for malformed URLs", () => {
    expect(fileNameFromUrl("not a url")).toBe("not a url");
  });

  it("falls back to the raw input when the URL has no path segments", () => {
    expect(fileNameFromUrl("https://example.com")).toBe("https://example.com");
  });
});

import { describe, it, expect } from "vitest";
import { partyDisplayName, type PartyLike } from "./partyDisplay";

describe("partyDisplayName()", () => {
  it("returns 'Unknown party' for undefined input", () => {
    expect(partyDisplayName(undefined)).toBe("Unknown party");
  });

  it("returns the input unchanged when given a string (treated as a uuid)", () => {
    expect(partyDisplayName("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("returns the party's name when present", () => {
    const party: PartyLike = {
      uuid: "p1",
      name: "Acme Corp",
      "short-name": "Acme",
    };
    expect(partyDisplayName(party)).toBe("Acme Corp");
  });

  it("falls back to short-name when name is absent", () => {
    const party: PartyLike = { uuid: "p1", "short-name": "Acme" };
    expect(partyDisplayName(party)).toBe("Acme");
  });

  it("falls back to uuid when name and short-name are both absent", () => {
    const party: PartyLike = { uuid: "p1" };
    expect(partyDisplayName(party)).toBe("p1");
  });

  it("prefers name over short-name when both are present", () => {
    const party: PartyLike = {
      uuid: "p1",
      name: "Acme Corp",
      "short-name": "Acme",
    };
    expect(partyDisplayName(party)).toBe("Acme Corp");
  });

  it("treats an empty-string name as falsy and falls through to short-name", () => {
    const party: PartyLike = { uuid: "p1", name: "", "short-name": "Acme" };
    expect(partyDisplayName(party)).toBe("Acme");
  });
});

import { describe, it, expect } from "vitest";
import { isValidJwtFormat, authHeaders } from "./AuthContext";

describe("isValidJwtFormat()", () => {
  it("accepts a standard JWS (3 non-empty base64url segments)", () => {
    expect(isValidJwtFormat("header.payload.signature")).toBe(true);
  });

  it("accepts base64url characters including _ and -", () => {
    expect(isValidJwtFormat("a-b_c.d-e_f.g-h_i")).toBe(true);
  });

  it("accepts a JWE (5 segments, all non-empty)", () => {
    expect(isValidJwtFormat("hdr.ekey.iv.ct.tag")).toBe(true);
  });

  it("accepts a JWE with empty encrypted-key (dir algorithm)", () => {
    expect(isValidJwtFormat("hdr..iv.ct.tag")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidJwtFormat("")).toBe(false);
  });
});

describe("authHeaders()", () => {
  it("returns an empty object when no token is given", () => {
    expect(authHeaders(null)).toEqual({});
  });

  it("builds a Bearer authorization header from a token", () => {
    expect(authHeaders("abc.def.ghi")).toEqual({
      Authorization: "Bearer abc.def.ghi",
    });
  });
});

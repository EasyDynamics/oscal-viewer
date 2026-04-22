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

  it("rejects tokens with the wrong number of segments", () => {
    expect(isValidJwtFormat("only-one")).toBe(false);
    expect(isValidJwtFormat("two.parts")).toBe(false);
    expect(isValidJwtFormat("four.parts.here.now")).toBe(false);
    expect(isValidJwtFormat("six.parts.are.too.many.now")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidJwtFormat("")).toBe(false);
  });

  it("rejects non-base64url characters", () => {
    expect(isValidJwtFormat("hdr.pay load.sig")).toBe(false);
    expect(isValidJwtFormat("hdr.pay/load.sig")).toBe(false);
    expect(isValidJwtFormat("hdr.pay+load.sig")).toBe(false);
  });

  it("rejects a JWS with any empty segment", () => {
    expect(isValidJwtFormat(".payload.signature")).toBe(false);
    expect(isValidJwtFormat("header..signature")).toBe(false);
    expect(isValidJwtFormat("header.payload.")).toBe(false);
  });

  it("rejects a JWE with an empty header, iv, ciphertext, or tag", () => {
    expect(isValidJwtFormat(".ekey.iv.ct.tag")).toBe(false);
    expect(isValidJwtFormat("hdr.ekey..ct.tag")).toBe(false);
    expect(isValidJwtFormat("hdr.ekey.iv..tag")).toBe(false);
    expect(isValidJwtFormat("hdr.ekey.iv.ct.")).toBe(false);
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

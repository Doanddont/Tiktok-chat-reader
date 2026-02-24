import { describe, expect, test } from "bun:test";
import { cleanUsername, isValidUsername, parseError, sanitizeHtml } from "../../src/utils/sanitize";

describe("sanitizeHtml", () => {
  test("escapes HTML special chars", () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });

  test("escapes ampersands", () => {
    expect(sanitizeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  test("escapes single quotes", () => {
    expect(sanitizeHtml("it's")).toBe("it&#039;s");
  });

  test("returns empty for non-string", () => {
    expect(sanitizeHtml(null as any)).toBe("");
    expect(sanitizeHtml(undefined as any)).toBe("");
    expect(sanitizeHtml(123 as any)).toBe("");
  });

  test("passes through safe strings", () => {
    expect(sanitizeHtml("hello world")).toBe("hello world");
  });
});

describe("cleanUsername", () => {
  test("removes @ prefix", () => {
    expect(cleanUsername("@testuser")).toBe("testuser");
  });

  test("trims and lowercases", () => {
    expect(cleanUsername("  TestUser  ")).toBe("testuser");
  });

  test("handles empty string", () => {
    expect(cleanUsername("")).toBe("");
  });

  test("returns empty for non-string", () => {
    expect(cleanUsername(null as any)).toBe("");
    expect(cleanUsername(undefined as any)).toBe("");
  });
});

describe("isValidUsername", () => {
  test("accepts valid usernames", () => {
    expect(isValidUsername("testuser")).toBe(true);
    expect(isValidUsername("test.user")).toBe(true);
    expect(isValidUsername("test_user")).toBe(true);
    expect(isValidUsername("test123")).toBe(true);
  });

  test("rejects invalid usernames", () => {
    expect(isValidUsername("")).toBe(false);
    expect(isValidUsername("test user")).toBe(false);
    expect(isValidUsername("test@user")).toBe(false);
    expect(isValidUsername("test<script>")).toBe(false);
  });

  test("handles @ prefix", () => {
    expect(isValidUsername("@testuser")).toBe(true);
  });

  test("rejects too long usernames", () => {
    expect(isValidUsername("a".repeat(51))).toBe(false);
  });

  test("returns false for non-string", () => {
    expect(isValidUsername(null as any)).toBe(false);
    expect(isValidUsername(undefined as any)).toBe(false);
  });
});

describe("parseError", () => {
  test("returns string errors as-is", () => {
    expect(parseError("some error")).toBe("some error");
  });

  test("extracts message from Error", () => {
    expect(parseError(new Error("test error"))).toBe("test error");
  });

  test("extracts message from object", () => {
    expect(parseError({ message: "obj error" })).toBe("obj error");
  });

  test("returns fallback for unknown types", () => {
    expect(parseError(null)).toBe("Unknown error");
    expect(parseError(undefined)).toBe("Unknown error");
    expect(parseError(42)).toBe("Unknown error");
  });
});

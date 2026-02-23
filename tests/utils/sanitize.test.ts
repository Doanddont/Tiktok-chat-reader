import { describe, expect, test } from "bun:test";
import { cleanUsername, parseError, sanitizeHtml } from "../../src/utils/sanitize";

describe("sanitizeHtml", () => {
  test("escapes HTML entities", () => {
    expect(sanitizeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;&#x2F;script&gt;",
    );
  });

  test("escapes ampersands", () => {
    expect(sanitizeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  test("escapes double quotes", () => {
    expect(sanitizeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  test("escapes backticks", () => {
    expect(sanitizeHtml("use `code`")).toBe("use &#x60;code&#x60;");
  });

  test("escapes equals sign", () => {
    expect(sanitizeHtml("a=b")).toBe("a&#x3D;b");
  });

  test("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  test("handles plain text without escaping", () => {
    expect(sanitizeHtml("Hello World 123")).toBe("Hello World 123");
  });

  test("handles unicode and emojis", () => {
    expect(sanitizeHtml("Hello 🔥 世界")).toBe("Hello 🔥 世界");
  });

  test("coerces non-string input to string", () => {
    expect(sanitizeHtml(123 as any)).toBe("123");
    expect(sanitizeHtml(null as any)).toBe("null");
    expect(sanitizeHtml(undefined as any)).toBe("undefined");
  });
});

describe("cleanUsername", () => {
  test("removes @ prefix", () => {
    expect(cleanUsername("@charlidamelio")).toBe("charlidamelio");
  });

  test("trims whitespace", () => {
    expect(cleanUsername("  charlidamelio  ")).toBe("charlidamelio");
  });

  test("lowercases username", () => {
    expect(cleanUsername("CharliDamelio")).toBe("charlidamelio");
  });

  test("handles @ with spaces", () => {
    expect(cleanUsername("  @CharliDamelio  ")).toBe("charlidamelio");
  });

  test("handles empty string", () => {
    expect(cleanUsername("")).toBe("");
  });

  test("handles just @", () => {
    expect(cleanUsername("@")).toBe("");
  });

  test("handles username without @", () => {
    expect(cleanUsername("username123")).toBe("username123");
  });
});

describe("parseError", () => {
  test("parses LIVE ended error", () => {
    const result = parseError(new Error("LIVE has ended"));
    expect(result).toContain("live stream has ended");
  });

  test("parses stream ended error", () => {
    const result = parseError(new Error("The stream has ended"));
    expect(result).toContain("live stream has ended");
  });

  test("parses not found error", () => {
    const result = parseError(new Error("User not found"));
    expect(result).toContain("not found");
  });

  test("parses 404 error", () => {
    const result = parseError(new Error("Request failed with status 404"));
    expect(result).toContain("not found");
  });

  test("parses rate limit error", () => {
    const result = parseError(new Error("rate limit exceeded"));
    expect(result).toContain("Rate limited");
  });

  test("parses 429 error", () => {
    const result = parseError(new Error("Request failed with status 429"));
    expect(result).toContain("Rate limited");
  });

  test("parses network error ENOTFOUND", () => {
    const result = parseError(new Error("getaddrinfo ENOTFOUND"));
    expect(result).toContain("Network error");
  });

  test("parses network error ECONNREFUSED", () => {
    const result = parseError(new Error("connect ECONNREFUSED"));
    expect(result).toContain("Network error");
  });

  test("parses CAPTCHA error", () => {
    const result = parseError(new Error("CAPTCHA required"));
    expect(result).toContain("CAPTCHA");
  });

  test("returns raw message for unknown errors", () => {
    const result = parseError(new Error("Something weird happened"));
    expect(result).toBe("Something weird happened");
  });

  test("handles non-Error objects", () => {
    const result = parseError("string error");
    expect(result).toBe("string error");
  });

  test("handles null/undefined", () => {
    const result = parseError(null);
    expect(result).toBe("null");
  });
});

import { describe, expect, it } from "vitest";
import {
  generateDbName,
  generateDbUsername,
  slugify,
} from "~/lib/crypto.server";

describe("crypto.server", () => {
  it("slugify normalizes names to URL-safe slugs", () => {
    expect(slugify("My Cool Site!")).toBe("my-cool-site");
    expect(slugify("  test  ")).toBe("test");
  });

  it("generateDbUsername prefixes and sanitizes slug", () => {
    expect(generateDbUsername("my-site")).toBe("db_my_site");
  });

  it("generateDbName prefixes and sanitizes slug", () => {
    expect(generateDbName("my-site")).toBe("site_my_site");
  });
});

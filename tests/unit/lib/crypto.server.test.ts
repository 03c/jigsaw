import { describe, expect, it } from "vitest";
import {
  generateDbName,
  generateDbUsername,
  slugify,
} from "~/lib/crypto.server";

describe("crypto.server", () => {
  it("slugify normalizes names to URL-safe slugs", () => {
    expect(slugify("My Cool Site!")).toBe("my-cool-site");
  });

  it("generateDbUsername prefixes and sanitizes slug", () => {
    expect(generateDbUsername("my-site")).toBe("db_my_site");
  });

  it("generateDbName uses site_ prefix", () => {
    expect(generateDbName("demo")).toBe("site_demo");
  });
});

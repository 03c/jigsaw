import { describe, expect, it } from "vitest";
import { slugify, generateDbName } from "~/lib/crypto.server";

describe("crypto.server", () => {
  describe("slugify", () => {
    it("lowercases and replaces spaces with hyphens", () => {
      expect(slugify("My Cool Site")).toBe("my-cool-site");
    });

    it("strips leading and trailing punctuation", () => {
      expect(slugify("---hello---")).toBe("hello");
    });
  });

  describe("generateDbName", () => {
    it("prefixes site_ and sanitizes the slug", () => {
      expect(generateDbName("my-site")).toBe("site_my_site");
    });
  });
});

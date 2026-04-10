import { describe, expect, it } from "vitest";
import {
  generateDbName,
  generateDbUsername,
  slugify,
} from "~/lib/crypto.server";

describe("crypto.server", () => {
  describe("slugify", () => {
    it("lowercases and replaces non-alphanumeric runs with hyphens", () => {
      expect(slugify("My Cool Site!!!")).toBe("my-cool-site");
    });

    it("trims leading and trailing hyphens", () => {
      expect(slugify("---hello---")).toBe("hello");
    });
  });

  describe("generateDbUsername", () => {
    it("prefixes with db_ and sanitizes slug", () => {
      expect(generateDbUsername("my-site")).toBe("db_my_site");
    });
  });

  describe("generateDbName", () => {
    it("prefixes with site_ and sanitizes slug", () => {
      expect(generateDbName("prod-1")).toBe("site_prod_1");
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  buildParentUsername,
  createPasswordHash,
  DEFAULT_PARENT_PASSWORD,
  verifyPassword,
} from "@/lib/parent-account";

describe("parent accounts", () => {
  it("builds a stable pinyin plus student number username", () => {
    expect(buildParentUsername("寿子恒", "001")).toBe("shouziheng001");
  });

  it("verifies the generated password hash without storing plaintext", () => {
    const result = createPasswordHash(DEFAULT_PARENT_PASSWORD, "fixed-test-salt");
    expect(result.hash).not.toBe(DEFAULT_PARENT_PASSWORD);
    expect(verifyPassword(DEFAULT_PARENT_PASSWORD, result.salt, result.hash)).toBe(true);
    expect(verifyPassword("wrong-password", result.salt, result.hash)).toBe(false);
  });
});

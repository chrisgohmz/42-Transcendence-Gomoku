import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { isSeedProfileAvatarUrl, seedProfileAvatars } from "./seed-avatars";

describe("seed profile avatars", () => {
  test("whitelists only bundled public seed avatar files", () => {
    expect(seedProfileAvatars.length).toBeGreaterThan(0);

    for (const avatar of seedProfileAvatars) {
      expect(avatar.url).toMatch(/^\/seed-avatars\/[^/]+\.svg$/);
      expect(isSeedProfileAvatarUrl(avatar.url)).toBe(true);
      expect(existsSync(join(process.cwd(), "public", avatar.url.slice(1)))).toBe(true);
    }
  });

  test("rejects traversal-shaped and non-seed avatar URLs", () => {
    expect(isSeedProfileAvatarUrl("/seed-avatars/../alice.svg")).toBe(false);
    expect(isSeedProfileAvatarUrl("/api/avatars/alice.svg")).toBe(false);
    expect(isSeedProfileAvatarUrl("https://example.com/alice.svg")).toBe(false);
  });
});

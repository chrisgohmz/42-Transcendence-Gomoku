import { afterEach, describe, expect, mock, test } from "bun:test";
import path from "node:path";

await mock.module("server-only", () => ({}));

const {
  createProfileAvatarFilename,
  deleteProfileAvatarFile,
  getProfileAvatarContentType,
  getProfileAvatarFilenameFromUrl,
  getProfileAvatarStoragePath,
  getProfileAvatarUrl,
  isProfileAvatarFilename,
  readProfileAvatarFile,
  writeProfileAvatarFile,
} = await import("./profile-avatar-storage");

const writtenFilenames: string[] = [];

afterEach(async () => {
  const filenames = writtenFilenames.splice(0);

  await Promise.all(filenames.map((filename) => deleteProfileAvatarFile(filename)));
});

describe("profile avatar storage", () => {
  test("creates opaque avatar URLs for validated filenames outside public assets", () => {
    const filename = createProfileAvatarFilename("png");
    const filepath = getProfileAvatarStoragePath(filename);

    expect(filename).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/);
    expect(isProfileAvatarFilename(filename)).toBe(true);
    expect(getProfileAvatarUrl(filename)).toBe(`/api/avatars/${filename}`);
    expect(getProfileAvatarFilenameFromUrl(`/api/avatars/${filename}`)).toBe(filename);
    expect(getProfileAvatarContentType(filename)).toBe("image/png");
    expect(filepath).toContain(`${path.sep}storage${path.sep}avatars${path.sep}`);
    expect(filepath).not.toContain(`${path.sep}public${path.sep}`);
  });

  test("rejects non-avatar URLs and traversal-shaped filenames", () => {
    expect(isProfileAvatarFilename("../avatar.png")).toBe(false);
    expect(getProfileAvatarUrl("../avatar.png")).toBeNull();
    expect(getProfileAvatarFilenameFromUrl("/uploads/avatar.png")).toBeNull();
    expect(getProfileAvatarFilenameFromUrl("/api/avatars/../avatar.png")).toBeNull();
    expect(getProfileAvatarContentType("avatar.svg")).toBeNull();
    expect(getProfileAvatarStoragePath("avatar.png")).toBeNull();
  });

  test("writes, reads, and deletes stored avatar bytes", async () => {
    const filename = createProfileAvatarFilename("webp");
    const bytes = Buffer.from("normalized-avatar");

    writtenFilenames.push(filename);

    await writeProfileAvatarFile(filename, bytes);

    expect(await readProfileAvatarFile(filename)).toEqual(bytes);

    await deleteProfileAvatarFile(filename);
    writtenFilenames.pop();

    expect(await readProfileAvatarFile(filename)).toBeNull();
  });
});

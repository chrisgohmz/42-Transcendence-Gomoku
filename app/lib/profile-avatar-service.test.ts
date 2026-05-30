import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const normalizeProfileAvatarImage = mock();
const findUniqueUser = mock();
const updateUser = mock();

await mock.module("server-only", () => ({}));

const {
  createProfileAvatarFilename,
  deleteProfileAvatarFileByUrl,
  getProfileAvatarFilenameFromUrl,
  getProfileAvatarUrl,
  readProfileAvatarFile,
  writeProfileAvatarFile,
} = await import("@/lib/profile-avatar-storage");

await mock.module("@/lib/profile-avatar-image", () => ({
  normalizeProfileAvatarImage,
}));

await mock.module("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: findUniqueUser,
      update: updateUser,
    },
  },
}));

const { saveProfileAvatar, saveProfileSeedAvatar } = await import("./profile-avatar-service");

const normalizedBuffer = Buffer.from("normalized-avatar");
const writtenAvatarUrls: string[] = [];

afterEach(async () => {
  const urls = writtenAvatarUrls.splice(0);

  await Promise.all(urls.map((url) => deleteProfileAvatarFileByUrl(url)));
});

beforeEach(() => {
  normalizeProfileAvatarImage.mockReset();
  findUniqueUser.mockReset();
  updateUser.mockReset();

  normalizeProfileAvatarImage.mockResolvedValue({
    buffer: normalizedBuffer,
    extension: "png",
  });
  findUniqueUser.mockResolvedValue(null);
  updateUser.mockResolvedValue({});
});

describe("saveProfileAvatar", () => {
  test("returns false without touching storage when the image cannot be normalized", async () => {
    const input = Buffer.from("not an image");

    normalizeProfileAvatarImage.mockResolvedValueOnce(null);

    expect(await saveProfileAvatar("user-ada", input)).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });

  test("stores the normalized avatar, updates the profile URL, and cleans up the previous avatar", async () => {
    const input = Buffer.from("source-avatar");
    const previousFilename = createProfileAvatarFilename("jpg");
    const previousAvatarUrl = getProfileAvatarUrl(previousFilename)!;

    writtenAvatarUrls.push(previousAvatarUrl);
    await writeProfileAvatarFile(previousFilename, Buffer.from("previous-avatar"));
    findUniqueUser.mockResolvedValueOnce({ avatarUrl: previousAvatarUrl });

    expect(await saveProfileAvatar("user-ada", input)).toBe(true);

    const update = updateUser.mock.calls[0]?.[0] as {
      data: { avatarUrl: string };
      where: { id: string };
    };
    const savedFilename = getProfileAvatarFilenameFromUrl(update.data.avatarUrl);

    writtenAvatarUrls.push(update.data.avatarUrl);
    expect(normalizeProfileAvatarImage).toHaveBeenCalledWith(input);
    expect(findUniqueUser).toHaveBeenCalledWith({
      select: { avatarUrl: true },
      where: { id: "user-ada" },
    });
    expect(update).toEqual({
      data: {
        avatarUrl: expect.stringMatching(
          /^\/api\/avatars\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
        ),
      },
      where: { id: "user-ada" },
    });
    expect(await readProfileAvatarFile(savedFilename!)).toEqual(normalizedBuffer);
    expect(await readProfileAvatarFile(previousFilename)).toBeNull();
  });

  test("does not try to delete a previous avatar when none is stored", async () => {
    expect(await saveProfileAvatar("user-ada", Buffer.from("source-avatar"))).toBe(true);

    const update = updateUser.mock.calls[0]?.[0] as { data: { avatarUrl: string } };

    writtenAvatarUrls.push(update.data.avatarUrl);
    expect(update.data.avatarUrl.startsWith("/api/avatars/")).toBe(true);
  });

  test("removes the new file if profile persistence fails", async () => {
    let caughtError: unknown;

    updateUser.mockRejectedValueOnce(new Error("database unavailable"));

    try {
      await saveProfileAvatar("user-ada", Buffer.from("source-avatar"));
    } catch (error) {
      caughtError = error;
    }

    const update = updateUser.mock.calls[0]?.[0] as { data: { avatarUrl: string } };
    const savedFilename = getProfileAvatarFilenameFromUrl(update.data.avatarUrl);

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("database unavailable");
    expect(savedFilename).not.toBeNull();
    expect(await readProfileAvatarFile(savedFilename!)).toBeNull();
  });
});

describe("saveProfileSeedAvatar", () => {
  test("rejects non-whitelisted seed avatar URLs before persistence", async () => {
    expect(await saveProfileSeedAvatar("user-ada", "/seed-avatars/../alice.svg")).toBe(false);
    expect(findUniqueUser).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  test("stores a whitelisted seed avatar URL and cleans up the previous uploaded avatar", async () => {
    const previousFilename = createProfileAvatarFilename("webp");
    const previousAvatarUrl = getProfileAvatarUrl(previousFilename)!;

    writtenAvatarUrls.push(previousAvatarUrl);
    await writeProfileAvatarFile(previousFilename, Buffer.from("previous-avatar"));
    findUniqueUser.mockResolvedValueOnce({ avatarUrl: previousAvatarUrl });

    expect(await saveProfileSeedAvatar("user-ada", "/seed-avatars/hoshi.svg")).toBe(true);

    expect(findUniqueUser).toHaveBeenCalledWith({
      select: { avatarUrl: true },
      where: { id: "user-ada" },
    });
    expect(updateUser).toHaveBeenCalledWith({
      data: { avatarUrl: "/seed-avatars/hoshi.svg" },
      where: { id: "user-ada" },
    });
    expect(await readProfileAvatarFile(previousFilename)).toBeNull();
  });
});

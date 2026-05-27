import { afterEach, describe, expect, mock, test } from "bun:test";

await mock.module("server-only", () => ({}));

const { createProfileAvatarFilename, deleteProfileAvatarFile, writeProfileAvatarFile } =
  await import("@/lib/profile-avatar-storage");
const { GET } = await import("./route");

const writtenFilenames: string[] = [];

afterEach(async () => {
  const filenames = writtenFilenames.splice(0);

  await Promise.all(filenames.map((filename) => deleteProfileAvatarFile(filename)));
});

describe("profile avatar route", () => {
  test("serves only stored avatar bytes with explicit image headers", async () => {
    const filename = createProfileAvatarFilename("jpg");
    const bytes = Buffer.from("normalized-jpeg");

    writtenFilenames.push(filename);
    await writeProfileAvatarFile(filename, bytes);

    const response = await GET(new Request(`http://localhost/api/avatars/${filename}`), {
      params: Promise.resolve({ filename }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Content-Disposition")).toBe(`inline; filename="${filename}"`);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  });

  test("returns not found for invalid or missing avatar files", async () => {
    const missingFilename = createProfileAvatarFilename("png");

    expect(
      (
        await GET(new Request("http://localhost/api/avatars/../avatar.png"), {
          params: Promise.resolve({ filename: "../avatar.png" }),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await GET(new Request(`http://localhost/api/avatars/${missingFilename}`), {
          params: Promise.resolve({ filename: missingFilename }),
        })
      ).status,
    ).toBe(404);
  });
});

import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

const mkdir = mock();
const writeFile = mock();
const getLocale = mock();
const getTranslations = mock();
const revalidatePath = mock();
const headers = mock();
const getCurrentSession = mock();
const updateUser = mock();

await mock.module("server-only", () => ({}));

await mock.module("fs/promises", () => ({
  mkdir,
  writeFile,
}));

await mock.module("next-intl/server", () => ({
  getLocale,
  getTranslations,
}));

await mock.module("next/cache", () => ({
  revalidatePath,
}));

await mock.module("next/headers", () => ({
  headers,
}));

await mock.module("@/lib/auth", () =>
  createAuthModuleMock({
    getCurrentSession,
  }),
);

await mock.module("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: updateUser,
    },
  },
}));

const { uploadProfilePicture } = await import("./actions");

beforeEach(() => {
  mkdir.mockReset();
  writeFile.mockReset();
  getLocale.mockReset();
  getTranslations.mockReset();
  revalidatePath.mockReset();
  headers.mockReset();
  getCurrentSession.mockReset();
  updateUser.mockReset();

  mkdir.mockResolvedValue(undefined);
  writeFile.mockResolvedValue(undefined);
  getLocale.mockResolvedValue("en");
  getTranslations.mockImplementation(
    async ({ namespace }: { namespace: string }) =>
      (key: string) =>
        `${namespace}:${key}`,
  );
  headers.mockResolvedValue(new Headers({ "x-forwarded-for": "127.0.0.1" }));
  getCurrentSession.mockResolvedValue({
    user: {
      id: "user-ada",
    },
  });
  updateUser.mockResolvedValue({});
});

describe("uploadProfilePicture", () => {
  test("requires authentication before reading uploaded files", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const result = await uploadProfilePicture(formDataWithFile(pngFile()));

    expect(result).toEqual({ error: "profile.errors:loginRequired" });
    expect(mkdir).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  test("rejects missing, empty, oversized, and unsupported files", async () => {
    expect(await uploadProfilePicture(new FormData())).toEqual({
      error: "profile.errors:noFile",
    });

    expect(await uploadProfilePicture(formDataWithFile(new File([], "empty.png")))).toEqual({
      error: "profile.errors:noFile",
    });

    expect(
      await uploadProfilePicture(
        formDataWithFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png")),
      ),
    ).toEqual({
      error: "profile.errors:imageTooLarge",
    });

    expect(
      await uploadProfilePicture(formDataWithFile(new File(["not an image"], "avatar.txt"))),
    ).toEqual({
      error: "profile.errors:invalidImage",
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  test("stores supported image uploads and updates the user's avatar URL", async () => {
    const result = await uploadProfilePicture(formDataWithFile(pngFile("avatar.txt")));

    expect(result).toEqual({ success: true });
    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining("public/uploads"), {
      recursive: true,
    });
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining("user-ada-"),
      expect.any(Buffer),
    );
    expect(updateUser).toHaveBeenCalledWith({
      data: {
        avatarUrl: expect.stringMatching(
          /^\/uploads\/user-ada-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
        ),
      },
      where: { id: "user-ada" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  test("returns a translated save failure when storage or persistence throws", async () => {
    writeFile.mockRejectedValueOnce(new Error("disk full"));

    const result = await uploadProfilePicture(formDataWithFile(pngFile()));

    expect(result).toEqual({ error: "profile.errors:pictureSaveFailed" });
  });
});

function formDataWithFile(file: File) {
  const data = new FormData();
  data.set("file", file);
  return data;
}

function pngFile(name = "avatar.png") {
  return new File(
    [
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "base64",
      ),
    ],
    name,
    {
      type: "image/png",
    },
  );
}

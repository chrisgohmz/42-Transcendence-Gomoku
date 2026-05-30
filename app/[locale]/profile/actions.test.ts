import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

const getLocale = mock();
const getTranslations = mock();
const revalidatePath = mock();
const headers = mock();
const getCurrentSession = mock();
const saveProfileAvatar = mock();

await mock.module("server-only", () => ({}));

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

await mock.module("@/lib/profile-avatar-service", () => ({
  saveProfileAvatar,
}));

const { uploadProfilePicture } = await import("./actions");

beforeEach(() => {
  getLocale.mockReset();
  getTranslations.mockReset();
  revalidatePath.mockReset();
  headers.mockReset();
  getCurrentSession.mockReset();
  saveProfileAvatar.mockReset();

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
  saveProfileAvatar.mockResolvedValue(true);
});

describe("uploadProfilePicture", () => {
  test("requires authentication before reading uploaded files", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const result = await uploadProfilePicture(formDataWithFile(pngFile()));

    expect(result).toEqual({ error: "profile.errors:loginRequired" });
    expect(saveProfileAvatar).not.toHaveBeenCalled();
  });

  test("rejects a missing upload file", async () => {
    expect(await uploadProfilePicture(new FormData())).toEqual({
      error: "profile.errors:noFile",
    });
    expect(saveProfileAvatar).not.toHaveBeenCalled();
  });

  test("rejects an empty upload file", async () => {
    expect(await uploadProfilePicture(formDataWithFile(new File([], "empty.png")))).toEqual({
      error: "profile.errors:noFile",
    });
    expect(saveProfileAvatar).not.toHaveBeenCalled();
  });

  test("rejects an oversized upload file", async () => {
    expect(
      await uploadProfilePicture(
        formDataWithFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png")),
      ),
    ).toEqual({
      error: "profile.errors:imageTooLarge",
    });
    expect(saveProfileAvatar).not.toHaveBeenCalled();
  });

  test("rejects upload bytes that cannot be normalized as an avatar image", async () => {
    saveProfileAvatar.mockResolvedValueOnce(false);

    expect(
      await uploadProfilePicture(formDataWithFile(new File(["not an image"], "avatar.txt"))),
    ).toEqual({
      error: "profile.errors:invalidImage",
    });
    expect(saveProfileAvatar).toHaveBeenCalledTimes(1);
  });

  test("saves supported image uploads for the current user", async () => {
    const result = await uploadProfilePicture(formDataWithFile(pngFile("avatar.txt")));

    expect(result).toEqual({ success: true });
    expect(saveProfileAvatar).toHaveBeenCalledWith("user-ada", expect.any(Buffer));
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("returns a translated save failure when avatar persistence throws", async () => {
    saveProfileAvatar.mockRejectedValueOnce(new Error("disk full"));

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

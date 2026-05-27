import { describe, expect, mock, test } from "bun:test";

import sharp from "sharp";

await mock.module("server-only", () => ({}));

const { getSupportedProfileImageExtension, normalizeProfileAvatarImage } =
  await import("./profile-avatar-image");

const testImage = {
  create: {
    background: { b: 56, g: 34, r: 12 },
    channels: 3,
    height: 6,
    width: 12,
  },
} as const;

describe("profile avatar image normalization", () => {
  test("detects only the supported avatar image formats from magic bytes", async () => {
    const jpeg = await sharp(testImage).jpeg().toBuffer();
    const png = await sharp(testImage).png().toBuffer();
    const webp = await sharp(testImage).webp().toBuffer();

    expect(getSupportedProfileImageExtension(jpeg)).toBe("jpg");
    expect(getSupportedProfileImageExtension(png)).toBe("png");
    expect(getSupportedProfileImageExtension(webp)).toBe("webp");
    expect(getSupportedProfileImageExtension(Buffer.from("<svg />"))).toBeNull();
  });

  test("rejects a magic-byte-only image that cannot be decoded", async () => {
    const pngHeaderOnly = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(await normalizeProfileAvatarImage(pngHeaderOnly)).toBeNull();
  });

  test("applies EXIF orientation before stripping image metadata", async () => {
    const input = await sharp(testImage).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const inputMetadata = await sharp(input).metadata();

    expect(inputMetadata.orientation).toBe(6);
    expect(inputMetadata.exif).toBeInstanceOf(Buffer);

    const normalized = await normalizeProfileAvatarImage(input);

    expect(normalized?.extension).toBe("jpg");

    const outputMetadata = await sharp(normalized!.buffer).metadata();

    expect(outputMetadata.format).toBe("jpeg");
    expect(outputMetadata.width).toBe(6);
    expect(outputMetadata.height).toBe(12);
    expect(outputMetadata.orientation).toBeUndefined();
    expect(outputMetadata.exif).toBeUndefined();
    expect(outputMetadata.icc).toBeUndefined();
  });

  test("bounds avatar output dimensions during normalization", async () => {
    const input = await sharp({
      create: {
        background: { b: 180, g: 140, r: 100 },
        channels: 3,
        height: 400,
        width: 800,
      },
    })
      .png()
      .toBuffer();

    const normalized = await normalizeProfileAvatarImage(input);
    const outputMetadata = await sharp(normalized!.buffer).metadata();

    expect(normalized?.extension).toBe("png");
    expect(outputMetadata.width).toBe(512);
    expect(outputMetadata.height).toBe(256);
  });
});

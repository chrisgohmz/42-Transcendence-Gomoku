import "server-only";
import sharp from "sharp";

import type { SupportedProfileAvatarExtension } from "@/lib/profile-avatar-format";

type SharpPipeline = sharp.Sharp;
export type { SupportedProfileAvatarExtension } from "@/lib/profile-avatar-format";

export type NormalizedProfileAvatarImage = {
  buffer: Buffer;
  extension: SupportedProfileAvatarExtension;
};

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const maxProfileAvatarPixels = 4096 * 4096;
const maxProfileAvatarDimension = 512;

function hasSignature(buffer: Buffer, signature: readonly number[]) {
  if (buffer.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => buffer[index] === byte);
}

export function getSupportedProfileImageExtension(
  buffer: Buffer,
): SupportedProfileAvatarExtension | null {
  const isJPEG =
    buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPNG = hasSignature(buffer, pngSignature);
  const isWebP =
    buffer.length > 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  if (isJPEG) {
    return "jpg";
  }

  if (isPNG) {
    return "png";
  }

  if (isWebP) {
    return "webp";
  }

  return null;
}

function encodeAvatarImage(pipeline: SharpPipeline, extension: SupportedProfileAvatarExtension) {
  switch (extension) {
    case "jpg":
      return pipeline.jpeg({ mozjpeg: true, quality: 88 });
    case "png":
      return pipeline.png({ adaptiveFiltering: true, compressionLevel: 9 });
    case "webp":
      return pipeline.webp({ effort: 5, quality: 86 });
  }
}

export async function normalizeProfileAvatarImage(
  buffer: Buffer,
): Promise<NormalizedProfileAvatarImage | null> {
  const extension = getSupportedProfileImageExtension(buffer);

  if (!extension) {
    return null;
  }

  try {
    const pipeline = sharp(buffer, {
      animated: false,
      limitInputPixels: maxProfileAvatarPixels,
    })
      .autoOrient()
      .resize({
        fit: "inside",
        height: maxProfileAvatarDimension,
        width: maxProfileAvatarDimension,
        withoutEnlargement: true,
      });

    return {
      buffer: await encodeAvatarImage(pipeline, extension).toBuffer(),
      extension,
    };
  } catch {
    return null;
  }
}

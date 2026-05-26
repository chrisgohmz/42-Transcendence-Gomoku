"use server";

import { writeFile, mkdir } from "fs/promises";
import { randomUUID } from "node:crypto";
import path from "path";

import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

const maxProfilePictureBytes = 5 * 1024 * 1024;
const profilePictureFileSchema = z
  .custom<File>((value) => typeof File !== "undefined" && value instanceof File, {
    message: "noFile",
  })
  .refine((file) => file.size > 0, { message: "noFile" })
  .refine((file) => file.size <= maxProfilePictureBytes, { message: "imageTooLarge" });

function getSupportedProfileImageExtension(buffer: Buffer): "jpg" | "png" | "webp" | null {
  const isJPEG =
    buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPNG =
    buffer.length > 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
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

const profilePictureBufferSchema = z
  .custom<Buffer>((value) => Buffer.isBuffer(value), { message: "invalidImage" })
  .refine((buffer) => getSupportedProfileImageExtension(buffer) !== null, {
    message: "invalidImage",
  });

export async function uploadProfilePicture(formData: FormData) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "profile.errors" });
  const sessionData = await getCurrentSession();

  if (!sessionData) {
    return { error: t("loginRequired") };
  }

  const rateLimit = consumeRateLimit(await headers(), {
    key: "profile:avatar-upload",
    max: 10,
    subject: `user:${sessionData.user.id}`,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { error: t("pictureSaveFailed") };
  }

  const fileValidation = profilePictureFileSchema.safeParse(formData.get("file"));

  if (!fileValidation.success) {
    const issue = fileValidation.error.issues[0]?.message;
    return { error: t(issue === "imageTooLarge" ? "imageTooLarge" : "noFile") };
  }

  try {
    const file = fileValidation.data;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const bufferValidation = profilePictureBufferSchema.safeParse(buffer);

    if (!bufferValidation.success) {
      return { error: t("invalidImage") };
    }

    const extension = getSupportedProfileImageExtension(buffer);

    if (!extension) {
      return { error: t("invalidImage") };
    }

    const filename = `${sessionData.user.id}-${randomUUID()}.${extension}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");

    await mkdir(uploadDir, { recursive: true });
    const filepath = path.join(uploadDir, filename);

    await writeFile(filepath, buffer);

    const fileUrl = `/uploads/${filename}`;

    await prisma.user.update({
      where: { id: sessionData.user.id },
      data: { avatarUrl: fileUrl },
    });

    revalidatePath("/");
    return { success: true };
  } catch {
    return { error: t("pictureSaveFailed") };
  }
}

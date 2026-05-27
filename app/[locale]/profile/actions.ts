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
import { normalizeProfileAvatarImage } from "@/lib/profile-avatar-image";
import { consumeRateLimit } from "@/lib/rate-limit";
import { rateLimitRule, userRateLimitSubject } from "@/lib/rate-limit-rules";

const maxProfilePictureBytes = 5 * 1024 * 1024;
const profilePictureFileSchema = z
  .custom<File>((value) => typeof File !== "undefined" && value instanceof File, {
    message: "noFile",
  })
  .refine((file) => file.size > 0, { message: "noFile" })
  .refine((file) => file.size <= maxProfilePictureBytes, { message: "imageTooLarge" });

export async function uploadProfilePicture(formData: FormData) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "profile.errors" });
  const sessionData = await getCurrentSession();

  if (!sessionData) {
    return { error: t("loginRequired") };
  }

  const rateLimit = consumeRateLimit(
    await headers(),
    rateLimitRule("profileAvatarUpload", userRateLimitSubject(sessionData.user.id)),
  );

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
    const normalizedImage = await normalizeProfileAvatarImage(buffer);

    if (!normalizedImage) {
      return { error: t("invalidImage") };
    }

    const filename = `${sessionData.user.id}-${randomUUID()}.${normalizedImage.extension}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");

    await mkdir(uploadDir, { recursive: true });
    const filepath = path.join(uploadDir, filename);

    await writeFile(filepath, normalizedImage.buffer);

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

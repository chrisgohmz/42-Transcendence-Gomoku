"use server";

import { writeFile, mkdir } from "fs/promises";
import path from "path";

import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function uploadProfilePicture(formData: FormData) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "profile.errors" });
  const sessionData = await getCurrentSession();

  if (!sessionData) {
    return { error: t("loginRequired") };
  }

  const file = formData.get("file") as File;

  if (!file || file.size === 0) {
    return { error: t("noFile") };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: t("imageTooLarge") };
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

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

    if (!isJPEG && !isPNG && !isWebP) {
      return { error: t("invalidImage") };
    }

    const filename = `${sessionData.user.id}-${Date.now()}${path.extname(file.name)}`;
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

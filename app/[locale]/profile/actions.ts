"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth";
import { saveProfileAvatar } from "@/lib/profile-avatar-service";
import { isRateLimited } from "@/lib/rate-limit";
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

  const rateLimitExceeded = await isRateLimited(
    await headers(),
    rateLimitRule("profileAvatarUpload", userRateLimitSubject(sessionData.user.id)),
  );

  if (rateLimitExceeded) {
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
    const saved = await saveProfileAvatar(sessionData.user.id, buffer);

    if (!saved) {
      return { error: t("invalidImage") };
    }

    revalidatePath("/");
    return { success: true };
  } catch {
    return { error: t("pictureSaveFailed") };
  }
}

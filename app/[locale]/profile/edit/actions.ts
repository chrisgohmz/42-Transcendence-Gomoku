"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { getCurrentSession, verifyPassword, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function saveAccountSettings(formData: FormData) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "profile.errors" });
  const sessionData = await getCurrentSession();

  if (!sessionData) {
    return { error: t("loginRequired") };
  }

  const newDisplayName = formData.get("displayName") as string;
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // 1. Update Display Name
  if (!newDisplayName || newDisplayName.trim() === "") {
    return { error: t("displayNameRequired") };
  }

  const updateData: { displayName: string; passwordHash?: string } = {
    displayName: newDisplayName,
  };

  // 2. Check if they want to change the password
  const wantsToChangePassword = currentPassword || newPassword || confirmPassword;

  if (wantsToChangePassword) {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return { error: t("incompletePassword") };
    }

    if (newPassword !== confirmPassword) {
      return { error: t("passwordMismatch") };
    }

    if (newPassword.length < 8) {
      return { error: t("shortPassword") };
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionData.user.id },
    });

    const isValid = user && (await verifyPassword(currentPassword, user.passwordHash ?? null));

    if (!isValid) {
      return { error: t("currentPasswordIncorrect") };
    }

    updateData.passwordHash = await hashPassword(newPassword);
  }

  try {
    await prisma.user.update({
      where: { id: sessionData.user.id },
      data: updateData,
    });
  } catch {
    return { error: t("profileSaveFailed") };
  }

  revalidatePath("/", "layout");
  return { success: t("saveSuccess") };
}

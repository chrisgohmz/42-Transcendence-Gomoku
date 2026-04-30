"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { getCurrentSession, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  fieldIssuesToMap,
  type ProfileSettingsField,
  type ProfileSettingsValidationIssueCode,
  validateProfileSettingsInput,
} from "@/lib/validation/auth-profile";

import type { ProfileSettingsActionState } from "./action-state";

function translateProfileIssues(
  issues: { code: ProfileSettingsValidationIssueCode; field: ProfileSettingsField }[],
  t: (key: ProfileSettingsValidationIssueCode) => string,
) {
  return fieldIssuesToMap(issues, t);
}

export async function saveAccountSettings(
  _previousState: ProfileSettingsActionState,
  formData: FormData,
): Promise<ProfileSettingsActionState> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "profile.errors" });
  const sessionData = await getCurrentSession();

  if (!sessionData) {
    return { fields: {}, message: t("loginRequired"), successMessage: null };
  }

  const validation = validateProfileSettingsInput({
    confirmPassword: formData.get("confirmPassword"),
    currentPassword: formData.get("currentPassword"),
    displayName: formData.get("displayName"),
    newPassword: formData.get("newPassword"),
  });

  if (!validation.ok) {
    return {
      fields: translateProfileIssues(validation.issues, t),
      message: t("fixHighlightedFields"),
      successMessage: null,
    };
  }

  const updateData: { displayName: string; passwordHash?: string } = {
    displayName: validation.data.displayName,
  };

  if (validation.data.wantsToChangePassword) {
    const user = await prisma.user.findUnique({
      where: { id: sessionData.user.id },
    });

    const isValid =
      user && (await verifyPassword(validation.data.currentPassword, user.passwordHash ?? null));

    if (!isValid) {
      return {
        fields: { currentPassword: [t("currentPasswordIncorrect")] },
        message: t("fixHighlightedFields"),
        successMessage: null,
      };
    }

    updateData.passwordHash = await hashPassword(validation.data.newPassword);
  }

  try {
    await prisma.user.update({
      where: { id: sessionData.user.id },
      data: updateData,
    });
  } catch {
    return { fields: {}, message: t("profileSaveFailed"), successMessage: null };
  }

  revalidatePath("/", "layout");
  return { fields: {}, message: null, successMessage: t("saveSuccess") };
}

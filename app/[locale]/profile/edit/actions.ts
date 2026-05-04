"use server";

import { isAPIError } from "better-auth/api";
import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth, getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  fieldIssuesToMap,
  type ProfileSettingsField,
  type ProfileSettingsValidationIssueCode,
  validateProfileDisplayNameInput,
  validateProfilePasswordInput,
} from "@/lib/validation/auth-profile";

import type { ProfileSettingsActionState } from "./action-state";

function translateProfileIssues(
  issues: { code: ProfileSettingsValidationIssueCode; field: ProfileSettingsField }[],
  t: (key: ProfileSettingsValidationIssueCode) => string,
) {
  return fieldIssuesToMap(issues, t);
}

export async function saveDisplayName(
  _previousState: ProfileSettingsActionState,
  formData: FormData,
): Promise<ProfileSettingsActionState> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "profile.errors" });
  const sessionData = await getCurrentSession();

  if (!sessionData) {
    return { fields: {}, message: t("loginRequired"), successMessage: null };
  }

  const validation = validateProfileDisplayNameInput({
    displayName: formData.get("displayName"),
  });

  if (!validation.ok) {
    return {
      fields: translateProfileIssues(validation.issues, t),
      message: t("fixHighlightedFields"),
      successMessage: null,
    };
  }

  try {
    await prisma.user.update({
      where: { id: sessionData.user.id },
      data: {
        displayName: validation.data.displayName,
      },
    });
  } catch {
    return { fields: {}, message: t("profileSaveFailed"), successMessage: null };
  }

  revalidatePath("/", "layout");
  return { fields: {}, message: null, successMessage: t("saveSuccess") };
}

export async function changeAccountPassword(
  _previousState: ProfileSettingsActionState,
  formData: FormData,
): Promise<ProfileSettingsActionState> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "profile.errors" });
  const sessionData = await getCurrentSession();

  if (!sessionData) {
    return { fields: {}, message: t("loginRequired"), successMessage: null };
  }

  const validation = validateProfilePasswordInput({
    confirmPassword: formData.get("confirmPassword"),
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });

  if (!validation.ok) {
    return {
      fields: translateProfileIssues(validation.issues, t),
      message: t("fixHighlightedFields"),
      successMessage: null,
    };
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: validation.data.currentPassword,
        newPassword: validation.data.newPassword,
        revokeOtherSessions: false,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) {
      return {
        fields: { currentPassword: [t("currentPasswordIncorrect")] },
        message: t("fixHighlightedFields"),
        successMessage: null,
      };
    }

    return { fields: {}, message: t("profileSaveFailed"), successMessage: null };
  }

  revalidatePath("/", "layout");
  return { fields: {}, message: null, successMessage: t("saveSuccess") };
}

"use server";

import { isAPIError } from "better-auth/api";
import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";

import type { LoginActionState, SignupActionState } from "./auth-action-state";
import { defaultLocale, locales, type Locale } from "./i18n/config";
import { redirect } from "./i18n/navigation";
import { auth, getDuplicateSignupFields as findDuplicateSignupFields } from "./lib/auth";
import {
  getDuplicateSignupFieldErrors,
  hasDuplicateSignupFields,
} from "./lib/auth-duplicate-fields";
import {
  fieldIssuesToMap,
  type AuthField,
  type AuthValidationIssueCode,
  validateLoginInput,
  validateSignupInput,
} from "./lib/validation/auth-profile";

function getFormString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function isLocale(value: string | null | undefined): value is Locale {
  return locales.some((locale) => locale === value);
}

async function getActionLocale(formData: FormData): Promise<Locale> {
  const formLocale = getFormString(formData, "locale");

  if (isLocale(formLocale)) {
    return formLocale;
  }

  const requestLocale = await getLocale().catch(() => defaultLocale);
  return isLocale(requestLocale) ? requestLocale : defaultLocale;
}

function translateAuthIssues(
  issues: { code: AuthValidationIssueCode; field: AuthField }[],
  t: (key: AuthValidationIssueCode) => string,
) {
  return fieldIssuesToMap(issues, t);
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const locale = await getActionLocale(formData);
  const t = await getTranslations({ locale, namespace: "auth.errors" });
  const rawEmail = getFormString(formData, "email");
  const validation = validateLoginInput({
    email: rawEmail,
    password: getFormString(formData, "password"),
  });

  if (!validation.ok) {
    return {
      email: rawEmail,
      fields: translateAuthIssues(validation.issues, t),
      message: t("fixHighlightedFields"),
    };
  }

  try {
    await auth.api.signInEmail({
      body: {
        email: validation.data.email,
        password: validation.data.password,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) {
      return {
        email: rawEmail,
        fields: {},
        message: t("invalidCredentials"),
      };
    }

    return {
      email: rawEmail,
      fields: {},
      message: t("loginUnavailable"),
    };
  }

  return redirect({ href: "/account", locale });
}

export async function signupAction(
  _previousState: SignupActionState,
  formData: FormData,
): Promise<SignupActionState> {
  const locale = await getActionLocale(formData);
  const t = await getTranslations({ locale, namespace: "auth.errors" });
  const email = getFormString(formData, "email");
  const username = getFormString(formData, "username");
  const displayName = getFormString(formData, "displayName");
  const validation = validateSignupInput({
    displayName,
    email,
    password: getFormString(formData, "password"),
    username,
  });

  if (!validation.ok) {
    return {
      displayName,
      email,
      fields: translateAuthIssues(validation.issues, t),
      message: t("fixHighlightedFields"),
      username,
    };
  }

  try {
    const duplicateFields = await findDuplicateSignupFields(
      validation.data.email,
      validation.data.username,
    );

    if (hasDuplicateSignupFields(duplicateFields)) {
      return {
        displayName,
        email,
        fields: getDuplicateSignupFieldErrors(duplicateFields, t),
        message: t("duplicateAccount"),
        username,
      };
    }

    await auth.api.signUpEmail({
      body: {
        email: validation.data.email,
        name: validation.data.displayName,
        password: validation.data.password,
        username: validation.data.username,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) {
      const duplicateFields = await findDuplicateSignupFields(
        validation.data.email,
        validation.data.username,
      ).catch(() => ({}));

      if (hasDuplicateSignupFields(duplicateFields)) {
        return {
          displayName,
          email,
          fields: getDuplicateSignupFieldErrors(duplicateFields, t),
          message: t("duplicateAccount"),
          username,
        };
      }
    }

    if (error instanceof Error && error.message.includes("Unique constraint")) {
      const duplicateFields = await findDuplicateSignupFields(
        validation.data.email,
        validation.data.username,
      ).catch(() => ({}));

      return {
        displayName,
        email,
        fields: getDuplicateSignupFieldErrors(duplicateFields, t),
        message: t("duplicateAccount"),
        username,
      };
    }

    return {
      displayName,
      email,
      fields: {},
      message: t("signupUnavailable"),
      username,
    };
  }

  return redirect({ href: "/account", locale });
}

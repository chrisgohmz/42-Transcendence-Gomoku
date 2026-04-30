"use server";

import { getLocale, getTranslations } from "next-intl/server";

import type { LoginActionState, SignupActionState } from "./auth-action-state";
import { defaultLocale, locales, type Locale } from "./i18n/config";
import { redirect } from "./i18n/navigation";
import { getPrismaUniqueConstraintFields, isPrismaUniqueConstraintError } from "./lib/api-errors";
import { clearSessionCookie, createSession, hashPassword, verifyPassword } from "./lib/auth";
import { prisma } from "./lib/prisma";
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

function getDuplicateSignupFields(
  error: unknown,
  t: (key: "duplicateAccount" | "duplicateEmail" | "duplicateUsername") => string,
): Partial<Record<AuthField, string[]>> {
  if (!isPrismaUniqueConstraintError(error)) {
    return {};
  }

  const targetFields = getPrismaUniqueConstraintFields(error);
  const fields: Partial<Record<AuthField, string[]>> = {};

  if (targetFields.includes("email")) {
    fields.email = [t("duplicateEmail")];
  }

  if (targetFields.includes("username")) {
    fields.username = [t("duplicateUsername")];
  }

  return Object.keys(fields).length > 0
    ? fields
    : {
        email: [t("duplicateAccount")],
        username: [t("duplicateAccount")],
      };
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
    await clearSessionCookie();

    return {
      email: rawEmail,
      fields: translateAuthIssues(validation.issues, t),
      message: t("fixHighlightedFields"),
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: validation.data.email },
    });

    const isValid =
      user && (await verifyPassword(validation.data.password, user.passwordHash ?? null));

    if (!user || !isValid) {
      await clearSessionCookie();

      return {
        email: rawEmail,
        fields: {},
        message: t("invalidCredentials"),
      };
    }

    await createSession(user.id);
  } catch {
    await clearSessionCookie();

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
    const passwordHash = await hashPassword(validation.data.password);

    const user = await prisma.user.create({
      data: {
        email: validation.data.email,
        username: validation.data.username,
        displayName: validation.data.displayName,
        passwordHash,
        profile: {
          create: {},
        },
      },
    });

    await createSession(user.id);
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return {
        displayName,
        email,
        fields: getDuplicateSignupFields(error, t),
        message: t("duplicateAccount"),
        username,
      };
    }

    await clearSessionCookie();

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

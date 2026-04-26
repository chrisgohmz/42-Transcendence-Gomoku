"use server";

import { getLocale, getTranslations } from "next-intl/server";

import type { LoginActionState, SignupActionState } from "./auth-action-state";
import { defaultLocale, locales, type Locale } from "./i18n/config";
import { redirect } from "./i18n/navigation";
import { clearSessionCookie, createSession, hashPassword, verifyPassword } from "./lib/auth";
import { prisma } from "./lib/prisma";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeUsername(username: string): string {
  return username.trim();
}

function getFormString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
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

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const locale = await getActionLocale(formData);
  const t = await getTranslations({ locale, namespace: "auth.errors" });
  const email = getFormString(formData, "email");
  const password = getFormString(formData, "password").trim();

  if (!email.trim() || !password) {
    await clearSessionCookie();

    return {
      email,
      message: t("invalidCredentials"),
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });

    const isValid = user && (await verifyPassword(password, user.passwordHash ?? null));

    if (!user || !isValid) {
      await clearSessionCookie();

      return {
        email,
        message: t("invalidCredentials"),
      };
    }

    await createSession(user.id);
  } catch {
    await clearSessionCookie();

    return {
      email,
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
  const password = getFormString(formData, "password").trim();

  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username);
  const normalizedDisplayName = displayName.trim() || normalizedUsername;

  if (!normalizedEmail || !normalizedUsername || !password) {
    return {
      displayName,
      email,
      message: t("requiredSignupFields"),
      username,
    };
  }

  if (!normalizedEmail.includes("@") || !normalizedEmail.includes(".")) {
    return {
      displayName,
      email,
      message: t("invalidEmail"),
      username,
    };
  }

  if (normalizedUsername.length < 3) {
    return {
      displayName,
      email,
      message: t("shortUsername"),
      username,
    };
  }

  if (password.length < 8) {
    return {
      displayName,
      email,
      message: t("shortPassword"),
      username,
    };
  }

  try {
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        displayName: normalizedDisplayName,
        passwordHash,
        profile: {
          create: {},
        },
      },
    });

    await createSession(user.id);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        displayName,
        email,
        message: t("duplicateAccount"),
        username,
      };
    }

    await clearSessionCookie();

    return {
      displayName,
      email,
      message: t("signupUnavailable"),
      username,
    };
  }

  return redirect({ href: "/account", locale });
}

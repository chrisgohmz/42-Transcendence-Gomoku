"use server";

import { isAPIError } from "better-auth/api";
import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";

import type {
  LoginActionState,
  PasswordResetConfirmActionState,
  PasswordResetRequestActionState,
  SignupActionState,
} from "./auth-action-state";
import { defaultLocale, locales, type Locale } from "./i18n/config";
import { redirect } from "./i18n/navigation";
import { auth, getDuplicateSignupFields as findDuplicateSignupFields } from "./lib/auth";
import {
  getDuplicateSignupFieldErrors,
  hasDuplicateSignupFields,
} from "./lib/auth-duplicate-fields";
import { getLocalizedAuthAppUrl } from "./lib/auth-urls";
import { isRateLimited } from "./lib/rate-limit";
import { rateLimitRule, type RateLimitRuleName } from "./lib/rate-limit-rules";
import {
  fieldIssuesToMap,
  type AuthField,
  type AuthValidationIssueCode,
  type PasswordResetConfirmField,
  type PasswordResetConfirmValidationIssueCode,
  type PasswordResetRequestField,
  validateLoginInput,
  validatePasswordResetConfirmInput,
  validatePasswordResetRequestInput,
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

function translatePasswordResetRequestIssues(
  issues: { code: AuthValidationIssueCode; field: PasswordResetRequestField }[],
  t: (key: AuthValidationIssueCode) => string,
) {
  return fieldIssuesToMap(issues, t);
}

function translatePasswordResetConfirmIssues(
  issues: {
    code: PasswordResetConfirmValidationIssueCode;
    field: PasswordResetConfirmField;
  }[],
  t: (key: PasswordResetConfirmValidationIssueCode) => string,
) {
  return fieldIssuesToMap(issues, t);
}

function getPasswordResetRedirectUrl(locale: Locale, headerList: Headers): string {
  return getLocalizedAuthAppUrl(locale, "/reset-password", { headers: headerList });
}

function isEmailNotVerifiedError(error: unknown): boolean {
  return (
    isAPIError(error) &&
    error.statusCode === 403 &&
    (error.body as { code?: string } | undefined)?.code === "EMAIL_NOT_VERIFIED"
  );
}

async function isActionRateLimited(
  headerList: Pick<Headers, "get">,
  ruleName: RateLimitRuleName,
): Promise<boolean> {
  return isRateLimited(headerList, rateLimitRule(ruleName));
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
    const headerList = await headers();

    if (await isActionRateLimited(headerList, "authActionLogin")) {
      return {
        email: rawEmail,
        fields: {},
        message: t("loginUnavailable"),
      };
    }

    await auth.api.signInEmail({
      body: {
        callbackURL: getLocalizedAuthAppUrl(locale, "/profile", { headers: headerList }),
        email: validation.data.email,
        password: validation.data.password,
        rememberMe: getFormString(formData, "remember") === "on",
      },
      headers: headerList,
    });
  } catch (error) {
    if (isEmailNotVerifiedError(error)) {
      return {
        email: rawEmail,
        fields: {},
        message: t("emailNotVerified"),
      };
    }

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

  return redirect({ href: "/profile", locale });
}

export async function requestPasswordResetAction(
  _previousState: PasswordResetRequestActionState,
  formData: FormData,
): Promise<PasswordResetRequestActionState> {
  const locale = await getActionLocale(formData);
  const t = await getTranslations({ locale, namespace: "auth.errors" });
  const email = getFormString(formData, "email");
  const validation = validatePasswordResetRequestInput({ email });

  if (!validation.ok) {
    return {
      email,
      fields: translatePasswordResetRequestIssues(validation.issues, t),
      message: t("fixHighlightedFields"),
      successMessage: null,
    };
  }

  try {
    const headerList = await headers();

    if (await isActionRateLimited(headerList, "authActionPasswordResetRequest")) {
      return {
        email,
        fields: {},
        message: t("passwordResetUnavailable"),
        successMessage: null,
      };
    }

    await auth.api.requestPasswordReset({
      body: {
        email: validation.data.email,
        redirectTo: getPasswordResetRedirectUrl(locale, headerList),
      },
    });
  } catch {
    return {
      email,
      fields: {},
      message: t("passwordResetUnavailable"),
      successMessage: null,
    };
  }

  return {
    email,
    fields: {},
    message: null,
    successMessage: t("passwordResetEmailSent"),
  };
}

export async function resetPasswordAction(
  _previousState: PasswordResetConfirmActionState,
  formData: FormData,
): Promise<PasswordResetConfirmActionState> {
  const locale = await getActionLocale(formData);
  const t = await getTranslations({ locale, namespace: "auth.errors" });
  const token = getFormString(formData, "token");

  if (!token) {
    return {
      fields: {},
      message: t("invalidResetToken"),
      successMessage: null,
    };
  }

  const validation = validatePasswordResetConfirmInput({
    confirmPassword: getFormString(formData, "confirmPassword"),
    newPassword: getFormString(formData, "newPassword"),
  });

  if (!validation.ok) {
    return {
      fields: translatePasswordResetConfirmIssues(validation.issues, t),
      message: t("fixHighlightedFields"),
      successMessage: null,
    };
  }

  try {
    const headerList = await headers();

    if (await isActionRateLimited(headerList, "authActionPasswordResetConfirm")) {
      return {
        fields: {},
        message: t("passwordResetUnavailable"),
        successMessage: null,
      };
    }

    await auth.api.resetPassword({
      body: {
        newPassword: validation.data.newPassword,
        token,
      },
    });
  } catch (error) {
    return {
      fields: {},
      message: isAPIError(error) ? t("invalidResetToken") : t("passwordResetUnavailable"),
      successMessage: null,
    };
  }

  return {
    fields: {},
    message: null,
    successMessage: t("passwordResetSuccess"),
  };
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
      successMessage: null,
      username,
    };
  }

  try {
    const headerList = await headers();

    if (await isActionRateLimited(headerList, "authActionSignup")) {
      return {
        displayName,
        email,
        fields: {},
        message: t("signupUnavailable"),
        successMessage: null,
        username,
      };
    }

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
        successMessage: null,
        username,
      };
    }

    await auth.api.signUpEmail({
      body: {
        callbackURL: getLocalizedAuthAppUrl(locale, "/profile", { headers: headerList }),
        email: validation.data.email,
        name: validation.data.displayName,
        password: validation.data.password,
        username: validation.data.username,
      },
      headers: headerList,
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
          successMessage: null,
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
        successMessage: null,
        username,
      };
    }

    return {
      displayName,
      email,
      fields: {},
      message: t("signupUnavailable"),
      successMessage: null,
      username,
    };
  }

  return {
    displayName,
    email,
    fields: {},
    message: null,
    successMessage: t("signupVerificationEmailSent"),
    username,
  };
}

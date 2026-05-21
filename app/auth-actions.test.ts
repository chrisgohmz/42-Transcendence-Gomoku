import { beforeEach, describe, expect, mock, test } from "bun:test";

import { APIError } from "better-auth/api";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

const getLocale = mock();
const getTranslations = mock();
const headers = mock();
const redirect = mock();
const signInEmail = mock();
const signUpEmail = mock();
const requestPasswordReset = mock();
const resetPassword = mock();
const getDuplicateSignupFields = mock();

await mock.module("server-only", () => ({}));

await mock.module("next-intl/server", () => ({
  getLocale,
  getTranslations,
}));

await mock.module("next/headers", () => ({
  headers,
}));

await mock.module("./i18n/navigation", () => ({
  redirect,
}));

await mock.module("./lib/auth", () =>
  createAuthModuleMock({
    auth: {
      api: {
        requestPasswordReset,
        resetPassword,
        signInEmail,
        signUpEmail,
      },
    },
    getDuplicateSignupFields,
  }),
);

const { loginAction, requestPasswordResetAction, resetPasswordAction, signupAction } =
  await import("./auth-actions");
const {
  initialLoginActionState,
  initialPasswordResetConfirmActionState,
  initialPasswordResetRequestActionState,
  initialSignupActionState,
} = await import("./auth-action-state");

function formData(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

beforeEach(() => {
  getLocale.mockReset();
  getTranslations.mockReset();
  headers.mockReset();
  redirect.mockReset();
  signInEmail.mockReset();
  signUpEmail.mockReset();
  requestPasswordReset.mockReset();
  resetPassword.mockReset();
  getDuplicateSignupFields.mockReset();

  getLocale.mockResolvedValue("en");
  getTranslations.mockImplementation(
    async ({ locale, namespace }: { locale: string; namespace: string }) =>
      (key: string) =>
        `${locale}:${namespace}:${key}`,
  );
  headers.mockResolvedValue(new Headers({ cookie: "session=1", origin: "https://app.test" }));
  redirect.mockImplementation((args: unknown) => ({ redirected: args }));
  signInEmail.mockResolvedValue({});
  signUpEmail.mockResolvedValue({});
  requestPasswordReset.mockResolvedValue({});
  resetPassword.mockResolvedValue({});
  getDuplicateSignupFields.mockResolvedValue({});
});

describe("loginAction", () => {
  test("returns localized field errors and preserves the raw email on validation failure", async () => {
    const state = await loginAction(
      initialLoginActionState,
      formData({
        email: "not-an-email",
        locale: "ja",
        password: "short",
      }),
    );

    expect(state).toEqual({
      email: "not-an-email",
      fields: {
        email: ["ja:auth.errors:invalidEmail"],
        password: ["ja:auth.errors:shortPassword"],
      },
      message: "ja:auth.errors:fixHighlightedFields",
    });
    expect(signInEmail).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  test("maps Better Auth credential failures to a public invalid-credentials message", async () => {
    signInEmail.mockRejectedValueOnce(new APIError("UNAUTHORIZED", { message: "bad login" }));

    const state = await loginAction(
      initialLoginActionState,
      formData({
        email: "MAX@example.COM",
        password: "password123",
      }),
    );

    expect(signInEmail).toHaveBeenCalledWith({
      body: {
        callbackURL: "https://app.test/en/profile",
        email: "max@example.com",
        password: "password123",
        rememberMe: false,
      },
      headers: expect.any(Headers),
    });
    expect(state).toEqual({
      email: "MAX@example.COM",
      fields: {},
      message: "en:auth.errors:invalidCredentials",
    });
  });

  test("maps unverified email sign-in to a verification message", async () => {
    signInEmail.mockRejectedValueOnce(
      new APIError("FORBIDDEN", {
        code: "EMAIL_NOT_VERIFIED",
        message: "Email not verified",
      }),
    );

    const state = await loginAction(
      initialLoginActionState,
      formData({
        email: "max@example.com",
        password: "password123",
      }),
    );

    expect(state).toEqual({
      email: "max@example.com",
      fields: {},
      message: "en:auth.errors:emailNotVerified",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  test("redirects to the localized profile route after a successful sign-in", async () => {
    const state = await loginAction(
      initialLoginActionState,
      formData({
        email: "max@example.com",
        locale: "zh",
        password: "password123",
      }),
    );

    expect(state as unknown).toEqual({
      redirected: {
        href: "/profile",
        locale: "zh",
      },
    });
  });
});

describe("requestPasswordResetAction", () => {
  test("validates the submitted email before calling Better Auth", async () => {
    const state = await requestPasswordResetAction(
      initialPasswordResetRequestActionState,
      formData({
        email: "not-an-email",
        locale: "ja",
      }),
    );

    expect(state).toEqual({
      email: "not-an-email",
      fields: {
        email: ["ja:auth.errors:invalidEmail"],
      },
      message: "ja:auth.errors:fixHighlightedFields",
      successMessage: null,
    });
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  test("asks Better Auth to send a reset link without revealing account existence", async () => {
    const state = await requestPasswordResetAction(
      initialPasswordResetRequestActionState,
      formData({
        email: "MAX@example.COM",
        locale: "en",
      }),
    );

    expect(requestPasswordReset).toHaveBeenCalledWith({
      body: {
        email: "max@example.com",
        redirectTo: "https://app.test/en/reset-password",
      },
    });
    expect(state).toEqual({
      email: "MAX@example.COM",
      fields: {},
      message: null,
      successMessage: "en:auth.errors:passwordResetEmailSent",
    });
  });

  test("maps reset request failures to a public unavailable message", async () => {
    requestPasswordReset.mockRejectedValueOnce(new Error("mail down"));

    const state = await requestPasswordResetAction(
      initialPasswordResetRequestActionState,
      formData({
        email: "max@example.com",
      }),
    );

    expect(state).toEqual({
      email: "max@example.com",
      fields: {},
      message: "en:auth.errors:passwordResetUnavailable",
      successMessage: null,
    });
  });
});

describe("resetPasswordAction", () => {
  test("requires a reset token before calling Better Auth", async () => {
    const state = await resetPasswordAction(
      initialPasswordResetConfirmActionState,
      formData({
        confirmPassword: "password999",
        newPassword: "password999",
      }),
    );

    expect(state).toEqual({
      fields: {},
      message: "en:auth.errors:invalidResetToken",
      successMessage: null,
    });
    expect(resetPassword).not.toHaveBeenCalled();
  });

  test("validates matching reset password fields", async () => {
    const state = await resetPasswordAction(
      initialPasswordResetConfirmActionState,
      formData({
        confirmPassword: "password000",
        newPassword: "short",
        token: "reset-token",
      }),
    );

    expect(state).toEqual({
      fields: {
        confirmPassword: ["en:auth.errors:passwordMismatch"],
        newPassword: ["en:auth.errors:shortPassword"],
      },
      message: "en:auth.errors:fixHighlightedFields",
      successMessage: null,
    });
    expect(resetPassword).not.toHaveBeenCalled();
  });

  test("resets the password through Better Auth", async () => {
    const state = await resetPasswordAction(
      initialPasswordResetConfirmActionState,
      formData({
        confirmPassword: "password999",
        newPassword: "password999",
        token: "reset-token",
      }),
    );

    expect(resetPassword).toHaveBeenCalledWith({
      body: {
        newPassword: "password999",
        token: "reset-token",
      },
    });
    expect(state).toEqual({
      fields: {},
      message: null,
      successMessage: "en:auth.errors:passwordResetSuccess",
    });
  });

  test("maps Better Auth token failures to the reset-token message", async () => {
    resetPassword.mockRejectedValueOnce(new APIError("BAD_REQUEST", { message: "bad token" }));

    const state = await resetPasswordAction(
      initialPasswordResetConfirmActionState,
      formData({
        confirmPassword: "password999",
        newPassword: "password999",
        token: "reset-token",
      }),
    );

    expect(state).toEqual({
      fields: {},
      message: "en:auth.errors:invalidResetToken",
      successMessage: null,
    });
  });
});

describe("signupAction", () => {
  test("returns localized field errors and preserves submitted values on validation failure", async () => {
    const state = await signupAction(
      initialSignupActionState,
      formData({
        displayName: "Max",
        email: "not-an-email",
        locale: "ja",
        password: "short",
        username: "bad user",
      }),
    );

    expect(state).toMatchObject({
      displayName: "Max",
      email: "not-an-email",
      fields: {
        email: ["ja:auth.errors:invalidEmail"],
        password: ["ja:auth.errors:shortPassword"],
        username: ["ja:auth.errors:invalidUsername"],
      },
      message: "ja:auth.errors:fixHighlightedFields",
      username: "bad user",
    });
    expect(getDuplicateSignupFields).not.toHaveBeenCalled();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  test("returns duplicate field errors before calling Better Auth", async () => {
    getDuplicateSignupFields.mockResolvedValueOnce({ email: true, username: true });

    const state = await signupAction(
      initialSignupActionState,
      formData({
        displayName: "Max",
        email: "max@example.com",
        password: "password123",
        username: "max_player",
      }),
    );

    expect(state).toMatchObject({
      fields: {
        email: ["en:auth.errors:duplicateEmail"],
        username: ["en:auth.errors:duplicateUsername"],
      },
      message: "en:auth.errors:duplicateAccount",
    });
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  test("maps late unique constraint failures to duplicate account errors", async () => {
    signUpEmail.mockRejectedValueOnce(new Error("Unique constraint failed on the fields"));
    getDuplicateSignupFields.mockResolvedValueOnce({}).mockResolvedValueOnce({ username: true });

    const state = await signupAction(
      initialSignupActionState,
      formData({
        displayName: "Max",
        email: "max@example.com",
        password: "password123",
        username: "max_player",
      }),
    );

    expect(state).toMatchObject({
      fields: {
        username: ["en:auth.errors:duplicateUsername"],
      },
      message: "en:auth.errors:duplicateAccount",
    });
  });

  test("asks Better Auth to send verification email after successful signup", async () => {
    const state = await signupAction(
      initialSignupActionState,
      formData({
        displayName: "Max",
        email: "max@example.com",
        locale: "ja",
        password: "password123",
        username: "max_player",
      }),
    );

    expect(signUpEmail).toHaveBeenCalledWith({
      body: {
        callbackURL: "https://app.test/ja/profile",
        email: "max@example.com",
        name: "Max",
        password: "password123",
        username: "max_player",
      },
      headers: expect.any(Headers),
    });
    expect(state).toEqual({
      displayName: "Max",
      email: "max@example.com",
      fields: {},
      message: null,
      successMessage: "ja:auth.errors:signupVerificationEmailSent",
      username: "max_player",
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});

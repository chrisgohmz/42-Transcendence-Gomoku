import { beforeEach, describe, expect, mock, test } from "bun:test";

import { APIError } from "better-auth/api";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

const getLocale = mock();
const getTranslations = mock();
const headers = mock();
const redirect = mock();
const signInEmail = mock();
const signUpEmail = mock();
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
        signInEmail,
        signUpEmail,
      },
    },
    getDuplicateSignupFields,
  }),
);

const { loginAction, signupAction } = await import("./auth-actions");
const { initialLoginActionState, initialSignupActionState } = await import("./auth-action-state");

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
  getDuplicateSignupFields.mockReset();

  getLocale.mockResolvedValue("en");
  getTranslations.mockImplementation(
    async ({ locale, namespace }: { locale: string; namespace: string }) =>
      (key: string) =>
        `${locale}:${namespace}:${key}`,
  );
  headers.mockResolvedValue(new Headers({ cookie: "session=1" }));
  redirect.mockImplementation((args: unknown) => ({ redirected: args }));
  signInEmail.mockResolvedValue({});
  signUpEmail.mockResolvedValue({});
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
        email: "max@example.com",
        password: "password123",
      },
      headers: expect.any(Headers),
    });
    expect(state).toEqual({
      email: "MAX@example.COM",
      fields: {},
      message: "en:auth.errors:invalidCredentials",
    });
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

    expect(state).toEqual({
      redirected: {
        href: "/profile",
        locale: "zh",
      },
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

  test("redirects to the localized profile route after successful signup", async () => {
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
        email: "max@example.com",
        name: "Max",
        password: "password123",
        username: "max_player",
      },
      headers: expect.any(Headers),
    });
    expect(state).toEqual({
      redirected: {
        href: "/profile",
        locale: "ja",
      },
    });
  });
});

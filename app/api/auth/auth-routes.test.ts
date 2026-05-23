import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { APIError } from "better-auth/api";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

await mock.module("server-only", () => ({}));
await mock.module("next-intl/server", () => ({
  getLocale: async () => "en",
  getTranslations: async () => (key: string) => key,
}));

const changePassword = mock();
const setPassword = mock();
const revalidatePath = mock();
const signInEmail = mock();
const signUpEmail = mock();
const getCurrentSession = mock();
const getDuplicateSignupFields = mock();
const hasCredentialPassword = mock();
const findUnique = mock();
const updateUser = mock();
const originalBetterAuthUrl = process.env["BETTER_AUTH_URL"];
const originalBetterAuthTrustedOrigins = process.env["BETTER_AUTH_TRUSTED_ORIGINS"];
const originalCaddySiteAddress = process.env["CADDY_SITE_ADDRESS"];

await mock.module("next/cache", () => ({
  revalidatePath,
}));
await mock.module("next/headers", () => ({
  headers: async () => new Headers(),
}));

type AuthApiCall = {
  body: Record<string, unknown>;
  returnHeaders?: boolean;
};

const user = {
  id: "user-1",
  username: "max_player",
  displayName: "Max",
  email: "max@example.com",
  emailVerified: true,
};

await mock.module("../../lib/auth", () =>
  createAuthModuleMock({
    auth: {
      api: {
        changePassword,
        setPassword,
        signInEmail,
        signUpEmail,
      },
    },
    getCurrentSession,
    getDuplicateSignupFields,
    hasCredentialPassword,
  }),
);

await mock.module("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique,
      update: updateUser,
    },
  },
}));
await mock.module("@/lib/auth", () =>
  createAuthModuleMock({
    auth: {
      api: {
        changePassword,
        setPassword,
        signInEmail,
        signUpEmail,
      },
    },
    getCurrentSession,
    getDuplicateSignupFields,
    hasCredentialPassword,
  }),
);
await mock.module("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique,
      update: updateUser,
    },
  },
}));

const loginRoute = await import("./login/route");
const profileActions = await import("../../[locale]/profile/edit/actions");
const sessionRoute = await import("./session/route");
const signupRoute = await import("./signup/route");

const previousState = {
  fields: {},
  message: null,
  successMessage: null,
};

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function hostileJsonRequest(path: string, body: unknown) {
  return new Request(`https://evil.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://evil.test",
      "x-forwarded-host": "evil.test",
      "x-forwarded-proto": "https",
    },
    body: JSON.stringify(body),
  });
}

function trustedOriginJsonRequest(origin: string, path: string, body: unknown) {
  const host = new URL(origin).host;

  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "x-forwarded-host": host,
      "x-forwarded-proto": "https",
    },
    body: JSON.stringify(body),
  });
}

function malformedJsonRequest(path: string) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: "{",
  });
}

function formData(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

function givenSignedOutUser() {
  getCurrentSession.mockResolvedValueOnce(null);
}

function givenSignedInCredentialUser() {
  hasCredentialPassword.mockResolvedValueOnce(true);
}

function givenSignedInOAuthOnlyUser() {
  hasCredentialPassword.mockResolvedValueOnce(false);
}

beforeEach(() => {
  delete process.env["BETTER_AUTH_URL"];
  delete process.env["BETTER_AUTH_TRUSTED_ORIGINS"];
  delete process.env["CADDY_SITE_ADDRESS"];

  changePassword.mockReset();
  setPassword.mockReset();
  signInEmail.mockReset();
  signUpEmail.mockReset();
  getCurrentSession.mockReset();
  getDuplicateSignupFields.mockReset();
  hasCredentialPassword.mockReset();
  findUnique.mockReset();
  revalidatePath.mockReset();
  updateUser.mockReset();

  changePassword.mockResolvedValue({ status: true });
  setPassword.mockResolvedValue({ status: true });
  signInEmail.mockResolvedValue({
    headers: new Headers({ "set-cookie": "session=login" }),
    response: { user: { id: user.id } },
  });
  signUpEmail.mockResolvedValue({
    headers: new Headers(),
    response: { user: { id: user.id } },
  });
  getDuplicateSignupFields.mockResolvedValue({});
  findUnique.mockResolvedValue(user);
  getCurrentSession.mockResolvedValue({
    user: { id: user.id },
  });
  updateUser.mockResolvedValue({
    id: user.id,
    displayName: "Max J",
  });
});

afterEach(() => {
  if (originalBetterAuthUrl === undefined) {
    delete process.env["BETTER_AUTH_URL"];
  } else {
    process.env["BETTER_AUTH_URL"] = originalBetterAuthUrl;
  }

  if (originalBetterAuthTrustedOrigins === undefined) {
    delete process.env["BETTER_AUTH_TRUSTED_ORIGINS"];
  } else {
    process.env["BETTER_AUTH_TRUSTED_ORIGINS"] = originalBetterAuthTrustedOrigins;
  }

  if (originalCaddySiteAddress === undefined) {
    delete process.env["CADDY_SITE_ADDRESS"];
  } else {
    process.env["CADDY_SITE_ADDRESS"] = originalCaddySiteAddress;
  }
});

describe("auth API routes", () => {
  test("login rejects malformed request bodies before credential lookup", async () => {
    const response = await loginRoute.POST(malformedJsonRequest("/api/auth/login"));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: "invalid_request",
      message: "invalidRequestBody",
    });
    expect(signInEmail).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  test("login returns field errors for invalid credentials shape", async () => {
    const response = await loginRoute.POST(
      jsonRequest("/api/auth/login", {
        email: "not-an-email",
        password: "",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: "validation_failed",
      message: "fixHighlightedFields",
      fields: {
        email: ["invalidEmail"],
        password: ["shortPassword"],
      },
    });
    expect(signInEmail).not.toHaveBeenCalled();
  });

  test("login signs in with normalized credentials and returns session headers", async () => {
    const response = await loginRoute.POST(
      jsonRequest("/api/auth/login", {
        email: "MAX@example.COM",
        password: "password123",
      }),
    );
    const payload = await response.json();
    const call = signInEmail.mock.calls[0]?.[0] as AuthApiCall;

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBe("session=login");
    expect(call.body).toMatchObject({
      callbackURL: "http://localhost/en/profile",
      email: "max@example.com",
      password: "password123",
    });
    expect(call.returnHeaders).toBe(true);
    expect(payload).toMatchObject({
      user: {
        id: user.id,
        email: user.email,
      },
    });
  });

  test("login uses the configured app origin for callbacks instead of the request origin", async () => {
    process.env["BETTER_AUTH_URL"] = "https://canonical.test";

    await loginRoute.POST(
      hostileJsonRequest("/api/auth/login", {
        email: "MAX@example.COM",
        password: "password123",
      }),
    );
    const call = signInEmail.mock.calls[0]?.[0] as AuthApiCall;

    expect(call.body).toMatchObject({
      callbackURL: "https://canonical.test/en/profile",
      email: "max@example.com",
      password: "password123",
    });
  });

  test("login keeps callbacks on the current request origin when it is trusted", async () => {
    process.env["BETTER_AUTH_URL"] = "https://lan-host.test:8443";
    process.env["BETTER_AUTH_TRUSTED_ORIGINS"] =
      "https://localhost:8443,https://lan-host.test:8443";

    await loginRoute.POST(
      trustedOriginJsonRequest("https://localhost:8443", "/api/auth/login", {
        email: "MAX@example.COM",
        password: "password123",
      }),
    );
    const call = signInEmail.mock.calls[0]?.[0] as AuthApiCall;

    expect(call.body).toMatchObject({
      callbackURL: "https://localhost:8443/en/profile",
      email: "max@example.com",
      password: "password123",
    });
  });

  test("login maps Better Auth credential failures to the public invalid-credentials shape", async () => {
    signInEmail.mockRejectedValueOnce(new APIError("UNAUTHORIZED", { message: "bad login" }));

    const response = await loginRoute.POST(
      jsonRequest("/api/auth/login", {
        email: "max@example.com",
        password: "password123",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({
      error: "invalid_credentials",
      message: "invalidCredentials",
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  test("login maps unverified emails to a verification-required response", async () => {
    signInEmail.mockRejectedValueOnce(
      new APIError("FORBIDDEN", {
        code: "EMAIL_NOT_VERIFIED",
        message: "Email not verified",
      }),
    );

    const response = await loginRoute.POST(
      jsonRequest("/api/auth/login", {
        email: "max@example.com",
        password: "password123",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      error: "email_not_verified",
      message: "emailNotVerified",
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  test("login fails closed when Better Auth returns a user id that no longer exists", async () => {
    findUnique.mockResolvedValueOnce(null);

    const response = await loginRoute.POST(
      jsonRequest("/api/auth/login", {
        email: "max@example.com",
        password: "password123",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      error: "login_failed",
      message: "loginUnavailable",
    });
  });

  test("login maps unexpected failures to the public unavailable shape with detail", async () => {
    signInEmail.mockRejectedValueOnce(new Error("network split"));

    const response = await loginRoute.POST(
      jsonRequest("/api/auth/login", {
        email: "max@example.com",
        password: "password123",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      detail: "network split",
      error: "login_failed",
      message: "loginUnavailable",
    });
  });

  test("signup rejects malformed request bodies before duplicate lookup", async () => {
    const response = await signupRoute.POST(malformedJsonRequest("/api/auth/signup"));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: "invalid_request",
      message: "invalidRequestBody",
    });
    expect(getDuplicateSignupFields).not.toHaveBeenCalled();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  test("signup returns field errors for invalid profile input", async () => {
    const response = await signupRoute.POST(
      jsonRequest("/api/auth/signup", {
        displayName: "",
        email: "not-an-email",
        password: "short",
        username: "no spaces",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: "validation_failed",
      message: "fixHighlightedFields",
    });
    expect(payload.fields).toMatchObject({
      email: ["invalidEmail"],
      password: ["shortPassword"],
      username: ["invalidUsername"],
    });
    expect(getDuplicateSignupFields).not.toHaveBeenCalled();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  test("signup maps duplicate email and username errors before calling Better Auth", async () => {
    getDuplicateSignupFields.mockResolvedValueOnce({ email: true, username: true });

    const response = await signupRoute.POST(
      jsonRequest("/api/auth/signup", {
        displayName: "Max",
        email: "max@example.com",
        password: "password123",
        username: "max_player",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: "duplicate_account",
      fields: {
        email: ["duplicateEmail"],
        username: ["duplicateUsername"],
      },
      message: "duplicateAccount",
    });
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  test("signup creates an account and returns a verification-required response", async () => {
    findUnique.mockResolvedValueOnce({ ...user, emailVerified: false });

    const response = await signupRoute.POST(
      jsonRequest("/api/auth/signup", {
        displayName: "Max",
        email: "MAX@example.COM",
        password: "password123",
        username: "max_player",
      }),
    );
    const payload = await response.json();
    const call = signUpEmail.mock.calls[0]?.[0] as AuthApiCall;

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(call.body).toMatchObject({
      callbackURL: "http://localhost/en/profile",
      email: "max@example.com",
      name: "Max",
      password: "password123",
      username: "max_player",
    });
    expect(payload).toMatchObject({
      user: {
        id: user.id,
        username: user.username,
      },
      verificationRequired: true,
    });
  });

  test("signup uses the configured app origin for callbacks instead of the request origin", async () => {
    process.env["BETTER_AUTH_URL"] = "https://canonical.test";
    findUnique.mockResolvedValueOnce({ ...user, emailVerified: false });

    await signupRoute.POST(
      hostileJsonRequest("/api/auth/signup", {
        displayName: "Max",
        email: "MAX@example.COM",
        password: "password123",
        username: "max_player",
      }),
    );
    const call = signUpEmail.mock.calls[0]?.[0] as AuthApiCall;

    expect(call.body).toMatchObject({
      callbackURL: "https://canonical.test/en/profile",
      email: "max@example.com",
      name: "Max",
      password: "password123",
      username: "max_player",
    });
  });

  test("signup fails closed when Better Auth returns a user id that no longer exists", async () => {
    findUnique.mockResolvedValueOnce(null);

    const response = await signupRoute.POST(
      jsonRequest("/api/auth/signup", {
        displayName: "Max",
        email: "max@example.com",
        password: "password123",
        username: "max_player",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      error: "signup_failed",
      message: "signupUnavailable",
    });
  });

  test("signup maps Better Auth API duplicate failures through a fresh duplicate check", async () => {
    signUpEmail.mockRejectedValueOnce(new APIError("BAD_REQUEST", { message: "duplicate" }));
    getDuplicateSignupFields.mockResolvedValueOnce({}).mockResolvedValueOnce({ email: true });

    const response = await signupRoute.POST(
      jsonRequest("/api/auth/signup", {
        displayName: "Max",
        email: "max@example.com",
        password: "password123",
        username: "max_player",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: "duplicate_account",
      fields: {
        email: ["duplicateEmail"],
      },
      message: "duplicateAccount",
    });
  });

  test("signup maps database unique constraint failures to duplicate-account errors", async () => {
    signUpEmail.mockRejectedValueOnce(new Error("Unique constraint failed on the fields"));
    getDuplicateSignupFields.mockResolvedValueOnce({}).mockResolvedValueOnce({ username: true });

    const response = await signupRoute.POST(
      jsonRequest("/api/auth/signup", {
        displayName: "Max",
        email: "max@example.com",
        password: "password123",
        username: "max_player",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: "duplicate_account",
      fields: {
        username: ["duplicateUsername"],
      },
      message: "duplicateAccount",
    });
  });

  test("signup maps unexpected failures to the public unavailable shape with detail", async () => {
    signUpEmail.mockRejectedValueOnce(new Error("mail service down"));

    const response = await signupRoute.POST(
      jsonRequest("/api/auth/signup", {
        displayName: "Max",
        email: "max@example.com",
        password: "password123",
        username: "max_player",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      detail: "mail service down",
      error: "signup_failed",
      message: "signupUnavailable",
    });
  });

  test("session returns the current serialized user and session timestamps", async () => {
    getCurrentSession.mockResolvedValueOnce({
      user,
      session: {
        id: "session-1",
        createdAt: new Date("2026-05-04T00:00:00.000Z"),
        expiresAt: new Date("2026-05-11T00:00:00.000Z"),
      },
    });

    const response = await sessionRoute.GET(new Request("http://localhost/api/auth/session"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      user: {
        id: user.id,
        email: user.email,
      },
      session: {
        id: "session-1",
        createdAt: "2026-05-04T00:00:00.000Z",
        expiresAt: "2026-05-11T00:00:00.000Z",
      },
    });
  });

  test("session returns unauthorized when Better Auth has no current session", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await sessionRoute.GET(new Request("http://localhost/api/auth/session"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({
      error: "unauthorized",
      message: "unauthorized",
    });
  });

  test("saveDisplayName updates only the profile field", async () => {
    const state = await profileActions.saveDisplayName(
      previousState,
      formData({
        displayName: "Max J",
      }),
    );

    expect(updateUser).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { displayName: "Max J" },
    });
    expect(changePassword).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      fields: {},
      message: null,
      successMessage: "saveSuccess",
    });
  });

  test("saveDisplayName requires a signed-in user", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const state = await profileActions.saveDisplayName(
      previousState,
      formData({
        displayName: "Max J",
      }),
    );

    expect(updateUser).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      fields: {},
      message: "loginRequired",
      successMessage: null,
    });
  });

  test("saveDisplayName validates display name before updating", async () => {
    const state = await profileActions.saveDisplayName(
      previousState,
      formData({
        displayName: "",
      }),
    );

    expect(updateUser).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      fields: {
        displayName: ["displayNameRequired"],
      },
      message: "fixHighlightedFields",
      successMessage: null,
    });
  });

  test("saveDisplayName returns a profile-save error when persistence fails", async () => {
    updateUser.mockRejectedValueOnce(new Error("write failed"));

    const state = await profileActions.saveDisplayName(
      previousState,
      formData({
        displayName: "Max J",
      }),
    );

    expect(state).toMatchObject({
      fields: {},
      message: "profileSaveFailed",
      successMessage: null,
    });
  });

  test("changeAccountPassword validates password fields before calling Better Auth", async () => {
    const state = await profileActions.changeAccountPassword(
      previousState,
      formData({
        currentPassword: "password123",
        newPassword: "password999",
      }),
    );

    expect(state).toMatchObject({
      fields: {
        confirmPassword: ["confirmPasswordRequired"],
      },
      message: "fixHighlightedFields",
      successMessage: null,
    });
    expect(changePassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  test("changeAccountPassword requires a signed-in user", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const state = await profileActions.changeAccountPassword(
      previousState,
      formData({
        currentPassword: "password123",
        newPassword: "password999",
        confirmPassword: "password999",
      }),
    );

    expect(changePassword).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      fields: {},
      message: "loginRequired",
      successMessage: null,
    });
  });

  test("changeAccountPassword maps Better Auth password failures to the current-password field", async () => {
    changePassword.mockRejectedValueOnce(new APIError("BAD_REQUEST", { message: "bad password" }));

    const state = await profileActions.changeAccountPassword(
      previousState,
      formData({
        currentPassword: "password123",
        newPassword: "password999",
        confirmPassword: "password999",
      }),
    );

    expect(state).toMatchObject({
      fields: {
        currentPassword: ["currentPasswordIncorrect"],
      },
      message: "fixHighlightedFields",
      successMessage: null,
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  test("changeAccountPassword revokes other sessions after changing the Better Auth password", async () => {
    const state = await profileActions.changeAccountPassword(
      previousState,
      formData({
        currentPassword: "password123",
        newPassword: "password999",
        confirmPassword: "password999",
      }),
    );

    expect(changePassword).toHaveBeenCalledWith({
      body: {
        currentPassword: "password123",
        newPassword: "password999",
        revokeOtherSessions: true,
      },
      headers: expect.any(Headers),
    });
    expect(updateUser).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      fields: {},
      message: null,
      successMessage: "saveSuccess",
    });
  });

  test("changeAccountPassword returns a profile-save error for unexpected auth failures", async () => {
    changePassword.mockRejectedValueOnce(new Error("auth store unavailable"));

    const state = await profileActions.changeAccountPassword(
      previousState,
      formData({
        currentPassword: "password123",
        newPassword: "password999",
        confirmPassword: "password999",
      }),
    );

    expect(state).toMatchObject({
      fields: {},
      message: "profileSaveFailed",
      successMessage: null,
    });
  });

  test("setAccountPassword validates password fields before calling Better Auth", async () => {
    const state = await profileActions.setAccountPassword(
      previousState,
      formData({
        newPassword: "password999",
      }),
    );

    expect(state).toMatchObject({
      fields: {
        confirmPassword: ["confirmPasswordRequired"],
      },
      message: "fixHighlightedFields",
      successMessage: null,
    });
    expect(hasCredentialPassword).not.toHaveBeenCalled();
    expect(setPassword).not.toHaveBeenCalled();
  });

  test("setAccountPassword requires a signed-in user", async () => {
    givenSignedOutUser();

    const state = await profileActions.setAccountPassword(
      previousState,
      formData({
        newPassword: "password999",
        confirmPassword: "password999",
      }),
    );

    expect(hasCredentialPassword).not.toHaveBeenCalled();
    expect(setPassword).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      fields: {},
      message: "loginRequired",
      successMessage: null,
    });
  });

  test("setAccountPassword refuses accounts that already have a credential password", async () => {
    givenSignedInCredentialUser();

    const state = await profileActions.setAccountPassword(
      previousState,
      formData({
        newPassword: "password999",
        confirmPassword: "password999",
      }),
    );

    expect(hasCredentialPassword).toHaveBeenCalledWith(user.id);
    expect(setPassword).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      fields: {},
      message: "passwordAlreadySet",
      successMessage: null,
    });
  });

  test("setAccountPassword creates a credential password for OAuth-only accounts", async () => {
    givenSignedInOAuthOnlyUser();

    const state = await profileActions.setAccountPassword(
      previousState,
      formData({
        newPassword: "password999",
        confirmPassword: "password999",
      }),
    );

    expect(setPassword).toHaveBeenCalledWith({
      body: {
        newPassword: "password999",
      },
      headers: expect.any(Headers),
    });
    expect(changePassword).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      fields: {},
      message: null,
      successMessage: "saveSuccess",
    });
  });

  test("setAccountPassword maps late Better Auth already-set failures to the already-set message", async () => {
    givenSignedInOAuthOnlyUser();
    setPassword.mockRejectedValueOnce(
      new APIError("BAD_REQUEST", {
        code: "PASSWORD_ALREADY_SET",
        message: "password already set",
      }),
    );

    const state = await profileActions.setAccountPassword(
      previousState,
      formData({
        newPassword: "password999",
        confirmPassword: "password999",
      }),
    );

    expect(setPassword).toHaveBeenCalledWith({
      body: {
        newPassword: "password999",
      },
      headers: expect.any(Headers),
    });
    expect(state).toMatchObject({
      fields: {},
      message: "passwordAlreadySet",
      successMessage: null,
    });
  });
});

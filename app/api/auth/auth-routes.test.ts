import { beforeEach, describe, expect, mock, test } from "bun:test";

import { APIError } from "better-auth/api";

await mock.module("server-only", () => ({}));
await mock.module("next-intl/server", () => ({
  getLocale: async () => "en",
  getTranslations: async () => (key: string) => key,
}));

const changePassword = mock();
const revalidatePath = mock();
const signInEmail = mock();
const signUpEmail = mock();
const getCurrentSession = mock();
const getDuplicateSignupFields = mock();
const findUnique = mock();
const updateUser = mock();

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
  emailVerifiedAt: null,
};

await mock.module("../../lib/auth", () => ({
  auth: {
    api: {
      changePassword,
      signInEmail,
      signUpEmail,
    },
  },
  getCurrentSession,
  getDuplicateSignupFields,
  serializeUserForResponse: (value: typeof user) => ({
    id: value.id,
    username: value.username,
    displayName: value.displayName,
    email: value.email,
    emailVerified: value.emailVerified || Boolean(value.emailVerifiedAt),
  }),
}));

await mock.module("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique,
      update: updateUser,
    },
  },
}));
await mock.module("@/lib/auth", () => ({
  auth: {
    api: {
      changePassword,
      signInEmail,
      signUpEmail,
    },
  },
  getCurrentSession,
  getDuplicateSignupFields,
  serializeUserForResponse: (value: typeof user) => ({
    id: value.id,
    username: value.username,
    displayName: value.displayName,
    email: value.email,
    emailVerified: value.emailVerified || Boolean(value.emailVerifiedAt),
  }),
}));
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

function formData(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

beforeEach(() => {
  changePassword.mockReset();
  signInEmail.mockReset();
  signUpEmail.mockReset();
  getCurrentSession.mockReset();
  getDuplicateSignupFields.mockReset();
  findUnique.mockReset();
  revalidatePath.mockReset();
  updateUser.mockReset();

  changePassword.mockResolvedValue({ status: true });
  signInEmail.mockResolvedValue({
    headers: new Headers({ "set-cookie": "session=login" }),
    response: { user: { id: user.id } },
  });
  signUpEmail.mockResolvedValue({
    headers: new Headers({ "set-cookie": "session=signup" }),
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

describe("auth API routes", () => {
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

  test("signup creates an account and returns Better Auth session headers", async () => {
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
    expect(response.headers.get("set-cookie")).toBe("session=signup");
    expect(call.body).toMatchObject({
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

  test("changeAccountPassword changes only the Better Auth password", async () => {
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
        revokeOtherSessions: false,
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
});

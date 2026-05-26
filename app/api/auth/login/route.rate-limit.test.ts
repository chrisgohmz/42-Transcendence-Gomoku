import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

await mock.module("server-only", () => ({}));
await mock.module("next-intl/server", () => ({
  getLocale: async () => "en",
  getTranslations: async () => (key: string) => key,
}));

const signInEmail = mock();
const findUnique = mock();
const originalRateLimitDisabled = process.env["RATE_LIMIT_DISABLED"];

const user = {
  id: "user-1",
  username: "max_player",
  displayName: "Max",
  email: "max@example.com",
  emailVerified: true,
};

await mock.module("../../../lib/auth", () =>
  createAuthModuleMock({
    auth: {
      api: {
        signInEmail,
      },
    },
  }),
);

await mock.module("../../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique,
    },
  },
}));

const route = await import("./route");

beforeEach(() => {
  process.env["RATE_LIMIT_DISABLED"] = "false";
  signInEmail.mockReset();
  findUnique.mockReset();

  signInEmail.mockResolvedValue({
    headers: new Headers({ "set-cookie": "session=login" }),
    response: { user: { id: user.id } },
  });
  findUnique.mockResolvedValue(user);
});

afterEach(() => {
  if (originalRateLimitDisabled === undefined) {
    delete process.env["RATE_LIMIT_DISABLED"];
  } else {
    process.env["RATE_LIMIT_DISABLED"] = originalRateLimitDisabled;
  }
});

function loginRequest(clientIp: string) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": clientIp,
    },
    body: JSON.stringify({
      email: "max@example.com",
      password: "password123",
    }),
  });
}

describe("POST /api/auth/login rate limiting", () => {
  test("returns a rate-limit response when the client IP quota is exceeded", async () => {
    const clientIp = "203.0.113.55";

    for (let index = 0; index < 10; index += 1) {
      const response = await route.POST(loginRequest(clientIp));

      expect(response.status).toBe(200);
    }

    const response = await route.POST(loginRequest(clientIp));
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(payload).toEqual({
      error: "rate_limited",
      message: "Too many requests. Try again later.",
    });
    expect(signInEmail).toHaveBeenCalledTimes(10);
  });
});

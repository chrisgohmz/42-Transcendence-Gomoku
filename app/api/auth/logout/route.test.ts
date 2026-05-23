import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

const signOut = mock();

await mock.module("../../../lib/auth", () =>
  createAuthModuleMock({
    auth: {
      api: {
        signOut,
      },
    },
  }),
);

const route = await import("./route");

beforeEach(() => {
  signOut.mockReset();

  signOut.mockResolvedValue({
    headers: new Headers({ "set-cookie": "session=; Max-Age=0" }),
  });
});

function logoutRequest(cookie = "better-auth.session_token=abc") {
  return new Request("https://lan-host.test:8443/api/auth/logout", {
    method: "POST",
    headers: { cookie },
  });
}

describe("POST /api/auth/logout", () => {
  test("returns success and forwards Better Auth response headers", async () => {
    const request = logoutRequest();
    const response = await route.POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(response.headers.get("set-cookie")).toBe("session=; Max-Age=0");
    expect(signOut).toHaveBeenCalledWith({
      headers: request.headers,
      request,
      returnHeaders: true,
    });
  });

  test("still expires auth cookies when Better Auth sign-out fails", async () => {
    signOut.mockRejectedValueOnce(new Error("session store down"));

    const response = await route.POST(
      logoutRequest("better-auth.session_token=abc; better-auth.session_data.0=chunk"),
    );
    const setCookieHeader = response.headers.get("set-cookie");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(setCookieHeader).toContain("better-auth.session_token=");
    expect(setCookieHeader).toContain("better-auth.session_data.0=");
    expect(setCookieHeader).toContain("Max-Age=0");
  });
});

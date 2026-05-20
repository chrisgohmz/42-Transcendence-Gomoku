import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

const headers = mock();
const signOut = mock();

await mock.module("next/headers", () => ({
  headers,
}));

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
  headers.mockReset();
  signOut.mockReset();

  headers.mockResolvedValue(new Headers({ cookie: "session=1" }));
  signOut.mockResolvedValue({
    headers: new Headers({ "set-cookie": "session=; Max-Age=0" }),
  });
});

describe("POST /api/auth/logout", () => {
  test("returns success and forwards Better Auth response headers", async () => {
    const response = await route.POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(response.headers.get("set-cookie")).toBe("session=; Max-Age=0");
    expect(signOut).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      returnHeaders: true,
    });
  });

  test("still returns success when Better Auth sign-out fails", async () => {
    signOut.mockRejectedValueOnce(new Error("session store down"));

    const response = await route.POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

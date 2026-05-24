import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { User } from "../../generated/prisma/client";
import { createAuthSessionAccessors, toAuthSessionUser } from "./auth-session-access";

type TestSessionData = {
  session: {
    id: string;
    token: string;
  };
  user: {
    avatarUrl?: string | null;
    displayName?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    id: string;
    image?: string | null;
    name?: string | null;
    username?: string | null;
  };
};

const requestHeaders = new Headers({ cookie: "better-auth.session_token=session-token" });
const session = {
  id: "session-1",
  token: "session-token",
};
const sessionData = {
  session,
  user: {
    avatarUrl: "https://cdn.example.test/ada.png",
    displayName: "Ada Lovelace",
    email: "ada@example.test",
    emailVerified: true,
    id: "user-ada",
    username: "ada",
  },
} satisfies TestSessionData;
const databaseUser = {
  avatarUrl: "https://cdn.example.test/ada-db.png",
  bio: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  displayName: "Ada Database",
  email: "ada@example.test",
  emailVerified: true,
  id: "user-ada",
  kind: "HUMAN",
  lastSeenAt: null,
  statusMessage: null,
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  username: "ada_db",
} as User;

const getHeaders = mock(async () => requestHeaders);
const getSession = mock(async () => sessionData);
const findUserById = mock(async () => databaseUser);

function createAccessors() {
  return createAuthSessionAccessors<TestSessionData>({
    findUserById,
    getHeaders,
    getSession,
  });
}

beforeEach(() => {
  getHeaders.mockReset();
  getSession.mockReset();
  findUserById.mockReset();

  getHeaders.mockResolvedValue(requestHeaders);
  getSession.mockResolvedValue(sessionData);
  findUserById.mockResolvedValue(databaseUser);
});

describe("auth session accessors", () => {
  test("returns session identity without reading the database user", async () => {
    const accessors = createAccessors();

    const result = await accessors.getCurrentSessionIdentity();

    expect(getSession).toHaveBeenCalledWith({ headers: requestHeaders });
    expect(findUserById).not.toHaveBeenCalled();
    expect(result).toEqual({
      session,
      user: {
        avatarUrl: "https://cdn.example.test/ada.png",
        displayName: "Ada Lovelace",
        email: "ada@example.test",
        emailVerified: true,
        id: "user-ada",
        username: "ada",
      },
    });
  });

  test("keeps DB-backed session lookup authoritative and forwards cookie-cache bypass", async () => {
    const accessors = createAccessors();

    const result = await accessors.getCurrentSession({ disableCookieCache: true });

    expect(getSession).toHaveBeenCalledWith({
      headers: requestHeaders,
      query: { disableCookieCache: true },
    });
    expect(findUserById).toHaveBeenCalledWith("user-ada");
    expect(result).toEqual({
      session,
      user: databaseUser,
    });
  });

  test("normalizes Better Auth user field aliases for cached session identity", () => {
    expect(
      toAuthSessionUser({
        email: null,
        emailVerified: null,
        id: "user-fallback",
        image: "https://cdn.example.test/fallback.png",
        name: "Fallback Name",
      }),
    ).toEqual({
      avatarUrl: "https://cdn.example.test/fallback.png",
      displayName: "Fallback Name",
      email: null,
      emailVerified: false,
      id: "user-fallback",
      username: "user-fallback",
    });
  });
});

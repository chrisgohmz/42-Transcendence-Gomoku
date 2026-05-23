import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

await mock.module("server-only", () => ({}));

const getCurrentSession = mock();
const findFriendships = mock();

await mock.module("@/lib/auth", () =>
  createAuthModuleMock({
    getCurrentSession,
  }),
);

await mock.module("@/lib/prisma", () => ({
  prisma: {
    friendship: {
      findMany: findFriendships,
    },
  },
}));

const route = await import("./route");

beforeEach(() => {
  getCurrentSession.mockReset();
  findFriendships.mockReset();

  getCurrentSession.mockResolvedValue({
    user: {
      id: "user-alice",
      username: "alice",
      displayName: "Alice",
    },
  });
  findFriendships.mockResolvedValue([]);
});

describe("GET /api/friends", () => {
  test("requires authentication", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await route.GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(findFriendships).not.toHaveBeenCalled();
  });

  test("returns the other user from accepted low/high friendships", async () => {
    findFriendships.mockResolvedValueOnce([
      {
        userLowId: "user-alice",
        userHighId: "user-bob",
        userLow: user("user-alice", "alice", "Alice"),
        userHigh: user("user-bob", "bob", "Bob"),
      },
      {
        userLowId: "user-carol",
        userHighId: "user-alice",
        userLow: user("user-carol", "carol", "Carol"),
        userHigh: user("user-alice", "alice", "Alice"),
      },
    ]);

    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(findFriendships).toHaveBeenCalledWith({
      where: {
        status: "ACCEPTED",
        OR: [{ userLowId: "user-alice" }, { userHighId: "user-alice" }],
      },
      include: {
        userLow: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        userHigh: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });
    expect(payload).toEqual({
      friends: [user("user-bob", "bob", "Bob"), user("user-carol", "carol", "Carol")],
    });
  });

  test("returns a server error when friendships fail to load", async () => {
    findFriendships.mockRejectedValueOnce(new Error("db down"));

    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({ error: "failed_to_load_friends" });
  });
});

function user(id: string, username: string, displayName: string) {
  return {
    id,
    username,
    displayName,
    avatarUrl: null,
  };
}

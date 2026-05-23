import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

const getLocale = mock();
const getTranslations = mock();
const revalidatePath = mock();
const getCurrentSession = mock();
const findUser = mock();
const findManyUsers = mock();
const findFriendship = mock();
const createFriendship = mock();
const deleteFriendship = mock();
const updateFriendship = mock();
const fetchMock = mock(async () => new Response(null, { status: 200 }));
const originalFetch = globalThis.fetch;
const originalRealtimeInternalSecret = process.env["REALTIME_INTERNAL_SECRET"];
const originalRealtimeFriendshipInternalUrl = process.env["REALTIME_FRIENDSHIP_INTERNAL_URL"];
const friendshipUpdateUrl = "http://localhost:3001/internal/friendship-update";

await mock.module("next-intl/server", () => ({
  getLocale,
  getTranslations,
}));

await mock.module("next/cache", () => ({
  revalidatePath,
}));

await mock.module("@/lib/auth", () =>
  createAuthModuleMock({
    getCurrentSession,
  }),
);

await mock.module("@/lib/prisma", () => ({
  prisma: {
    friendship: {
      create: createFriendship,
      delete: deleteFriendship,
      findUnique: findFriendship,
      update: updateFriendship,
    },
    user: {
      findMany: findManyUsers,
      findUnique: findUser,
    },
  },
}));

const { removeFriend, respondToRequest, sendFriendRequest } = await import("./actions");

const session = {
  user: {
    id: "user-ada",
  },
};
const targetUser = {
  id: "user-grace",
  username: "grace",
};
const pendingFriendship = {
  id: 42,
  requestedById: "user-grace",
  status: "PENDING",
  userHighId: "user-grace",
  userLowId: "user-ada",
};

function expectFriendshipRefresh(usernames: string[]) {
  expect(fetchMock).toHaveBeenCalledWith(
    friendshipUpdateUrl,
    expect.objectContaining({
      body: JSON.stringify({ usernames }),
      method: "POST",
    }),
  );
}

beforeEach(() => {
  getLocale.mockReset();
  getTranslations.mockReset();
  revalidatePath.mockReset();
  getCurrentSession.mockReset();
  findUser.mockReset();
  findManyUsers.mockReset();
  findFriendship.mockReset();
  createFriendship.mockReset();
  deleteFriendship.mockReset();
  updateFriendship.mockReset();
  fetchMock.mockReset();

  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env["REALTIME_INTERNAL_SECRET"] = "friend-secret";
  process.env["REALTIME_FRIENDSHIP_INTERNAL_URL"] = friendshipUpdateUrl;
  getLocale.mockResolvedValue("en");
  getTranslations.mockImplementation(
    async ({ namespace }: { namespace: string }) =>
      (key: string) =>
        `${namespace}:${key}`,
  );
  getCurrentSession.mockResolvedValue(session);
  findUser.mockResolvedValue(targetUser);
  findManyUsers.mockResolvedValue([
    { id: "user-ada", username: "ada" },
    { id: "user-grace", username: "grace" },
  ]);
  findFriendship.mockResolvedValue(null);
  createFriendship.mockResolvedValue({});
  deleteFriendship.mockResolvedValue({});
  updateFriendship.mockResolvedValue({});
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
});

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalRealtimeInternalSecret === undefined) {
    delete process.env["REALTIME_INTERNAL_SECRET"];
  } else {
    process.env["REALTIME_INTERNAL_SECRET"] = originalRealtimeInternalSecret;
  }

  if (originalRealtimeFriendshipInternalUrl === undefined) {
    delete process.env["REALTIME_FRIENDSHIP_INTERNAL_URL"];
  } else {
    process.env["REALTIME_FRIENDSHIP_INTERNAL_URL"] = originalRealtimeFriendshipInternalUrl;
  }
});

describe("sendFriendRequest", () => {
  test("requires authentication before looking up the target player", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const result = await sendFriendRequest("grace");

    expect(result).toEqual({ error: "friends:actions.signInToAddFriends" });
    expect(findUser).not.toHaveBeenCalled();
    expect(createFriendship).not.toHaveBeenCalled();
  });

  test("rejects self-friend requests and existing friendships", async () => {
    findUser.mockResolvedValueOnce({ id: "user-ada", username: "ada" });

    expect(await sendFriendRequest("ada")).toEqual({
      error: "friends:actions.cannotAddYourself",
    });
    expect(createFriendship).not.toHaveBeenCalled();

    findUser.mockResolvedValueOnce(targetUser);
    findFriendship.mockResolvedValueOnce(pendingFriendship);

    expect(await sendFriendRequest("grace")).toEqual({
      error: "friends:actions.alreadyFriendsOrPending",
    });
  });

  test("creates a pending friendship, notifies both players, and revalidates shared navigation", async () => {
    const result = await sendFriendRequest("grace");

    expect(result).toEqual({ success: true });
    expect(createFriendship).toHaveBeenCalledWith({
      data: {
        requestedById: "user-ada",
        status: "PENDING",
        userHighId: "user-grace",
        userLowId: "user-ada",
      },
    });
    expectFriendshipRefresh(["ada", "grace"]);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

describe("respondToRequest", () => {
  test("rejects missing, unauthorized, and self-request transitions", async () => {
    findFriendship.mockResolvedValueOnce(null);

    expect(await respondToRequest(42, true)).toEqual({
      error: "friends:actions.requestNotFound",
    });

    findFriendship.mockResolvedValueOnce({
      ...pendingFriendship,
      userHighId: "user-grace",
      userLowId: "user-marie",
    });

    expect(await respondToRequest(42, true)).toEqual({
      error: "friends:actions.unauthorized",
    });

    findFriendship.mockResolvedValueOnce({
      ...pendingFriendship,
      requestedById: "user-ada",
    });

    expect(await respondToRequest(42, true)).toEqual({
      error: "friends:actions.invalidTransition",
    });
  });

  test("accepts pending requests not created by the signed-in user", async () => {
    findFriendship.mockResolvedValueOnce(pendingFriendship);

    const result = await respondToRequest(42, true);

    expect(result).toEqual({ success: true });
    expect(updateFriendship).toHaveBeenCalledWith({
      data: {
        acceptedAt: expect.any(Date),
        respondedAt: expect.any(Date),
        status: "ACCEPTED",
      },
      where: { id: 42 },
    });
    expect(deleteFriendship).not.toHaveBeenCalled();
    expectFriendshipRefresh(["ada", "grace"]);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("declines requests through the shared delete-and-notify path", async () => {
    findFriendship.mockResolvedValueOnce(pendingFriendship);

    const result = await respondToRequest(42, false);

    expect(result).toEqual({ success: true });
    expect(deleteFriendship).toHaveBeenCalledWith({ where: { id: 42 } });
    expectFriendshipRefresh(["ada", "grace"]);
    expect(updateFriendship).not.toHaveBeenCalled();
  });
});

describe("removeFriend", () => {
  test("requires ownership before removing a friendship", async () => {
    findFriendship.mockResolvedValueOnce({
      ...pendingFriendship,
      userHighId: "user-grace",
      userLowId: "user-marie",
    });

    const result = await removeFriend(42);

    expect(result).toEqual({ error: "friends:actions.unauthorized" });
    expect(deleteFriendship).not.toHaveBeenCalled();
  });

  test("removes owned friendships through the shared delete-and-notify path", async () => {
    findFriendship.mockResolvedValueOnce(pendingFriendship);

    const result = await removeFriend(42);

    expect(result).toEqual({ success: true });
    expect(deleteFriendship).toHaveBeenCalledWith({ where: { id: 42 } });
    expectFriendshipRefresh(["ada", "grace"]);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

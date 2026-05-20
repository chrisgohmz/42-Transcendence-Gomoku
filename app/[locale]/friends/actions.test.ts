import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

const getLocale = mock();
const getTranslations = mock();
const revalidatePath = mock();
const getCurrentSession = mock();
const findUser = mock();
const findFriendship = mock();
const createFriendship = mock();
const updateFriendship = mock();
const deleteFriendshipAndNotify = mock();

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
      findUnique: findFriendship,
      update: updateFriendship,
    },
    user: {
      findUnique: findUser,
    },
  },
}));

await mock.module("@/lib/friendships/friendship-mutations", () => ({
  deleteFriendshipAndNotify,
  getLowHighIds: (left: string, right: string) =>
    left < right ? { userLowId: left, userHighId: right } : { userLowId: right, userHighId: left },
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

beforeEach(() => {
  getLocale.mockReset();
  getTranslations.mockReset();
  revalidatePath.mockReset();
  getCurrentSession.mockReset();
  findUser.mockReset();
  findFriendship.mockReset();
  createFriendship.mockReset();
  updateFriendship.mockReset();
  deleteFriendshipAndNotify.mockReset();

  getLocale.mockResolvedValue("en");
  getTranslations.mockImplementation(
    async ({ namespace }: { namespace: string }) =>
      (key: string) =>
        `${namespace}:${key}`,
  );
  getCurrentSession.mockResolvedValue(session);
  findUser.mockResolvedValue(targetUser);
  findFriendship.mockResolvedValue(null);
  createFriendship.mockResolvedValue({});
  updateFriendship.mockResolvedValue({});
  deleteFriendshipAndNotify.mockResolvedValue(undefined);
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

  test("creates a pending friendship and revalidates shared navigation", async () => {
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
    expect(deleteFriendshipAndNotify).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("declines requests through the shared delete-and-notify path", async () => {
    findFriendship.mockResolvedValueOnce(pendingFriendship);

    const result = await respondToRequest(42, false);

    expect(result).toEqual({ success: true });
    expect(deleteFriendshipAndNotify).toHaveBeenCalledWith(pendingFriendship);
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
    expect(deleteFriendshipAndNotify).not.toHaveBeenCalled();
  });

  test("removes owned friendships through the shared delete-and-notify path", async () => {
    findFriendship.mockResolvedValueOnce(pendingFriendship);

    const result = await removeFriend(42);

    expect(result).toEqual({ success: true });
    expect(deleteFriendshipAndNotify).toHaveBeenCalledWith(pendingFriendship);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

const getCurrentSession = mock();
const findManyUsers = mock();
const findFriendship = mock();
const createFriendship = mock();
const deleteFriendship = mock();
const updateFriendship = mock();
const revalidatePath = mock();
const fetchMock = mock(async () => new Response(null, { status: 200 }));
const originalFetch = globalThis.fetch;
const originalRealtimeInternalSecret = process.env["REALTIME_INTERNAL_SECRET"];
const originalRealtimeFriendshipInternalUrl = process.env["REALTIME_FRIENDSHIP_INTERNAL_URL"];
const friendshipUpdateUrl = "http://localhost:3001/internal/friendship-update";

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
    },
  },
}));

const { processFriendAction } = await import("./actions");

const friendship = {
  id: 42,
  userLowId: "user-a",
  userHighId: "user-b",
  requestedById: "user-a",
  status: "ACCEPTED",
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
  getCurrentSession.mockReset();
  findManyUsers.mockReset();
  findFriendship.mockReset();
  createFriendship.mockReset();
  deleteFriendship.mockReset();
  updateFriendship.mockReset();
  revalidatePath.mockReset();
  fetchMock.mockReset();

  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env["REALTIME_INTERNAL_SECRET"] = "friend-secret";
  process.env["REALTIME_FRIENDSHIP_INTERNAL_URL"] = friendshipUpdateUrl;
  getCurrentSession.mockResolvedValue({
    user: { id: "user-a" },
  });
  findManyUsers.mockResolvedValue([
    { id: "user-a", username: "ada" },
    { id: "user-b", username: "bob" },
  ]);
  findFriendship.mockResolvedValue(friendship);
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

describe("processFriendAction", () => {
  test("notifies both players when adding a friend from a profile", async () => {
    findFriendship.mockResolvedValueOnce(null);

    const result = await processFriendAction("user-b", "ADD");

    expect(result).toEqual({ success: true });
    expect(createFriendship).toHaveBeenCalledWith({
      data: {
        requestedById: "user-a",
        status: "PENDING",
        userHighId: "user-b",
        userLowId: "user-a",
      },
    });
    expectFriendshipRefresh(["ada", "bob"]);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("notifies both players when accepting a profile friend request", async () => {
    findFriendship.mockResolvedValueOnce({
      ...friendship,
      requestedById: "user-b",
      status: "PENDING",
    });

    const result = await processFriendAction("user-b", "ACCEPT");

    expect(result).toEqual({ success: true });
    expect(updateFriendship).toHaveBeenCalledWith({
      data: {
        acceptedAt: expect.any(Date),
        respondedAt: expect.any(Date),
        status: "ACCEPTED",
      },
      where: { userLowId_userHighId: { userLowId: "user-a", userHighId: "user-b" } },
    });
    expectFriendshipRefresh(["ada", "bob"]);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("uses the shared delete-and-notify path for profile removals", async () => {
    const result = await processFriendAction("user-b", "REMOVE");

    expect(result).toEqual({ success: true });
    expect(deleteFriendship).toHaveBeenCalledWith({ where: { id: 42 } });
    expectFriendshipRefresh(["ada", "bob"]);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("uses the shared delete-and-notify path for declined requests", async () => {
    const pendingFriendship = {
      ...friendship,
      requestedById: "user-b",
      status: "PENDING",
    };

    findFriendship.mockResolvedValueOnce(pendingFriendship);

    const result = await processFriendAction("user-b", "DECLINE");

    expect(result).toEqual({ success: true });
    expect(deleteFriendship).toHaveBeenCalledWith({ where: { id: 42 } });
  });
});

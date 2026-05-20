import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createAuthModuleMock } from "@/test-utils/auth-module-mock";

const getCurrentSession = mock();
const findFriendship = mock();
const createFriendship = mock();
const updateFriendship = mock();
const deleteFriendshipAndNotify = mock();
const revalidatePath = mock();

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
  },
}));

await mock.module("@/lib/friendships/friendship-mutations", () => ({
  deleteFriendshipAndNotify,
  getLowHighIds: (id1: string, id2: string) =>
    id1 < id2 ? { userLowId: id1, userHighId: id2 } : { userLowId: id2, userHighId: id1 },
}));

const { processFriendAction } = await import("./actions");

const friendship = {
  id: 42,
  userLowId: "user-a",
  userHighId: "user-b",
  requestedById: "user-a",
  status: "ACCEPTED",
};

beforeEach(() => {
  getCurrentSession.mockReset();
  findFriendship.mockReset();
  createFriendship.mockReset();
  updateFriendship.mockReset();
  deleteFriendshipAndNotify.mockReset();
  revalidatePath.mockReset();

  getCurrentSession.mockResolvedValue({
    user: { id: "user-a" },
  });
  findFriendship.mockResolvedValue(friendship);
  deleteFriendshipAndNotify.mockResolvedValue(undefined);
});

describe("processFriendAction", () => {
  test("uses the shared delete-and-notify path for profile removals", async () => {
    const result = await processFriendAction("user-b", "REMOVE");

    expect(result).toEqual({ success: true });
    expect(deleteFriendshipAndNotify).toHaveBeenCalledWith(friendship);
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
    expect(deleteFriendshipAndNotify).toHaveBeenCalledWith(pendingFriendship);
  });
});

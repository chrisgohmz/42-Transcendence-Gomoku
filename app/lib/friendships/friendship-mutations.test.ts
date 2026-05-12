import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const deleteFriendship = mock();
const findManyUsers = mock();
const publishFriendshipUpdate = mock();
const consoleError = mock();
const originalConsoleError = console.error;

await mock.module("@/lib/prisma", () => ({
  prisma: {
    friendship: {
      delete: deleteFriendship,
    },
    user: {
      findMany: findManyUsers,
    },
  },
}));

await mock.module("./realtime-publisher", () => ({
  publishFriendshipUpdate,
}));

const { deleteFriendshipAndNotify, getLowHighIds } = await import("./friendship-mutations");

beforeEach(() => {
  deleteFriendship.mockReset();
  findManyUsers.mockReset();
  publishFriendshipUpdate.mockReset();
  consoleError.mockReset();
  console.error = consoleError as unknown as typeof console.error;

  deleteFriendship.mockResolvedValue({});
  publishFriendshipUpdate.mockResolvedValue(undefined);
  findManyUsers.mockResolvedValue([
    { id: "user-high", username: "bob" },
    { id: "user-low", username: "alice" },
  ]);
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe("getLowHighIds", () => {
  test("orders friendship ids for the composite key", () => {
    expect(getLowHighIds("user-z", "user-a")).toEqual({
      userLowId: "user-a",
      userHighId: "user-z",
    });
  });
});

describe("deleteFriendshipAndNotify", () => {
  test("deletes by friendship id and publishes refreshes for both users", async () => {
    await deleteFriendshipAndNotify({
      id: 42,
      userLowId: "user-low",
      userHighId: "user-high",
    });

    expect(deleteFriendship).toHaveBeenCalledWith({
      where: { id: 42 },
    });
    expect(findManyUsers).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["user-low", "user-high"],
        },
      },
      select: {
        id: true,
        username: true,
      },
    });
    expect(publishFriendshipUpdate).toHaveBeenCalledWith(["alice", "bob"]);
  });

  test("keeps the delete successful when realtime notification fails", async () => {
    publishFriendshipUpdate.mockRejectedValueOnce(new Error("realtime down"));

    await deleteFriendshipAndNotify({
      id: 42,
      userLowId: "user-low",
      userHighId: "user-high",
    });

    expect(deleteFriendship).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to notify realtime server",
      expect.any(Error),
    );
  });
});

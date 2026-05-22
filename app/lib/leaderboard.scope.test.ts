import { beforeEach, describe, expect, mock, test } from "bun:test";

import { FriendshipStatus } from "../../generated/prisma/enums";

const findMany = mock();
const findFriendships = mock();

await mock.module("./prisma", () => ({
  prisma: {
    friendship: {
      findMany: findFriendships,
    },
    userGameStats: {
      findMany,
      findUnique: mock(),
    },
  },
}));

const { getLeaderboardSnapshot } = await import("./leaderboard");

beforeEach(() => {
  findMany.mockReset();
  findFriendships.mockReset();
});

describe("getLeaderboardSnapshot scope handling", () => {
  test("loads only accepted friends when scope is friends", async () => {
    findFriendships.mockResolvedValueOnce([
      {
        userLowId: "user-1",
        userHighId: "friend-a",
      },
      {
        userLowId: "friend-b",
        userHighId: "user-1",
      },
    ]);

    findMany.mockResolvedValueOnce([
      {
        botMatchesPlayed: 0,
        losses: 1,
        matchesPlayed: 2,
        rating: 1500,
        userId: "friend-a",
        wins: 1,
        user: {
          displayName: "Friend A",
        },
      },
      {
        botMatchesPlayed: 0,
        losses: 2,
        matchesPlayed: 4,
        rating: 1300,
        userId: "user-1",
        wins: 2,
        user: {
          displayName: "Me",
        },
      },
    ]);

    const snapshot = await getLeaderboardSnapshot("user-1", { scope: "friends" });

    expect(snapshot.currentUser).toMatchObject({
      playerId: "user-1",
      player: "Me",
      rank: 2,
    });
    expect(snapshot.entries).toHaveLength(2);
    expect(snapshot.entries[0]).toMatchObject({
      playerId: "friend-a",
      player: "Friend A",
      rank: 1,
    });
    expect(findFriendships).toHaveBeenCalledWith({
      select: {
        userHighId: true,
        userLowId: true,
      },
      where: {
        OR: [{ userLowId: "user-1" }, { userHighId: "user-1" }],
        status: FriendshipStatus.ACCEPTED,
      },
    });
    const queryArgs = findMany.mock.calls[0]?.[0] as { where?: { userId?: { in?: string[] } } };
    expect(queryArgs?.where?.userId?.in).toEqual(["user-1", "friend-a", "friend-b"]);
  });
});

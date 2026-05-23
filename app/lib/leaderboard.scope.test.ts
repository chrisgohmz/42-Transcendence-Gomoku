import { beforeEach, describe, expect, mock, test } from "bun:test";

import { FriendshipStatus } from "../../generated/prisma/enums";

const findMany = mock();
const findFriendships = mock();
const findUnique = mock();

await mock.module("./prisma", () => ({
  prisma: {
    friendship: {
      findMany: findFriendships,
    },
    userGameStats: {
      findMany,
      findUnique,
    },
  },
}));

const { getLeaderboardSnapshot, LEADERBOARD_LIMIT } = await import("./leaderboard");

beforeEach(() => {
  findMany.mockReset();
  findFriendships.mockReset();
  findUnique.mockReset();
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

  test("keeps the signed-in user spotlight when friends entries are capped", async () => {
    const friendIds = Array.from({ length: LEADERBOARD_LIMIT }, (_, index) => `friend-${index}`);
    findFriendships.mockResolvedValueOnce(
      friendIds.map((friendId) => ({
        userLowId: "user-1",
        userHighId: friendId,
      })),
    );
    findMany
      .mockResolvedValueOnce(
        friendIds.map((friendId, index) => ({
          botMatchesPlayed: 0,
          losses: index,
          matchesPlayed: LEADERBOARD_LIMIT + 1,
          rating: 2000 - index,
          userId: friendId,
          wins: LEADERBOARD_LIMIT - index,
          user: {
            displayName: `Friend ${index}`,
          },
        })),
      )
      .mockResolvedValueOnce(
        friendIds.map(() => ({
          botMatchesPlayed: 0,
          matchesPlayed: 20,
        })),
      );
    findUnique.mockResolvedValueOnce({
      botMatchesPlayed: 0,
      losses: 20,
      matchesPlayed: 20,
      rating: 1000,
      userId: "user-1",
      wins: 0,
      user: {
        displayName: "Me",
      },
    });

    const snapshot = await getLeaderboardSnapshot("user-1", { scope: "friends" });

    expect(snapshot.entries).toHaveLength(LEADERBOARD_LIMIT);
    expect(snapshot.entries.some((entry) => entry.playerId === "user-1")).toBe(false);
    expect(snapshot.currentUser).toMatchObject({
      playerId: "user-1",
      player: "Me",
      rank: LEADERBOARD_LIMIT + 1,
    });
    const rankQueryArgs = findMany.mock.calls[1]?.[0] as {
      where?: { userId?: { in?: string[] } };
    };
    expect(rankQueryArgs?.where?.userId?.in).toEqual(["user-1", ...friendIds]);
  });
});

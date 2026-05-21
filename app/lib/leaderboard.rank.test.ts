import { beforeEach, describe, expect, mock, test } from "bun:test";

import { RuleType } from "../../generated/prisma/enums";

const findMany = mock();

await mock.module("./prisma", () => ({
  prisma: {
    userGameStats: {
      findMany,
    },
  },
}));

const { getLeaderboardRank } = await import("./leaderboard");

beforeEach(() => {
  findMany.mockReset();
});

describe("getLeaderboardRank", () => {
  test("ignores bot-only rows when counting players ahead", async () => {
    findMany.mockResolvedValueOnce([
      {
        botMatchesPlayed: 4,
        matchesPlayed: 4,
      },
    ]);

    const rank = await getLeaderboardRank({
      rating: 1200,
      wins: 10,
      losses: 2,
      matchesPlayed: 8,
      botMatchesPlayed: 1,
    });

    expect(rank).toBe(1);
    expect(findMany).toHaveBeenCalledWith({
      select: {
        botMatchesPlayed: true,
        matchesPlayed: true,
      },
      where: {
        boardSize: 15,
        OR: [
          { rating: { gt: 1200 } },
          {
            rating: 1200,
            OR: [{ wins: { gt: 10 } }, { wins: 10, losses: { lt: 2 } }],
          },
        ],
        ruleType: RuleType.GOMOKU,
        matchesPlayed: { gt: 0 },
      },
    });
  });
});

import { describe, expect, test } from "bun:test";

import {
  LEADERBOARD_BOARD_SIZE,
  LEADERBOARD_FETCH_LIMIT,
  LEADERBOARD_RULE_TYPE,
  formatWinRate,
  leaderboardQueryArgs,
  toLeaderboardEntries,
} from "./leaderboard";

describe("leaderboard data", () => {
  test("formats ranked player stats for display and skips bot-only players", () => {
    expect(
      toLeaderboardEntries([
        {
          losses: 2,
          matchesPlayed: 8,
          botMatchesPlayed: 2,
          rating: 1300,
          userId: "user_1",
          wins: 6,
          user: {
            displayName: "Ada",
          },
        },
        {
          losses: 0,
          matchesPlayed: 5,
          botMatchesPlayed: 5,
          rating: 1500,
          userId: "user_bot",
          wins: 5,
          user: {
            displayName: "BotOnly",
          },
        },
        {
          losses: 1,
          matchesPlayed: 1,
          botMatchesPlayed: 0,
          rating: null,
          userId: "user_2",
          wins: 0,
          user: {
            displayName: "Grace",
          },
        },
      ]),
    ).toEqual([
      {
        losses: 2,
        player: "Ada",
        playerId: "user_1",
        rank: 1,
        rating: 1300,
        matchesPlayed: 8,
        winRate: "75.00%",
        wins: 6,
      },
      {
        losses: 1,
        player: "Grace",
        playerId: "user_2",
        rank: 2,
        rating: 0,
        matchesPlayed: 1,
        winRate: "0.00%",
        wins: 0,
      },
    ]);
  });

  test("keeps the database query bounded and narrow", () => {
    expect(leaderboardQueryArgs).toMatchObject({
      orderBy: [{ rating: "desc" }, { wins: "desc" }, { losses: "asc" }],
      select: {
        botMatchesPlayed: true,
        losses: true,
        matchesPlayed: true,
        rating: true,
        userId: true,
        wins: true,
        user: {
          select: {
            displayName: true,
          },
        },
      },
      take: LEADERBOARD_FETCH_LIMIT,
      where: {
        boardSize: LEADERBOARD_BOARD_SIZE,
        ruleType: LEADERBOARD_RULE_TYPE,
        matchesPlayed: { gt: 0 },
      },
    });
    expect("include" in leaderboardQueryArgs).toBe(false);
  });

  test("avoids division by zero in win-rate formatting", () => {
    expect(formatWinRate(0, 0)).toBe("0.00%");
  });
});

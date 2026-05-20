import { beforeEach, describe, expect, mock, test } from "bun:test";

import { MatchResult, Role, RuleType } from "../../../generated/prisma/enums";
import type { MatchHistoryEntry } from "../matches/match-history";

const findUnique = mock();
const findManyAchievements = mock();
const count = mock();
const getMatchHistoryPageForUser = mock();

// ✅ rank分岐を壊さないため「必ず truthy を返す」
const buildLeaderboardAheadWhere = mock(() => ({ OR: [] }));

await mock.module("@/lib/leaderboard", () => ({
  LEADERBOARD_BOARD_SIZE: 15,
  LEADERBOARD_RULE_TYPE: RuleType.GOMOKU,
  formatWinRate: (wins: number, matchesPlayed: number) =>
    matchesPlayed === 0 ? "0.00%" : `${((wins / matchesPlayed) * 100).toFixed(2)}%`,
  buildLeaderboardAheadWhere,
}));

await mock.module("@/lib/prisma", () => ({
  prisma: {
    userGameStats: {
      findUnique,
      count,
    },
    userAchievement: {
      findMany: findManyAchievements,
    },
  },
}));

await mock.module("@/lib/matches/match-history", () => ({
  getMatchHistoryPageForUser,
}));

const { getProfileStatsForUser, PROFILE_RECENT_MATCHES_PAGE_SIZE } =
  await import("./profile-stats");

beforeEach(() => {
  findUnique.mockReset();
  findManyAchievements.mockReset();
  count.mockReset();
  getMatchHistoryPageForUser.mockReset();
  buildLeaderboardAheadWhere.mockClear();

  findUnique.mockResolvedValue(null);
  findManyAchievements.mockResolvedValue([]);

  getMatchHistoryPageForUser.mockResolvedValue({
    entries: [],
    page: 1,
    limit: PROFILE_RECENT_MATCHES_PAGE_SIZE,
    totalMatches: 0,
    totalPages: 1,
  });

  count.mockResolvedValue(0);

  // 🔑 デフォルトで「eligible扱い」にする
  buildLeaderboardAheadWhere.mockReturnValue({ OR: [] });
});

describe("profile stats", () => {
  test("returns defaults for a new user", async () => {
    // 🔑 非 eligible ケース（rank計算しない）
    buildLeaderboardAheadWhere.mockReturnValueOnce(null);

    const snapshot = await getProfileStatsForUser("user-ada");

    expect(snapshot).toMatchObject({
      userId: "user-ada",
      rank: null,
      stats: {
        rating: null,
        wins: 0,
        losses: 0,
        draws: 0,
        matchesPlayed: 0,
        winRate: "0.00%",
        currentStreak: 0,
        bestStreak: 0,
        lastPlayedAt: null,
      },
      achievements: [],
      recentMatches: [],
    });

    expect(snapshot.progression).toMatchObject({
      level: 1,
      totalXp: 0,
      achievementPoints: 0,
    });

    expect(getMatchHistoryPageForUser).toHaveBeenCalledWith(
      "user-ada",
      1,
      PROFILE_RECENT_MATCHES_PAGE_SIZE,
    );

    // rank計算されないので count は呼ばれない
    expect(count).not.toHaveBeenCalled();
  });

  test("includes rank, achievements, progression, and recent matches", async () => {
    findUnique.mockResolvedValueOnce({
      rating: 1200,
      wins: 3,
      losses: 1,
      draws: 0,
      matchesPlayed: 4,
      botMatchesPlayed: 1,
      currentStreak: 2,
      bestStreak: 2,
      lastPlayedAt: new Date("2026-05-14T09:12:00.000Z"),
    });

    findManyAchievements.mockResolvedValueOnce([
      {
        progress: 1,
        completedAt: new Date("2026-05-01T00:00:00.000Z"),
        achievement: { code: "first_win", points: 10 },
      },
      {
        progress: 0,
        completedAt: null,
        achievement: { code: "ai_win", points: 5 },
      },
    ]);

    const matchHistory: MatchHistoryEntry[] = [
      {
        matchId: "match-1",
        result: MatchResult.WIN,
        endReason: "five_in_a_row",
        finishedAt: "2026-05-14T09:12:00.000Z",
        moveCount: 42,
        participants: [
          { role: Role.PLAYER, userId: "user-ada", displayName: "Ada" },
          { role: Role.PLAYER, userId: "user-grace", displayName: "Grace" },
        ],
      } as unknown as MatchHistoryEntry,
    ];

    getMatchHistoryPageForUser.mockResolvedValueOnce({
      entries: matchHistory,
      page: 2,
      limit: 5,
      totalMatches: 6,
      totalPages: 2,
    });

    const snapshot = await getProfileStatsForUser("user-ada", {
      recentMatchesLimit: 5,
      recentMatchesPage: 2,
    });

    expect(snapshot.rank).toBe(1);

    expect(snapshot.stats.winRate).toBe("75.00%");

    expect(snapshot.progression).toMatchObject({
      level: 2,
      totalXp: 565,
      achievementPoints: 10,
    });

    expect(snapshot.recentMatchesPagination).toEqual({
      page: 2,
      limit: 5,
      totalMatches: 6,
      totalPages: 2,
    });
  });
});

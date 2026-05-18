import { beforeEach, describe, expect, mock, test } from "bun:test";

import { MatchResult, Role, RuleType } from "../../../generated/prisma/enums";
import type { MatchHistoryEntry } from "../matches/match-history";

const findUnique = mock();
const findManyAchievements = mock();
const count = mock();
const getMatchHistoryForUser = mock();

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
  getMatchHistoryForUser,
}));

const { getProfileStatsForUser, PROFILE_RECENT_MATCHES_LIMIT } = await import("./profile-stats");

beforeEach(() => {
  findUnique.mockReset();
  findManyAchievements.mockReset();
  count.mockReset();
  getMatchHistoryForUser.mockReset();

  findUnique.mockResolvedValue(null);
  findManyAchievements.mockResolvedValue([]);
  getMatchHistoryForUser.mockResolvedValue([]);
  count.mockResolvedValue(0);
});

describe("profile stats", () => {
  test("returns defaults for a new user", async () => {
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
    expect(getMatchHistoryForUser).toHaveBeenCalledWith("user-ada", PROFILE_RECENT_MATCHES_LIMIT);
    expect(count).not.toHaveBeenCalled();
  });

  test("includes rank, achievements, progression, and recent matches", async () => {
    findUnique.mockResolvedValueOnce({
      rating: 1200,
      wins: 3,
      losses: 1,
      draws: 0,
      matchesPlayed: 4,
      currentStreak: 2,
      bestStreak: 2,
      lastPlayedAt: new Date("2026-05-14T09:12:00.000Z"),
    });

    findManyAchievements.mockResolvedValueOnce([
      {
        progress: 1,
        completedAt: new Date("2026-05-01T00:00:00.000Z"),
        achievement: {
          code: "first_win",
          points: 10,
        },
      },
      {
        progress: 0,
        completedAt: null,
        achievement: {
          code: "ai_win",
          points: 5,
        },
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
          {
            role: Role.PLAYER,
            userId: "user-ada",
            displayName: "Ada",
          },
          {
            role: Role.PLAYER,
            userId: "user-grace",
            displayName: "Grace",
          },
        ],
      } as unknown as MatchHistoryEntry,
    ];

    getMatchHistoryForUser.mockResolvedValueOnce(matchHistory);
    count.mockResolvedValueOnce(2);

    const snapshot = await getProfileStatsForUser("user-ada");

    expect(snapshot.rank).toBe(3);
    expect(snapshot.stats.winRate).toBe("75.00%");
    expect(snapshot.progression).toMatchObject({
      level: 2,
      totalXp: 565,
      achievementPoints: 10,
    });
    expect(snapshot.progression.progress).toBeCloseTo(0.13, 5);
    expect(snapshot.achievements).toMatchObject([
      {
        code: "first_win",
        points: 10,
        progress: 1,
        completedAt: "2026-05-01T00:00:00.000Z",
      },
      {
        code: "ai_win",
        points: 5,
        progress: 0,
        completedAt: null,
      },
    ]);
    expect(snapshot.recentMatches[0]).toMatchObject({
      matchId: "match-1",
      opponentDisplayName: "Grace",
      opponentUserId: "user-grace",
      result: MatchResult.WIN,
      endReason: "five_in_a_row",
      moveCount: 42,
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        boardSize: 15,
        ruleType: RuleType.GOMOKU,
        matchesPlayed: { gt: 0 },
        OR: [
          { rating: { gt: 1200 } },
          {
            rating: 1200,
            OR: [{ wins: { gt: 3 } }, { wins: 3, losses: { lt: 1 } }],
          },
        ],
      },
    });
  });
});

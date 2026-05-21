import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  MatchResult,
  MatchStatus,
  MatchVisibility,
  Role,
  RuleType,
  Seat,
} from "../../../generated/prisma/enums";
import type { MatchHistoryRecord } from "../matches/match-history";

const findUnique = mock();
const findManyStats = mock();
const findManyAchievements = mock();
const countMatches = mock();
const findManyMatches = mock();

await mock.module("@/lib/prisma", () => ({
  prisma: {
    userGameStats: {
      findUnique,
      findMany: findManyStats,
    },
    userAchievement: {
      findMany: findManyAchievements,
    },
    match: {
      count: countMatches,
      findMany: findManyMatches,
    },
  },
}));

const {
  getProfileStatsForUser,
  PROFILE_RECENT_MATCHES_MAX_LIMIT,
  PROFILE_RECENT_MATCHES_PAGE_SIZE,
} = await import("./profile-stats");

const createdAt = new Date("2026-05-14T09:00:00.000Z");
const startedAt = new Date("2026-05-14T09:01:00.000Z");
const finishedAt = new Date("2026-05-14T09:12:00.000Z");

function matchHistoryRecord(): MatchHistoryRecord {
  return {
    boardSize: 15,
    createdAt,
    endReason: "five_in_a_row",
    finishedAt,
    id: "match-1",
    moves: [],
    participants: [
      {
        displayNameSnapshot: "Ada",
        id: "participant-ada",
        joinedAt: startedAt,
        leftAt: finishedAt,
        result: MatchResult.WIN,
        role: Role.PLAYER,
        seat: Seat.BLACK,
        user: {
          displayName: "Ada",
          id: "user-ada",
          username: "ada",
        },
        userId: "user-ada",
      },
      {
        displayNameSnapshot: "Grace",
        id: "participant-grace",
        joinedAt: startedAt,
        leftAt: finishedAt,
        result: MatchResult.LOSS,
        role: Role.PLAYER,
        seat: Seat.WHITE,
        user: {
          displayName: "Grace",
          id: "user-grace",
          username: "grace",
        },
        userId: "user-grace",
      },
    ],
    ruleType: RuleType.GOMOKU,
    startedAt,
    stateVersion: 0,
    status: MatchStatus.FINISHED,
    updatedAt: finishedAt,
    visibility: MatchVisibility.PUBLIC,
    winningSeat: Seat.BLACK,
  };
}

beforeEach(() => {
  findUnique.mockReset();
  findManyStats.mockReset();
  findManyAchievements.mockReset();
  countMatches.mockReset();
  findManyMatches.mockReset();

  findUnique.mockResolvedValue(null);
  findManyStats.mockResolvedValue([]);
  findManyAchievements.mockResolvedValue([]);
  countMatches.mockResolvedValue(0);
  findManyMatches.mockResolvedValue([]);
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

    expect(countMatches).toHaveBeenCalledWith({
      where: {
        participants: {
          some: {
            userId: "user-ada",
          },
        },
        status: {
          in: [MatchStatus.FINISHED, MatchStatus.CANCELLED],
        },
      },
    });
    expect(findManyMatches.mock.calls[0]?.[0]).toMatchObject({
      skip: 0,
      take: PROFILE_RECENT_MATCHES_PAGE_SIZE,
    });
    expect(findManyStats).not.toHaveBeenCalled();
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

    countMatches.mockResolvedValueOnce(6);
    findManyMatches.mockResolvedValueOnce([matchHistoryRecord()]);

    const snapshot = await getProfileStatsForUser("user-ada", {
      recentMatchesLimit: 5,
      recentMatchesPage: 2,
    });

    expect(snapshot.rank).toBe(1);

    expect(findManyStats).toHaveBeenCalledWith({
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
            OR: [{ wins: { gt: 3 } }, { wins: 3, losses: { lt: 1 } }],
          },
        ],
        ruleType: RuleType.GOMOKU,
        matchesPlayed: { gt: 0 },
      },
    });
    expect(findManyMatches.mock.calls[0]?.[0]).toMatchObject({
      skip: 5,
      take: 5,
    });

    expect(snapshot.stats.winRate).toBe("75.00%");

    expect(snapshot.progression).toMatchObject({
      level: 2,
      totalXp: 565,
      achievementPoints: 10,
    });
    expect(snapshot.progression.progress).toBeCloseTo(0.13, 2);

    expect(snapshot.achievements).toEqual([
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

    expect(snapshot.recentMatches).toEqual([
      {
        matchId: "match-1",
        opponentDisplayName: "Grace",
        opponentUserId: "user-grace",
        finishedAt: "2026-05-14T09:12:00.000Z",
        result: MatchResult.WIN,
        endReason: "five_in_a_row",
        moveCount: 0,
      },
    ]);

    expect(snapshot.recentMatchesPagination).toEqual({
      page: 2,
      limit: 5,
      totalMatches: 6,
      totalPages: 2,
    });
  });

  test("normalizes recentMatchesLimit bounds", async () => {
    await getProfileStatsForUser("user-ada", { recentMatchesLimit: 2.5, recentMatchesPage: 1 });

    expect(findManyMatches.mock.calls[0]?.[0]).toMatchObject({
      skip: 0,
      take: PROFILE_RECENT_MATCHES_PAGE_SIZE,
    });

    await getProfileStatsForUser("user-ada", { recentMatchesLimit: 9999, recentMatchesPage: 1 });

    expect(findManyMatches.mock.calls[1]?.[0]).toMatchObject({
      skip: 0,
      take: PROFILE_RECENT_MATCHES_MAX_LIMIT,
    });
  });
});

import { describe, expect, mock, test } from "bun:test";

import { MatchResult, MatchVisibility, Role, RuleType } from "../../../generated/prisma/enums";
import {
  buildAchievementProgress,
  buildUserGameStatsSnapshots,
  summarizeMatchResults,
  syncUserGameStatsForUser,
  type ResultSyncMatchSummary,
  type ResultSyncOptions,
} from "./result-sync";

function summary(overrides: Partial<ResultSyncMatchSummary>): ResultSyncMatchSummary {
  return {
    matchId: "match-1",
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    result: MatchResult.WIN,
    finishedAt: new Date("2026-05-10T10:00:00.000Z"),
    visibility: MatchVisibility.PUBLIC,
    isBotMatch: false,
    ...overrides,
  };
}

function createResultSyncClient(options: {
  existingAchievements?: Array<{
    achievementId: number;
    completedAt: Date | null;
    progress: number;
  }>;
  totalMoves: number;
}) {
  const userAchievementUpsert = mock(async (_args: unknown) => ({}));

  return {
    client: {
      achievementDefinition: {
        findMany: mock(async () => [
          { id: 1, code: "first_win" },
          { id: 2, code: "ten_moves" },
          { id: 3, code: "ai_win" },
          { id: 4, code: "win_streak_3" },
        ]),
      },
      matchMove: {
        count: mock(async () => options.totalMoves),
      },
      matchParticipant: {
        findMany: mock(async () => [
          {
            id: "participant-1",
            result: MatchResult.LOSS,
            match: {
              id: "match-1",
              boardSize: 15,
              ruleType: RuleType.GOMOKU,
              finishedAt: new Date("2026-05-10T10:00:00.000Z"),
              visibility: MatchVisibility.PUBLIC,
              participants: [
                { role: Role.PLAYER, userId: "user-1" },
                { role: Role.PLAYER, userId: "user-2" },
              ],
            },
          },
        ]),
      },
      userAchievement: {
        findMany: mock(async () => options.existingAchievements ?? []),
        upsert: userAchievementUpsert,
      },
      userGameStats: {
        findMany: mock(async () => []),
        upsert: mock(async () => ({})),
      },
    },
    userAchievementUpsert,
  };
}

describe("result sync", () => {
  test("summarizes competitive results and streaks", () => {
    const t1 = new Date("2026-05-10T10:00:00.000Z");
    const t2 = new Date("2026-05-11T10:00:00.000Z");
    const t3 = new Date("2026-05-12T10:00:00.000Z");
    const t4 = new Date("2026-05-13T10:00:00.000Z");

    const summaries = [
      summary({ matchId: "m1", result: MatchResult.WIN, finishedAt: t1 }),
      summary({
        matchId: "m2",
        result: MatchResult.WIN,
        finishedAt: t2,
        visibility: MatchVisibility.PRIVATE,
        isBotMatch: true,
      }),
      summary({ matchId: "m3", result: MatchResult.LOSS, finishedAt: t3 }),
      summary({ matchId: "m4", result: MatchResult.CANCELLED, finishedAt: t4 }),
    ];

    const snapshot = summarizeMatchResults(RuleType.GOMOKU, 15, summaries);

    expect(snapshot).toMatchObject({
      matchesPlayed: 3,
      wins: 2,
      losses: 1,
      draws: 0,
      botMatchesPlayed: 1,
      botWins: 1,
      currentStreak: 0,
      bestStreak: 2,
    });
    expect(snapshot.lastPlayedAt?.toISOString()).toBe(t4.toISOString());
  });

  test("builds empty snapshots for known keys with no matches", () => {
    const snapshots = buildUserGameStatsSnapshots(
      [],
      [{ ruleType: RuleType.GOMOKU, boardSize: 15 }],
    );

    expect(snapshots[0]).toMatchObject({
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      botMatchesPlayed: 0,
      botWins: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastPlayedAt: null,
    });
  });

  test("derives achievement progress from results and moves", () => {
    const t1 = new Date("2026-05-10T10:00:00.000Z");
    const t2 = new Date("2026-05-11T10:00:00.000Z");
    const t3 = new Date("2026-05-12T10:00:00.000Z");
    const t4 = new Date("2026-05-13T10:00:00.000Z");

    const summaries = [
      summary({ matchId: "m1", result: MatchResult.WIN, finishedAt: t1 }),
      summary({ matchId: "m2", result: MatchResult.WIN, finishedAt: t2 }),
      summary({
        matchId: "m3",
        result: MatchResult.WIN,
        finishedAt: t3,
        visibility: MatchVisibility.PRIVATE,
        isBotMatch: true,
      }),
      summary({ matchId: "m4", result: MatchResult.LOSS, finishedAt: t4 }),
    ];

    const progress = buildAchievementProgress({
      summaries,
      totalMoves: 12,
      now: t4,
    });

    const firstWin = progress.find((item) => item.code === "first_win");
    expect(firstWin?.progress).toBe(1);
    expect(firstWin?.completedAt?.toISOString()).toBe(t1.toISOString());

    const tenMoves = progress.find((item) => item.code === "ten_moves");
    expect(tenMoves?.progress).toBe(12);
    expect(tenMoves?.completedAt?.toISOString()).toBe(t4.toISOString());

    const aiWin = progress.find((item) => item.code === "ai_win");
    expect(aiWin?.progress).toBe(1);
    expect(aiWin?.completedAt?.toISOString()).toBe(t3.toISOString());

    const winStreak = progress.find((item) => item.code === "win_streak_3");
    expect(winStreak?.progress).toBe(3);
  });

  test("persists partial achievement progress without completing it", async () => {
    const { client, userAchievementUpsert } = createResultSyncClient({
      totalMoves: 5,
    });

    await syncUserGameStatsForUser("user-1", {
      now: new Date("2026-05-18T00:00:00.000Z"),
      tx: client as unknown as ResultSyncOptions["tx"],
    });

    expect(userAchievementUpsert).toHaveBeenCalledTimes(1);
    expect(userAchievementUpsert.mock.calls[0]?.[0]).toMatchObject({
      create: {
        achievementId: 2,
        completedAt: null,
        progress: 5,
        userId: "user-1",
      },
      update: {
        completedAt: null,
        progress: 5,
      },
      where: {
        userId_achievementId: {
          achievementId: 2,
          userId: "user-1",
        },
      },
    });
  });

  test("preserves an existing achievement completion when progress later decreases", async () => {
    const completedAt = new Date("2026-05-12T00:00:00.000Z");
    const { client, userAchievementUpsert } = createResultSyncClient({
      existingAchievements: [{ achievementId: 2, completedAt, progress: 10 }],
      totalMoves: 5,
    });

    await syncUserGameStatsForUser("user-1", {
      now: new Date("2026-05-18T00:00:00.000Z"),
      tx: client as unknown as ResultSyncOptions["tx"],
    });

    expect(userAchievementUpsert).toHaveBeenCalledTimes(1);
    expect(userAchievementUpsert.mock.calls[0]?.[0]).toMatchObject({
      create: {
        completedAt,
        progress: 5,
      },
      update: {
        completedAt,
        progress: 5,
      },
    });
  });
});

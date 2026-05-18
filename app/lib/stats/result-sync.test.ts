import { describe, expect, test } from "bun:test";

import { MatchResult, MatchVisibility, RuleType } from "../../../generated/prisma/enums";
import {
  buildAchievementProgress,
  buildUserGameStatsSnapshots,
  summarizeMatchResults,
  type ResultSyncMatchSummary,
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
});

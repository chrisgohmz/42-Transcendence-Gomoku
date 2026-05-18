import type { Prisma } from "../../../generated/prisma/client";
import { MatchResult, MatchVisibility, Role, RuleType } from "../../../generated/prisma/enums";
import { terminalMatchStatuses } from "../matches/match-history";
import { prisma } from "../prisma";

const competitiveResults = new Set<MatchResult>([
  MatchResult.WIN,
  MatchResult.LOSS,
  MatchResult.DRAW,
]);

export const resultSyncParticipantSelect = {
  id: true,
  result: true,
  match: {
    select: {
      id: true,
      boardSize: true,
      ruleType: true,
      finishedAt: true,
      visibility: true,
      participants: {
        select: {
          role: true,
          userId: true,
        },
      },
    },
  },
} satisfies Prisma.MatchParticipantSelect;

export type ResultSyncParticipant = Prisma.MatchParticipantGetPayload<{
  select: typeof resultSyncParticipantSelect;
}>;

export type ResultSyncMatchSummary = {
  matchId: string;
  ruleType: RuleType;
  boardSize: number;
  result: MatchResult;
  finishedAt: Date | null;
  visibility: MatchVisibility;
  isBotMatch: boolean;
};

export type UserGameStatsSnapshot = {
  ruleType: RuleType;
  boardSize: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  botMatchesPlayed: number;
  botWins: number;
  currentStreak: number;
  bestStreak: number;
  lastPlayedAt: Date | null;
};

export type UserGameStatsKey = {
  ruleType: RuleType;
  boardSize: number;
};

export type AchievementProgressSnapshot = {
  code: string;
  progress: number;
  completedAt: Date | null;
};

export type ResultSyncReport = {
  userId: string;
  stats: UserGameStatsSnapshot[];
  achievements: AchievementProgressSnapshot[];
  totalMoves: number;
};

export type ResultSyncOptions = {
  now?: Date;
  tx?: Prisma.TransactionClient;
};

function isCompetitiveResult(result: MatchResult): boolean {
  return competitiveResults.has(result);
}

function statsKey(ruleType: RuleType, boardSize: number): string {
  return `${ruleType}:${boardSize}`;
}

function compareFinishedAtDesc(a: Date | null, b: Date | null): number {
  const aTime = a ? a.getTime() : 0;
  const bTime = b ? b.getTime() : 0;
  return bTime - aTime;
}

function latestFinishedAt(summaries: ResultSyncMatchSummary[]): Date | null {
  for (const summary of summaries) {
    if (summary.finishedAt) {
      return summary.finishedAt;
    }
  }
  return null;
}

function earliestFinishedAt(summaries: ResultSyncMatchSummary[]): Date | null {
  let earliest: Date | null = null;
  for (const summary of summaries) {
    if (!summary.finishedAt) {
      continue;
    }
    if (!earliest || summary.finishedAt.getTime() < earliest.getTime()) {
      earliest = summary.finishedAt;
    }
  }
  return earliest;
}

function computeStreaks(results: MatchResult[]): { currentStreak: number; bestStreak: number } {
  let currentStreak = 0;
  for (const result of results) {
    if (result === MatchResult.WIN) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  let bestStreak = 0;
  let running = 0;
  for (const result of results) {
    if (result === MatchResult.WIN) {
      running += 1;
      bestStreak = Math.max(bestStreak, running);
    } else {
      running = 0;
    }
  }

  return { currentStreak, bestStreak };
}

function toMatchSummary(participant: ResultSyncParticipant): ResultSyncMatchSummary | null {
  if (!participant.result) {
    return null;
  }

  return {
    matchId: participant.match.id,
    ruleType: participant.match.ruleType,
    boardSize: participant.match.boardSize,
    result: participant.result,
    finishedAt: participant.match.finishedAt,
    visibility: participant.match.visibility,
    isBotMatch: participant.match.participants.some(
      (entry) => entry.role === Role.PLAYER && entry.userId === null,
    ),
  };
}

export function summarizeMatchResults(
  ruleType: RuleType,
  boardSize: number,
  summaries: ResultSyncMatchSummary[],
): UserGameStatsSnapshot {
  if (summaries.length === 0) {
    return {
      ruleType,
      boardSize,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      botMatchesPlayed: 0,
      botWins: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastPlayedAt: null,
    };
  }

  const sorted = [...summaries].sort((a, b) => compareFinishedAtDesc(a.finishedAt, b.finishedAt));

  let matchesPlayed = 0;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let botMatchesPlayed = 0;
  let botWins = 0;

  for (const summary of sorted) {
    if (!isCompetitiveResult(summary.result)) {
      continue;
    }

    matchesPlayed += 1;
    if (summary.result === MatchResult.WIN) {
      wins += 1;
    } else if (summary.result === MatchResult.LOSS) {
      losses += 1;
    } else if (summary.result === MatchResult.DRAW) {
      draws += 1;
    }

    if (summary.isBotMatch) {
      botMatchesPlayed += 1;
      if (summary.result === MatchResult.WIN) {
        botWins += 1;
      }
    }
  }

  const { currentStreak, bestStreak } = computeStreaks(sorted.map((summary) => summary.result));
  const lastPlayedAt = latestFinishedAt(sorted);

  return {
    ruleType,
    boardSize,
    matchesPlayed,
    wins,
    losses,
    draws,
    botMatchesPlayed,
    botWins,
    currentStreak,
    bestStreak,
    lastPlayedAt,
  };
}

export function buildUserGameStatsSnapshots(
  summaries: ResultSyncMatchSummary[],
  existingKeys: UserGameStatsKey[] = [],
): UserGameStatsSnapshot[] {
  const grouped = new Map<string, ResultSyncMatchSummary[]>();
  for (const summary of summaries) {
    const key = statsKey(summary.ruleType, summary.boardSize);
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(summary);
    } else {
      grouped.set(key, [summary]);
    }
  }

  const allKeys = new Map<string, UserGameStatsKey>();
  for (const key of existingKeys) {
    allKeys.set(statsKey(key.ruleType, key.boardSize), key);
  }
  for (const summary of summaries) {
    allKeys.set(statsKey(summary.ruleType, summary.boardSize), {
      ruleType: summary.ruleType,
      boardSize: summary.boardSize,
    });
  }

  const snapshots: UserGameStatsSnapshot[] = [];
  for (const key of allKeys.values()) {
    const group = grouped.get(statsKey(key.ruleType, key.boardSize)) ?? [];
    snapshots.push(summarizeMatchResults(key.ruleType, key.boardSize, group));
  }

  return snapshots;
}

export function buildAchievementProgress(input: {
  summaries: ResultSyncMatchSummary[];
  totalMoves: number;
  now?: Date;
}): AchievementProgressSnapshot[] {
  const now = input.now ?? new Date();
  const sorted = [...input.summaries].sort((a, b) =>
    compareFinishedAtDesc(a.finishedAt, b.finishedAt),
  );
  const lastPlayedAt = latestFinishedAt(sorted) ?? now;

  const publicWins = sorted.filter(
    (summary) =>
      summary.visibility === MatchVisibility.PUBLIC && summary.result === MatchResult.WIN,
  );
  const botWins = sorted.filter(
    (summary) => summary.isBotMatch && summary.result === MatchResult.WIN,
  );
  const { bestStreak } = computeStreaks(sorted.map((summary) => summary.result));

  return [
    {
      code: "first_win",
      progress: publicWins.length > 0 ? 1 : 0,
      completedAt: publicWins.length > 0 ? earliestFinishedAt(publicWins) : null,
    },
    {
      code: "ten_moves",
      progress: input.totalMoves,
      completedAt: input.totalMoves >= 10 ? lastPlayedAt : null,
    },
    {
      code: "ai_win",
      progress: botWins.length,
      completedAt: botWins.length > 0 ? earliestFinishedAt(botWins) : null,
    },
    {
      code: "win_streak_3",
      progress: bestStreak,
      completedAt: bestStreak >= 3 ? lastPlayedAt : null,
    },
  ];
}

export async function syncUserGameStatsForUser(
  userId: string,
  options: ResultSyncOptions = {},
): Promise<ResultSyncReport> {
  const now = options.now ?? new Date();
  const client = options.tx ?? prisma;

  const existingStats = await client.userGameStats.findMany({
    where: { userId },
    select: {
      averageMoveTimeMs: true,
      boardSize: true,
      rating: true,
      ruleType: true,
      totalPlayTimeSeconds: true,
    },
  });
  const existingKeys = existingStats.map((stat) => ({
    ruleType: stat.ruleType,
    boardSize: stat.boardSize,
  }));
  const existingStatsByKey = new Map(
    existingStats.map((stat) => [statsKey(stat.ruleType, stat.boardSize), stat]),
  );

  const participants = await client.matchParticipant.findMany({
    where: {
      role: Role.PLAYER,
      userId,
      result: { not: null },
      match: {
        status: {
          in: [...terminalMatchStatuses],
        },
      },
    },
    select: resultSyncParticipantSelect,
  });
  const summaries = participants
    .map(toMatchSummary)
    .filter((summary): summary is ResultSyncMatchSummary => summary !== null);

  const statsSnapshots = buildUserGameStatsSnapshots(summaries, existingKeys);

  await Promise.all(
    statsSnapshots.map((snapshot) => {
      const existing = existingStatsByKey.get(statsKey(snapshot.ruleType, snapshot.boardSize));

      return client.userGameStats.upsert({
        where: {
          userId_ruleType_boardSize: {
            userId,
            ruleType: snapshot.ruleType,
            boardSize: snapshot.boardSize,
          },
        },
        create: {
          userId,
          ruleType: snapshot.ruleType,
          boardSize: snapshot.boardSize,
          matchesPlayed: snapshot.matchesPlayed,
          wins: snapshot.wins,
          losses: snapshot.losses,
          draws: snapshot.draws,
          botMatchesPlayed: snapshot.botMatchesPlayed,
          botWins: snapshot.botWins,
          currentStreak: snapshot.currentStreak,
          bestStreak: snapshot.bestStreak,
          lastPlayedAt: snapshot.lastPlayedAt,
          rating: existing?.rating ?? null,
          averageMoveTimeMs: existing?.averageMoveTimeMs ?? null,
          totalPlayTimeSeconds: existing?.totalPlayTimeSeconds ?? 0,
        },
        update: {
          matchesPlayed: snapshot.matchesPlayed,
          wins: snapshot.wins,
          losses: snapshot.losses,
          draws: snapshot.draws,
          botMatchesPlayed: snapshot.botMatchesPlayed,
          botWins: snapshot.botWins,
          currentStreak: snapshot.currentStreak,
          bestStreak: snapshot.bestStreak,
          lastPlayedAt: snapshot.lastPlayedAt,
        },
      });
    }),
  );

  const participantIds = participants.map((participant) => participant.id);
  const totalMoves =
    participantIds.length === 0
      ? 0
      : await client.matchMove.count({
          where: {
            participantId: {
              in: participantIds,
            },
          },
        });

  const achievementSnapshots = buildAchievementProgress({
    summaries,
    totalMoves,
    now,
  });

  if (achievementSnapshots.length > 0) {
    const definitions = await client.achievementDefinition.findMany({
      where: {
        code: {
          in: achievementSnapshots.map((snapshot) => snapshot.code),
        },
      },
    });

    if (definitions.length > 0) {
      const definitionsByCode = new Map(
        definitions.map((definition) => [definition.code, definition]),
      );
      const existingAchievements = await client.userAchievement.findMany({
        where: {
          userId,
          achievementId: {
            in: definitions.map((definition) => definition.id),
          },
        },
        select: {
          achievementId: true,
          completedAt: true,
          progress: true,
        },
      });
      const existingAchievementById = new Map(
        existingAchievements.map((achievement) => [achievement.achievementId, achievement]),
      );

      const updates: Promise<unknown>[] = [];

      for (const snapshot of achievementSnapshots) {
        const definition = definitionsByCode.get(snapshot.code);
        if (!definition) {
          continue;
        }

        const existingAchievement = existingAchievementById.get(definition.id);
        if (snapshot.progress === 0 && !existingAchievement) {
          continue;
        }

        const completedAt =
          snapshot.progress > 0
            ? (existingAchievement?.completedAt ?? snapshot.completedAt ?? now)
            : null;

        updates.push(
          client.userAchievement.upsert({
            where: {
              userId_achievementId: {
                userId,
                achievementId: definition.id,
              },
            },
            create: {
              userId,
              achievementId: definition.id,
              progress: snapshot.progress,
              completedAt,
              unlockedAt: completedAt ?? now,
            },
            update: {
              progress: snapshot.progress,
              completedAt,
            },
          }),
        );
      }

      await Promise.all(updates);
    }
  }

  return {
    userId,
    stats: statsSnapshots,
    achievements: achievementSnapshots,
    totalMoves,
  };
}

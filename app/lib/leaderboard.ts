import { cacheLife } from "next/cache";

import type { Prisma } from "../../generated/prisma/client";
import { RuleType } from "../../generated/prisma/enums";
import { prisma } from "./prisma";

export const LEADERBOARD_BOARD_SIZE = 15;
export const LEADERBOARD_LIMIT = 100;
export const LEADERBOARD_RULE_TYPE = RuleType.GOMOKU;

type LeaderboardStat = {
  matchesPlayed: number;
  rating: number | null;
  userId: string;
  wins: number;
  losses: number;
  user: {
    displayName: string;
  };
};

export type LeaderboardEntry = {
  playerId: string;
  rank: number;
  player: string;
  rating: number;
  wins: number;
  losses: number;
  winRate: string;
};

export type LeaderboardRankInput = {
  rating: number | null;
  wins: number;
  losses: number;
  matchesPlayed: number;
};

export const leaderboardBaseWhere = {
  boardSize: LEADERBOARD_BOARD_SIZE,
  ruleType: LEADERBOARD_RULE_TYPE,
} satisfies Prisma.UserGameStatsWhereInput;

export const leaderboardRankedWhere = {
  ...leaderboardBaseWhere,
  matchesPlayed: { gt: 0 },
} satisfies Prisma.UserGameStatsWhereInput;

export const leaderboardRankingOrder = [
  { rating: "desc" },
  { wins: "desc" },
  { losses: "asc" },
] satisfies Prisma.UserGameStatsOrderByWithRelationInput[];

export const leaderboardQueryArgs = {
  orderBy: leaderboardRankingOrder,
  select: {
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
  take: LEADERBOARD_LIMIT,
  where: leaderboardBaseWhere,
} satisfies Prisma.UserGameStatsFindManyArgs;

export function formatWinRate(wins: number, matchesPlayed: number): string {
  if (matchesPlayed === 0) {
    return "0.00%";
  }

  return `${((wins / matchesPlayed) * 100).toFixed(2)}%`;
}

export function buildLeaderboardAheadWhere(
  stats: LeaderboardRankInput,
): Prisma.UserGameStatsWhereInput | null {
  if (stats.matchesPlayed === 0) {
    return null;
  }

  const aheadByRating: Prisma.UserGameStatsWhereInput =
    stats.rating === null ? { rating: { not: null } } : { rating: { gt: stats.rating } };

  const aheadWithinRating: Prisma.UserGameStatsWhereInput = {
    rating: stats.rating,
    OR: [
      { wins: { gt: stats.wins } },
      {
        wins: stats.wins,
        losses: { lt: stats.losses },
      },
    ],
  };

  return {
    ...leaderboardRankedWhere,
    OR: [aheadByRating, aheadWithinRating],
  };
}

export function toLeaderboardEntries(stats: LeaderboardStat[]): LeaderboardEntry[] {
  return stats.map((stat, index) => ({
    playerId: stat.userId,
    rank: index + 1,
    player: stat.user.displayName,
    rating: stat.rating ?? 0,
    wins: stat.wins,
    losses: stat.losses,
    winRate: formatWinRate(stat.wins, stat.matchesPlayed),
  }));
}

export async function getLeaderboardEntries(): Promise<LeaderboardEntry[]> {
  "use cache";
  cacheLife("minutes");

  const stats = await prisma.userGameStats.findMany(leaderboardQueryArgs);

  return toLeaderboardEntries(stats);
}
